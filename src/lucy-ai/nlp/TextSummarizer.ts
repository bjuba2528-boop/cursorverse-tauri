/**
 * Text Summarizer - Summarize long texts
 * Based on Microsoft AI summarization techniques
 */

import type { SummaryResult } from './types';

export class TextSummarizer {
  /**
   * Summarize text using extractive approach
   */
  summarize(text: string, maxSentences: number = 3): SummaryResult {
    // Split into sentences
    const sentences = this.splitIntoSentences(text);

    if (sentences.length <= maxSentences) {
      return {
        summary: text,
        keyPoints: sentences,
        compressionRatio: 1.0
      };
    }

    // Score sentences by importance
    const scoredSentences = sentences.map(sentence => ({
      sentence,
      score: this.scoreSentence(sentence, sentences)
    }));

    // Sort by score and take top sentences
    scoredSentences.sort((a, b) => b.score - a.score);
    const topSentences = scoredSentences.slice(0, maxSentences);

    // Sort back by original order
    const originalOrder = topSentences.sort((a, b) => {
      return sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence);
    });

    const summary = originalOrder.map(s => s.sentence).join(' ');
    const keyPoints = originalOrder.map(s => s.sentence);

    return {
      summary,
      keyPoints,
      compressionRatio: summary.length / text.length
    };
  }

  /**
   * Extract key points from text
   */
  extractKeyPoints(text: string, count: number = 5): string[] {
    const sentences = this.splitIntoSentences(text);
    const scoredSentences = sentences.map(sentence => ({
      sentence,
      score: this.scoreSentence(sentence, sentences)
    }));

    scoredSentences.sort((a, b) => b.score - a.score);
    return scoredSentences.slice(0, count).map(s => s.sentence);
  }

  /**
   * Generate bullet-point summary
   */
  generateBulletPoints(text: string, count: number = 5): string[] {
    const keyPoints = this.extractKeyPoints(text, count);
    return keyPoints.map(point => `• ${point}`);
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short sentences
  }

  /**
   * Score sentence importance
   */
  private scoreSentence(sentence: string, allSentences: string[]): number {
    let score = 0;

    // Length score - prefer medium-length sentences
    const words = sentence.split(/\s+/).length;
    if (words >= 5 && words <= 20) {
      score += 2;
    }

    // Position score - first and last sentences are often important
    const index = allSentences.indexOf(sentence);
    if (index === 0 || index === allSentences.length - 1) {
      score += 3;
    }

    // Keyword score
    const keywords = ['важно', 'главное', 'основной', 'ключевой', 'необходимо', 
                     'important', 'key', 'main', 'essential', 'critical'];
    const lowerSentence = sentence.toLowerCase();
    for (const keyword of keywords) {
      if (lowerSentence.includes(keyword)) {
        score += 2;
      }
    }

    // Numerical data score
    if (/\d+/.test(sentence)) {
      score += 1;
    }

    // Question score - questions are often important
    if (sentence.includes('?')) {
      score += 1;
    }

    return score;
  }

  /**
   * Generate TL;DR (Too Long; Didn't Read) summary
   */
  generateTLDR(text: string): string {
    const summary = this.summarize(text, 1);
    return `TL;DR: ${summary.summary}`;
  }

  /**
   * Analyze text statistics
   */
  getStatistics(text: string): {
    characterCount: number;
    wordCount: number;
    sentenceCount: number;
    averageWordsPerSentence: number;
  } {
    const sentences = this.splitIntoSentences(text);
    const words = text.split(/\s+/).filter(w => w.length > 0);

    return {
      characterCount: text.length,
      wordCount: words.length,
      sentenceCount: sentences.length,
      averageWordsPerSentence: words.length / sentences.length
    };
  }
}

export default TextSummarizer;
