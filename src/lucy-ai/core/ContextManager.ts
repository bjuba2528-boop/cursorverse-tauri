/**
 * Context Manager - Intelligent Context and Memory Management
 * Based on Microsoft AI context window optimization techniques
 */

import type { ChatMessage } from './LucyEngine';

interface ContextEntry {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  relevanceScore: number;
  embedding?: number[];
}

export class ContextManager {
  private maxContextTokens: number;
  private contextHistory: ContextEntry[] = [];
  private readonly TOKENS_PER_CHAR = 0.25; // Approximate

  constructor(maxContextTokens: number = 4096) {
    this.maxContextTokens = maxContextTokens;
  }

  /**
   * Add conversation pair to context
   */
  addToContext(userMessage: ChatMessage, assistantMessage: ChatMessage): void {
    const entry: ContextEntry = {
      userMessage,
      assistantMessage,
      relevanceScore: 1.0 // Most recent = highest relevance
    };

    this.contextHistory.push(entry);

    // Decay relevance scores of older messages
    this.decayRelevanceScores();

    // Trim context if exceeding token limit
    this.trimContext();
  }

  /**
   * Get relevant context for current query
   */
  getRelevantContext(_query: string): string {
    if (this.contextHistory.length === 0) {
      return '';
    }

    // Sort by relevance score and recency
    const sortedContext = [...this.contextHistory].sort((a, b) => {
      const scoreA = a.relevanceScore + (a.userMessage.timestamp / 1e12);
      const scoreB = b.relevanceScore + (b.userMessage.timestamp / 1e12);
      return scoreB - scoreA;
    });

    // Build context string within token limit
    let context = '';
    let tokenCount = 0;
    const maxTokensForContext = Math.floor(this.maxContextTokens * 0.6); // 60% for context

    for (const entry of sortedContext) {
      const entryText = `User: ${entry.userMessage.content}\nAssistant: ${entry.assistantMessage.content}\n\n`;
      const entryTokens = this.estimateTokens(entryText);

      if (tokenCount + entryTokens <= maxTokensForContext) {
        context = entryText + context; // Add to beginning for chronological order
        tokenCount += entryTokens;
      } else {
        break;
      }
    }

    return context.trim();
  }

  /**
   * Clear all context
   */
  clear(): void {
    this.contextHistory = [];
  }

  /**
   * Get context size in tokens
   */
  getContextSize(): number {
    let totalTokens = 0;
    for (const entry of this.contextHistory) {
      const entryText = `${entry.userMessage.content}\n${entry.assistantMessage.content}`;
      totalTokens += this.estimateTokens(entryText);
    }
    return totalTokens;
  }

  /**
   * Decay relevance scores over time
   */
  private decayRelevanceScores(): void {
    const decayFactor = 0.95; // 5% decay per message
    for (const entry of this.contextHistory) {
      entry.relevanceScore *= decayFactor;
    }
  }

  /**
   * Trim context to stay within token limit
   */
  private trimContext(): void {
    while (this.getContextSize() > this.maxContextTokens && this.contextHistory.length > 0) {
      // Remove lowest relevance entry
      let minIndex = 0;
      let minScore = this.contextHistory[0].relevanceScore;

      for (let i = 1; i < this.contextHistory.length; i++) {
        if (this.contextHistory[i].relevanceScore < minScore) {
          minScore = this.contextHistory[i].relevanceScore;
          minIndex = i;
        }
      }

      this.contextHistory.splice(minIndex, 1);
    }
  }

  /**
   * Estimate token count from text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length * this.TOKENS_PER_CHAR);
  }

  /**
   * Get context summary for debugging
   */
  getSummary(): {
    entryCount: number;
    tokenCount: number;
    maxTokens: number;
    utilizationPercent: number;
  } {
    const tokenCount = this.getContextSize();
    return {
      entryCount: this.contextHistory.length,
      tokenCount,
      maxTokens: this.maxContextTokens,
      utilizationPercent: (tokenCount / this.maxContextTokens) * 100
    };
  }
}

export default ContextManager;
