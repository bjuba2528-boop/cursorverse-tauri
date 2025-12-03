/**
 * Sentiment Analyzer - Analyze emotional tone of text
 * Based on Microsoft AI sentiment analysis techniques
 */

import type { SentimentResult } from './types';

export class SentimentAnalyzer {
  private positiveWords: Set<string>;
  private negativeWords: Set<string>;

  constructor() {
    // Initialize sentiment lexicons
    this.positiveWords = new Set([
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like',
      'хорошо', 'отлично', 'прекрасно', 'замечательно', 'супер', 'круто', 'нравится'
    ]);

    this.negativeWords = new Set([
      'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'poor', 'worst',
      'плохо', 'ужасно', 'отвратительно', 'не нравится', 'хуже', 'хуже'
    ]);
  }

  /**
   * Analyze sentiment of text
   */
  analyze(text: string): SentimentResult {
    const words = this.tokenize(text.toLowerCase());
    
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      if (this.positiveWords.has(word)) positiveCount++;
      if (this.negativeWords.has(word)) negativeCount++;
    }

    // Calculate sentiment score
    const totalSentiment = positiveCount + negativeCount;
    let score = 0;
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';

    if (totalSentiment > 0) {
      score = (positiveCount - negativeCount) / totalSentiment;
      
      if (score > 0.2) {
        sentiment = 'positive';
      } else if (score < -0.2) {
        sentiment = 'negative';
      }
    }

    // Calculate confidence based on word count
    const confidence = Math.min(1, totalSentiment / 5);

    return {
      sentiment,
      score,
      confidence
    };
  }

  /**
   * Batch analyze multiple texts
   */
  analyzeBatch(texts: string[]): SentimentResult[] {
    return texts.map(text => this.analyze(text));
  }

  /**
   * Get overall sentiment trend from conversation
   */
  analyzeTrend(texts: string[]): {
    overallSentiment: 'positive' | 'negative' | 'neutral';
    trend: 'improving' | 'declining' | 'stable';
    scores: number[];
  } {
    const results = this.analyzeBatch(texts);
    const scores = results.map(r => r.score);
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const overallSentiment = avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral';

    // Calculate trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (scores.length >= 3) {
      const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
      const secondHalf = scores.slice(Math.floor(scores.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (secondAvg - firstAvg > 0.1) trend = 'improving';
      else if (firstAvg - secondAvg > 0.1) trend = 'declining';
    }

    return {
      overallSentiment,
      trend,
      scores
    };
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0400-\u04FF]/g, ' ') // Keep Cyrillic
      .split(/\s+/)
      .filter(word => word.length > 0);
  }
}

export default SentimentAnalyzer;
