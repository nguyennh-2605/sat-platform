const test = require('node:test');
const assert = require('node:assert/strict');
const { createDictionaryService, normalizeWord, FOUND_TTL_MS, MISSING_TTL_MS } = require('../src/services/dictionary.service');

const definition = word => ({ data: { word, entries: [{ language: { code: 'en' }, partOfSpeech: 'adjective', pronunciations: [{ text: '/test/' }], senses: [{ definition: 'Having mixed feelings.', examples: ['An example.'], synonyms: ['uncertain'], subsenses: [{ definition: 'A second meaning.' }] }] }], source: { url: `https://en.wiktionary.org/wiki/${word}` } } });
function fixture() {
  const rows = new Map();
  const writes = [];
  let now = Date.parse('2026-10-07T10:00:00Z');
  const db = { dictionaryCache: {
    findUnique: async ({ where }) => rows.get(where.language_word.word) ?? null,
    upsert: async input => { writes.push(input); rows.set(input.create.word, input.create); return input.create; },
  } };
  return { db, rows, writes, clock: () => now, advance: milliseconds => { now += milliseconds; } };
}

test('dictionary normalizes casing, Unicode and apostrophes; rejects phrases and URLs before requesting', async () => {
  assert.equal(normalizeWord(' AMBIVALENT '), 'ambivalent');
  assert.equal(normalizeWord('façade'), 'façade');
  assert.equal(normalizeWord('don’t'), "don't");
  const { db } = fixture();
  const service = createDictionaryService({ db, request: () => assert.fail('Invalid words must not call upstream') });
  for (const word of ['two words', 'https://example.com', '../hello', 'x'.repeat(65), '', '123']) {
    await assert.rejects(service.lookup(word), error => error.statusCode === 400);
  }
});

test('persistent results are reused across service instances/users for 30 days, then refreshed', async () => {
  const data = fixture();
  let calls = 0;
  const request = async () => { calls++; return definition('ambivalent'); };
  const first = createDictionaryService({ ...data, request });
  const second = createDictionaryService({ ...data, request });
  const result = await first.lookup('Ambivalent');
  assert.equal(result.found, true);
  assert.equal(result.entries[0].senses.length, 2);
  assert.equal(data.writes[0].create.expiresAt - data.writes[0].create.fetchedAt, FOUND_TTL_MS);
  assert.deepEqual(await second.lookup('ambivalent'), result);
  assert.equal(calls, 1);
  data.advance(FOUND_TTL_MS);
  await second.lookup('ambivalent');
  assert.equal(calls, 2);
});

test('simultaneous requests for the same normalized word share one upstream call', async () => {
  const data = fixture();
  let calls = 0;
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  const service = createDictionaryService({ ...data, request: async () => { calls++; await ready; return definition('ambivalent'); } });
  const requests = [service.lookup('ambivalent'), service.lookup('AMBIVALENT'), service.lookup(' ambivalent ')];
  release();
  const results = await Promise.all(requests);
  assert.equal(calls, 1);
  assert.equal(data.writes.length, 1);
  assert.deepEqual(results[0], results[2]);
});

test('a genuine miss expires after one hour; malformed responses are never cached as misses', async () => {
  const data = fixture();
  let calls = 0;
  const service = createDictionaryService({ ...data, request: async () => { calls++; return { data: { entries: [] } }; } });
  assert.equal((await service.lookup('missing')).found, false);
  await service.lookup('missing');
  assert.equal(calls, 1);
  assert.equal(data.writes[0].create.expiresAt - data.writes[0].create.fetchedAt, MISSING_TTL_MS);
  data.advance(MISSING_TTL_MS);
  await service.lookup('missing');
  assert.equal(calls, 2);
  const broken = createDictionaryService({ ...data, request: async () => ({ data: { error: 'Bad gateway' } }) });
  await assert.rejects(broken.lookup('broken'), error => error.statusCode === 502);
  assert.equal(data.rows.has('broken'), false);
});

test('timeouts and 500 errors preserve expired definitions and allow a later retry', async () => {
  const data = fixture();
  let fail = false;
  const service = createDictionaryService({ ...data, request: async () => { if (fail) throw new Error('timeout'); return definition('ambivalent'); } });
  await service.lookup('ambivalent');
  const stored = data.rows.get('ambivalent');
  data.advance(FOUND_TTL_MS + 1);
  fail = true;
  await assert.rejects(service.lookup('ambivalent'), error => error.statusCode === 503);
  assert.equal(data.rows.get('ambivalent'), stored);
  fail = false;
  assert.equal((await service.lookup('ambivalent')).found, true);
});

test('upstream 429 temporarily pauses misses while continuing to serve database hits', async () => {
  const data = fixture();
  let calls = 0;
  const service = createDictionaryService({ ...data, request: async () => {
    calls++;
    if (calls === 1) return definition('ambivalent');
    throw { response: { status: 429, headers: { 'retry-after': '60' } } };
  } });
  await service.lookup('ambivalent');
  await assert.rejects(service.lookup('new'), error => error.body.code === 'DICTIONARY_RATE_LIMITED');
  await assert.rejects(service.lookup('other'), error => error.body.code === 'DICTIONARY_RATE_LIMITED');
  assert.equal((await service.lookup('ambivalent')).found, true);
  assert.equal(calls, 2);
  assert.equal(data.rows.has('new'), false);
  data.advance(61_000);
  await assert.rejects(service.lookup('other'));
  assert.equal(calls, 3);
});

test('an explicit inflection uses the base definition and reuses its database cache', async () => {
  const data = fixture();
  const requested = [];
  const service = createDictionaryService({ ...data, request: async url => {
    requested.push(url);
    return url.includes('/inferred?') ? { data: { entries: [{ language: { code: 'en' }, partOfSpeech: 'verb', senses: [{ definition: 'simple past and past participle of infer', tags: ['form of'] }] }] } } : definition('infer');
  } });
  await service.lookup('infer');
  const result = await service.lookup('inferred');
  assert.equal(result.word, 'inferred');
  assert.equal(result.baseWord, 'infer');
  assert.equal(result.entries[0].senses[0].definition, 'Having mixed feelings.');
  assert.equal(requested.length, 2);
});
