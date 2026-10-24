import { describe, it, expect } from 'vitest';
import {
  buildMatchEntries,
  decorateHtmlWithTerms,
  stripDictionaryHighlightSpans,
  getTermSynonyms
} from './dictionary-matcher';
import type { DictionaryTerm } from '../types';

describe('Dictionary Matcher & Highlighting Engine', () => {
  const sampleTerms: DictionaryTerm[] = [
    {
      codename: 'term-ctx',
      term: 'Context OS',
      definition: 'Operating system for contextual markdown knowledge bases',
      synonyms: ['ContextOS', 'COS'],
    },
    {
      codename: 'term-ubiq',
      term: 'Ubiquitous Language',
      definition: 'Common terminology shared between domain experts and team',
      synonyms: ['Linguagem Ubíqua'],
    },
  ];

  it('getTermSynonyms aggregates synonyms and aliases uniquely', () => {
    const term: DictionaryTerm = {
      codename: 't1',
      term: 'Test',
      definition: 'A test term definition',
      synonyms: ['Syn1', 'Syn2'],
      aliases: ['Syn2', 'Alias1', ''],
    };

    const synonyms = getTermSynonyms(term);
    expect(synonyms).toContain('Syn1');
    expect(synonyms).toContain('Syn2');
    expect(synonyms).toContain('Alias1');
    expect(synonyms.length).toBe(3);
  });

  it('buildMatchEntries orders entries by phrase length descending', () => {
    const entries = buildMatchEntries(sampleTerms);
    expect(entries.length).toBeGreaterThan(0);

    for (let i = 0; i < entries.length - 1; i++) {
      expect(entries[i].phrase.length).toBeGreaterThanOrEqual(entries[i + 1].phrase.length);
    }
  });

  it('decorateHtmlWithTerms adds highlight spans for recognized terms without breaking tags', () => {
    const rawHtml = '<p>Welcome to Context OS and our Ubiquitous Language.</p>';
    const decorated = decorateHtmlWithTerms(rawHtml, sampleTerms);

    expect(decorated).toContain('class="dict-term-highlight"');
    expect(decorated).toContain('data-term-key="term-ctx"');
    expect(decorated).toContain('data-term-key="term-ubiq"');
  });

  it('stripDictionaryHighlightSpans cleanly removes spans preserving inner text', () => {
    const rawHtml = '<p>Welcome to Context OS and our Ubiquitous Language.</p>';
    const decorated = decorateHtmlWithTerms(rawHtml, sampleTerms);
    const stripped = stripDictionaryHighlightSpans(decorated);

    expect(stripped).toBe(rawHtml);
  });
});
