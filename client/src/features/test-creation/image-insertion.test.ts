import { describe, expect, it } from 'vitest';
import { insertTestImage } from './image-insertion';

describe('structured test image placement', () => {
  it('fills the selected placeholder, preserving metadata and the following question', () => {
    const source = 'QUESTION 1\n[IMG]\n@meta {"alt":"Triangle"}\n\n[QUESTION]\nFind x.\nAnswer: 4';
    const cursor = source.indexOf('@meta');
    const result = insertTestImage(source, cursor, cursor, 'new-image');
    expect(result.text).toBe('QUESTION 1\n[IMG]\n@meta {"alt":"Triangle"}\nasset:new-image\n\n[QUESTION]\nFind x.\nAnswer: 4');
    expect(result.text.slice(result.cursor)).toBe('[QUESTION]\nFind x.\nAnswer: 4');
  });

  it('replaces only the image in the selected block, including CRLF imports', () => {
    const source = '[IMG]\r\nasset:first\r\n\r\n[IMG]\r\n@meta {"alt":"Graph"}\r\nasset:second\r\n\r\nQUESTION 2\r\nText';
    const start = source.indexOf('asset:second');
    const result = insertTestImage(source, start, start + 'asset:second'.length, 'replacement');
    expect(result.text).toContain('asset:first\r\n');
    expect(result.text).toContain('@meta {"alt":"Graph"}');
    expect(result.text).toContain('asset:replacement');
    expect(result.text).not.toContain('asset:second');
    expect(result.text).toContain('QUESTION 2\r\nText');
    expect(result.text.match(/\[IMG\]/g)).toHaveLength(2);
  });

  it('inserts at a text selection without changing other image blocks', () => {
    const source = '[IMG]\nasset:first\n\n[TEXT]\nreplace me\n\n[QUESTION]\nFind x.';
    const start = source.indexOf('replace me');
    const result = insertTestImage(source, start, start + 'replace me'.length, 'new-image');
    expect(result.text).toContain('[IMG]\nasset:first');
    expect(result.text).toContain('[TEXT]\n\n[IMG]\nasset:new-image\n\n');
    expect(result.text).toContain('[QUESTION]\nFind x.');
    expect(result.text).not.toContain('replace me');
  });

  it('preserves legacy prompts without a QUESTION block marker', () => {
    const source = '[IMG]\nasset:old\n\nWhat is x?\nA. 1\nB. 2\nC. 3\nD. 4\nAnswer: B';
    const start = source.indexOf('asset:old');
    expect(insertTestImage(source, start, start, 'new').text).toBe(source.replace('asset:old', 'asset:new'));
    const prompt = source.indexOf('What is x?');
    expect(insertTestImage(source, prompt + 5, prompt + 5, 'new').text).toContain('asset:old');
    expect(insertTestImage(source, prompt + 5, prompt + 5, 'new').text.match(/\[IMG\]/g)).toHaveLength(2);
  });
});
