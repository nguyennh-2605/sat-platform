import { createContext } from 'react';

export const DictionaryContext = createContext<{ selectedWord: string | null; lookUp: () => void } | null>(null);

export function normalizeSelectedWord(value: string) {
  const word = value.normalize('NFC').trim().replace(/^[\s"'‘’“”()[\]{},.!?:;]+|[\s"'‘’“”()[\]{},.!?:;]+$/g, '').toLowerCase().replaceAll('’', "'").replace(/[‐‑]/g, '-');
  return word.length <= 64 && /^\p{L}+(?:['-]\p{L}+)*$/u.test(word) ? word : null;
}
