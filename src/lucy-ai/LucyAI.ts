/**
 * Lucy AI - Main Facade Class
 * Simplified interface to Lucy AI system
 * Based on Microsoft AI patterns
 */

import { LucyEngine, type LucyConfig, type ChatMessage, type ChatResponse } from './core';
import { 
  SentimentAnalyzer, 
  IntentClassifier, 
  EntityExtractor, 
  TextSummarizer,
  Translator 
} from './nlp';

/**
 * Lucy AI - Main class providing unified access to all AI capabilities
 */
export class LucyAI {
  // Core components
  public engine: LucyEngine;
  public sentiment: SentimentAnalyzer;
  public intent: IntentClassifier;
  public entities: EntityExtractor;
  public summarizer: TextSummarizer;
  public translator: Translator;

  constructor(config: LucyConfig) {
    // Initialize core engine
    this.engine = new LucyEngine(config);

    // Initialize NLP components
    this.sentiment = new SentimentAnalyzer();
    this.intent = new IntentClassifier();
    this.entities = new EntityExtractor();
    this.summarizer = new TextSummarizer();
    this.translator = new Translator();
  }

  /**
   * Main chat method with automatic intent detection
   */
  async chat(message: string): Promise<ChatResponse & {
    intent?: string;
    sentiment?: string;
    entities?: any[];
  }> {
    // Analyze message
    const primaryIntent = this.intent.getPrimaryIntent(message);
    const sentimentResult = this.sentiment.analyze(message);
    const extractedEntities = this.entities.extract(message);

    // Get AI response
    const response = await this.engine.chat(message);

    return {
      ...response,
      intent: primaryIntent.name,
      sentiment: sentimentResult.sentiment,
      entities: extractedEntities
    };
  }

  /**
   * Stream chat with analysis
   */
  async *chatStream(message: string): AsyncGenerator<string> {
    yield* this.engine.chatStream(message);
  }

  /**
   * Quick response - optimized for speed
   */
  async quickResponse(message: string): Promise<string> {
    const response = await this.engine.chat(message);
    return response.content;
  }

  /**
   * Analyze user message comprehensively
   */
  analyze(message: string): {
    intent: any;
    sentiment: any;
    entities: any[];
    summary?: string;
    language: string;
  } {
    return {
      intent: this.intent.getPrimaryIntent(message),
      sentiment: this.sentiment.analyze(message),
      entities: this.entities.extract(message),
      summary: message.length > 100 ? this.summarizer.generateTLDR(message) : undefined,
      language: this.translator.detectLanguage(message)
    };
  }

  /**
   * Clear conversation history
   */
  clear(): void {
    this.engine.clearHistory();
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return this.engine.getHistory();
  }

  /**
   * Switch LLM provider
   */
  switchProvider(provider: 'gemini' | 'yandex' | 'lmstudio', apiKey?: string): void {
    this.engine.switchProvider(provider, apiKey);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LucyConfig>): void {
    this.engine.updateConfig(config);
  }

  /**
   * Get current configuration
   */
  getConfig(): LucyConfig {
    return this.engine.getConfig();
  }
}

export default LucyAI;
