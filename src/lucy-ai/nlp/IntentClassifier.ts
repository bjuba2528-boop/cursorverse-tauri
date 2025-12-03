/**
 * Intent Classifier - Classify user intentions
 * Based on Microsoft AI intent recognition patterns
 */

import type { Intent } from './types';

interface IntentPattern {
  name: string;
  patterns: RegExp[];
  parameters?: string[];
}

export class IntentClassifier {
  private intents: IntentPattern[];

  constructor() {
    this.intents = [
      {
        name: 'search',
        patterns: [
          /найди|найти|поиск|search|find/i,
          /где находится|where is/i
        ]
      },
      {
        name: 'open_app',
        patterns: [
          /открой|открыть|запусти|запустить|open|launch/i,
          /включи|включить|start/i
        ]
      },
      {
        name: 'close_app',
        patterns: [
          /закрой|закрыть|выключи|выключить|close|quit|exit/i
        ]
      },
      {
        name: 'system_info',
        patterns: [
          /информация|info|статус|status/i,
          /сколько|how much|how many/i,
          /какой|what is/i
        ]
      },
      {
        name: 'help',
        patterns: [
          /помощь|помоги|help|assist/i,
          /как|how to|how can/i,
          /что ты умеешь|what can you do/i
        ]
      },
      {
        name: 'settings',
        patterns: [
          /настройки|настрой|settings|configure/i,
          /измени|изменить|change|modify/i
        ]
      },
      {
        name: 'create',
        patterns: [
          /создай|создать|create|make|new/i,
          /сгенерируй|сгенерировать|generate/i
        ]
      },
      {
        name: 'analyze',
        patterns: [
          /анализ|проанализируй|analyze|check/i,
          /посмотри|посмотреть|look at|examine/i
        ]
      },
      {
        name: 'translate',
        patterns: [
          /перевод|переведи|translate/i
        ]
      },
      {
        name: 'code',
        patterns: [
          /код|программа|script|function/i,
          /напиши код|write code/i
        ]
      },
      {
        name: 'explain',
        patterns: [
          /объясни|объяснить|explain|describe/i,
          /расскажи|рассказать|tell me about/i
        ]
      },
      {
        name: 'chat',
        patterns: [
          /привет|здравствуй|hello|hi/i,
          /как дела|how are you/i,
          /спасибо|thanks|thank you/i
        ]
      }
    ];
  }

  /**
   * Classify user intent from text
   */
  classify(text: string): Intent[] {
    const results: Intent[] = [];

    for (const intent of this.intents) {
      let matched = false;
      let confidence = 0;

      for (const pattern of intent.patterns) {
        if (pattern.test(text)) {
          matched = true;
          confidence = Math.max(confidence, 0.8);
        }
      }

      if (matched) {
        results.push({
          name: intent.name,
          confidence,
          parameters: this.extractParameters(text, intent)
        });
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    // If no intents matched, return generic chat intent
    if (results.length === 0) {
      results.push({
        name: 'chat',
        confidence: 0.5
      });
    }

    return results;
  }

  /**
   * Get primary intent
   */
  getPrimaryIntent(text: string): Intent {
    const intents = this.classify(text);
    return intents[0];
  }

  /**
   * Check if text matches specific intent
   */
  hasIntent(text: string, intentName: string): boolean {
    const intents = this.classify(text);
    return intents.some(intent => intent.name === intentName);
  }

  /**
   * Extract parameters from text based on intent
   */
  private extractParameters(text: string, intent: IntentPattern): Record<string, any> | undefined {
    const params: Record<string, any> = {};

    // Extract app names for open/close intents
    if (intent.name === 'open_app' || intent.name === 'close_app') {
      const appMatch = text.match(/(?:открой|запусти|закрой|open|launch|close)\s+([а-яa-z0-9\s]+)/i);
      if (appMatch) {
        params.appName = appMatch[1].trim();
      }
    }

    // Extract search query
    if (intent.name === 'search') {
      const searchMatch = text.match(/(?:найди|найти|поиск|search|find)\s+(.+)/i);
      if (searchMatch) {
        params.query = searchMatch[1].trim();
      }
    }

    // Extract languages for translation
    if (intent.name === 'translate') {
      const langMatch = text.match(/(?:на|to)\s+(английский|русский|spanish|french|german|english|russian)/i);
      if (langMatch) {
        params.targetLanguage = langMatch[1].trim();
      }
    }

    return Object.keys(params).length > 0 ? params : undefined;
  }

  /**
   * Add custom intent pattern
   */
  addIntent(name: string, patterns: RegExp[]): void {
    this.intents.push({
      name,
      patterns
    });
  }

  /**
   * Get all registered intents
   */
  getIntents(): string[] {
    return this.intents.map(intent => intent.name);
  }
}

export default IntentClassifier;
