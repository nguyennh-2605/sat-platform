const axios = require('axios');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MISSING_TTL_MS = 60 * 60 * 1000;
const PROVIDER_URL = 'https://freedictionaryapi.com/api/v1/entries/en/';
const dictionaryError = (status, message, code) => new ApiError(status, { success: false, message, data: null, code });

function normalizeWord(input) {
  const word = typeof input === 'string' ? input.normalize('NFC').trim().toLowerCase().replaceAll('’', "'").replace(/[‐‑]/g, '-') : '';
  if (!word || word.length > 64 || !/^\p{L}+(?:['-]\p{L}+)*$/u.test(word)) {
    throw dictionaryError(400, 'Select a single word of up to 64 characters.', 'INVALID_WORD');
  }
  return word;
}

const text = (value, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const strings = (value, max = 8) => Array.isArray(value) ? value.filter(item => typeof item === 'string').map(item => text(item)).filter(Boolean).slice(0, max) : [];

function serializeEntry(raw, word) {
  if (!raw || !Array.isArray(raw.entries)) throw dictionaryError(502, 'The dictionary returned an invalid response. Please try again.', 'INVALID_DICTIONARY_RESPONSE');
  const entries = raw.entries.filter(entry => entry?.language?.code === 'en').slice(0, 12).map(entry => {
    const senses = [];
    const visit = (items, depth = 0) => {
      if (!Array.isArray(items) || depth > 4 || senses.length >= 60) return;
      for (const sense of items) {
        if (senses.length >= 60) break;
        const definition = text(sense?.definition);
        if (definition) senses.push({ definition, examples: strings(sense.examples, 2), synonyms: strings(sense.synonyms), tags: strings(sense.tags, 4) });
        visit(sense?.subsenses, depth + 1);
      }
    };
    visit(entry.senses);
    return { partOfSpeech: text(entry.partOfSpeech, 50), pronunciations: (Array.isArray(entry.pronunciations) ? entry.pronunciations : []).slice(0, 4).map(item => text(item?.text, 120)).filter(Boolean), senses };
  }).filter(entry => entry.senses.length);
  // An empty entries array is a real miss; malformed/non-English entries are not.
  if (raw.entries.length && !entries.length) throw dictionaryError(502, 'The dictionary returned no usable definitions. Please try again.', 'INVALID_DICTIONARY_RESPONSE');
  const defaultSource = `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#English`;
  const sourceUrl = typeof raw.source?.url === 'string' && raw.source.url.startsWith('https://en.wiktionary.org/wiki/') ? raw.source.url : defaultSource;
  return { word, found: entries.length > 0, entries, sourceUrl, provider: 'FreeDictionaryAPI.com', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' };
}

function createDictionaryService({ db = prisma, request = (url, options) => axios.get(url, options), clock = Date.now } = {}) {
  // Coalesce simultaneous lookups within this process; persistent cache is shared by all users/instances.
  const pending = new Map();
  let providerBlockedUntil = 0;

  async function load(word, resolveForms = true) {
    const where = { language_word: { language: 'en', word } };
    const cached = await db.dictionaryCache.findUnique({ where });
    if (cached && cached.expiresAt.getTime() > clock()) return cached.payload;
    if (clock() < providerBlockedUntil) throw dictionaryError(503, 'The dictionary is temporarily busy. Please try again later.', 'DICTIONARY_RATE_LIMITED');

    let raw;
    try {
      const response = await request(`${PROVIDER_URL}${encodeURIComponent(word)}?translations=false`, { timeout: 8000, maxRedirects: 0, maxContentLength: 1024 * 1024 });
      raw = response.data;
    } catch (error) {
      if (error.response?.status === 404) raw = { entries: [] };
      else {
        if (error.response?.status === 429) {
          const nextHour = (Math.floor(clock() / MISSING_TTL_MS) + 1) * MISSING_TTL_MS;
          const retrySeconds = Number(error.response?.headers?.['retry-after']);
          providerBlockedUntil = Number.isFinite(retrySeconds) && retrySeconds > 0 ? clock() + Math.min(retrySeconds, 3600) * 1000 : nextHour;
        }
        throw dictionaryError(503, error.response?.status === 429 ? 'The dictionary is temporarily busy. Please try again later.' : 'Unable to reach the dictionary. Please try again.', error.response?.status === 429 ? 'DICTIONARY_RATE_LIMITED' : 'DICTIONARY_UNAVAILABLE');
      }
    }
    let payload = serializeEntry(raw, word);
    // Wiktionary form entries often only say "simple past ... of infer".
    // Follow one explicit dictionary reference, never guess by stripping suffixes.
    const senses = payload.entries.flatMap(entry => entry.senses);
    if (resolveForms && senses.length && senses.every(sense => sense.tags.includes('form of'))) {
      const candidates = senses.map(sense => sense.definition.match(/\bof (\p{L}+(?:['-]\p{L}+)*)[.!]?$/u)?.[1]);
      const baseWord = candidates[0];
      if (baseWord && baseWord !== word && candidates.every(candidate => candidate === baseWord)) {
        const base = await load(normalizeWord(baseWord), false);
        if (base.found) payload = { ...base, word, baseWord };
      }
    }
    const fetchedAt = new Date(clock());
    const data = { found: payload.found, payload, fetchedAt, expiresAt: new Date(fetchedAt.getTime() + (payload.found ? FOUND_TTL_MS : MISSING_TTL_MS)) };
    await db.dictionaryCache.upsert({ where, create: { language: 'en', word, ...data }, update: data });
    return payload;
  }

  async function lookup(input) {
    const word = normalizeWord(input);
    if (pending.has(word)) return pending.get(word);
    if (pending.size >= 100) throw dictionaryError(503, 'The dictionary is busy. Please try again shortly.', 'DICTIONARY_BUSY');
    const task = load(word);
    pending.set(word, task);
    try { return await task; } finally { pending.delete(word); }
  }
  return { lookup };
}

module.exports = { ...createDictionaryService(), createDictionaryService, normalizeWord, serializeEntry, FOUND_TTL_MS, MISSING_TTL_MS };
