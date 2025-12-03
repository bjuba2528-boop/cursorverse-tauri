/**
 * NLP Module - Natural Language Processing for Lucy AI
 * Based on Microsoft AI NLP best practices
 */

export { SentimentAnalyzer } from './SentimentAnalyzer';
export { IntentClassifier } from './IntentClassifier';
export { EntityExtractor } from './EntityExtractor';
export { TextSummarizer } from './TextSummarizer';
export { Translator } from './Translator';

export type { 
  SentimentResult, 
  Intent, 
  Entity, 
  SummaryResult,
  TranslationResult 
} from './types';
