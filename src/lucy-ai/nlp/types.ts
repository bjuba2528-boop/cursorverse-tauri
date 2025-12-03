/**
 * NLP Type Definitions
 */

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number; // -1 to 1
  confidence: number; // 0 to 1
}

export interface Intent {
  name: string;
  confidence: number;
  parameters?: Record<string, any>;
}

export interface Entity {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  compressionRatio: number;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
}
