/**
 * Lucy AI Engine - Core AI Processing System
 * Based on Microsoft AI Architecture
 * Adapted for CursorVerse by Lucy AI Team
 */

import { ModelManager } from './ModelManager';
import { ContextManager } from './ContextManager';
import { PromptOptimizer } from './PromptOptimizer';

export interface LucyConfig {
  provider: 'gemini' | 'yandex' | 'lmstudio' | 'lucy';
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  contextWindow?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed?: number;
  processingTime: number;
  metadata?: Record<string, any>;
}

/**
 * LucyEngine - Main AI Processing Engine
 * 
 * Features:
 * - Multi-provider support (Gemini, YandexGPT, LM Studio)
 * - Context management with memory
 * - Prompt optimization
 * - Intelligent caching
 * - Error handling and fallbacks
 */
export class LucyEngine {
  private modelManager: ModelManager;
  private contextManager: ContextManager;
  private promptOptimizer: PromptOptimizer;
  private config: LucyConfig;
  private conversationHistory: ChatMessage[] = [];

  constructor(config: LucyConfig) {
    this.config = config;
    this.modelManager = new ModelManager(config);
    this.contextManager = new ContextManager(config.contextWindow || 4096);
    this.promptOptimizer = new PromptOptimizer();
  }

  /**
   * Main chat method - process user message and return AI response
   */
  async chat(message: string, options?: Partial<LucyConfig>): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // Add user message to history
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now()
      };
      this.conversationHistory.push(userMessage);

      // Get relevant context
      const context = this.contextManager.getRelevantContext(message);

      // Optimize prompt
      const optimizedPrompt = this.promptOptimizer.optimize(message, context);

      // Get response from model
      const mergedConfig = { ...this.config, ...options };
      const response = await this.modelManager.generate(
        optimizedPrompt,
        mergedConfig
      );

      // Add assistant response to history
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        metadata: response.metadata
      };
      this.conversationHistory.push(assistantMessage);

      // Update context
      this.contextManager.addToContext(userMessage, assistantMessage);

      const processingTime = Date.now() - startTime;

      return {
        content: response.content,
        provider: this.config.provider,
        model: response.model || this.config.model || 'unknown',
        tokensUsed: response.tokensUsed,
        processingTime,
        metadata: response.metadata
      };
    } catch (error) {
      console.error('[LucyEngine] Chat error:', error);
      throw error;
    }
  }

  /**
   * Stream chat response for real-time output
   */
  async *chatStream(message: string, options?: Partial<LucyConfig>): AsyncGenerator<string> {
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now()
    };
    this.conversationHistory.push(userMessage);

    const context = this.contextManager.getRelevantContext(message);
    const optimizedPrompt = this.promptOptimizer.optimize(message, context);

    let fullResponse = '';
    const mergedConfig = { ...this.config, ...options };

    for await (const chunk of this.modelManager.generateStream(optimizedPrompt, mergedConfig)) {
      fullResponse += chunk;
      yield chunk;
    }

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now()
    };
    this.conversationHistory.push(assistantMessage);
    this.contextManager.addToContext(userMessage, assistantMessage);
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    this.contextManager.clear();
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Set system prompt for specialized behavior
   */
  setSystemPrompt(prompt: string): void {
    this.promptOptimizer.setSystemPrompt(prompt);
  }

  /**
   * Switch LLM provider on the fly
   */
  switchProvider(provider: 'gemini' | 'yandex' | 'lmstudio' | 'lucy', apiKey?: string): void {
    this.config.provider = provider;
    if (apiKey) {
      this.config.apiKey = apiKey;
    }
    this.modelManager = new ModelManager(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): LucyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LucyConfig>): void {
    this.config = { ...this.config, ...config };
    this.modelManager = new ModelManager(this.config);
  }
}

export default LucyEngine;
