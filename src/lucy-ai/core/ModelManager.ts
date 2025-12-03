/**
 * Model Manager - Multi-provider LLM Management
 * Based on Microsoft AI best practices
 * Supports: Gemini, YandexGPT, LM Studio (LLaMA), Lucy AI (GitHub Models)
 */

import type { LucyConfig } from './LucyEngine';

interface GenerateResponse {
  content: string;
  model?: string;
  tokensUsed?: number;
  metadata?: Record<string, any>;
}

export class ModelManager {
  constructor(_config: LucyConfig) {
    // Config passed but not stored (using parameter config in methods)
  }

  /**
   * Generate response from selected LLM provider
   */
  async generate(prompt: string, config: LucyConfig): Promise<GenerateResponse> {
    switch (config.provider) {
      case 'gemini':
        return this.generateGemini(prompt, config);
      case 'yandex':
        return this.generateYandex(prompt, config);
      case 'lmstudio':
        return this.generateLMStudio(prompt, config);
      case 'lucy':
        return this.generateLucy(prompt, config);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Stream generation from selected LLM provider
   */
  async *generateStream(prompt: string, config: LucyConfig): AsyncGenerator<string> {
    switch (config.provider) {
      case 'gemini':
        yield* this.streamGemini(prompt, config);
        break;
      case 'yandex':
        yield* this.streamYandex(prompt, config);
        break;
      case 'lmstudio':
        yield* this.streamLMStudio(prompt, config);
        break;
      case 'lucy':
        yield* this.streamLucy(prompt, config);
        break;
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Google Gemini Provider
   */
  private async generateGemini(prompt: string, config: LucyConfig): Promise<GenerateResponse> {
    const apiKey = config.apiKey || '';
    const model = config.model || 'gemini-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 2048
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        content,
        model,
        tokensUsed: data.usageMetadata?.totalTokenCount,
        metadata: {
          provider: 'gemini',
          finishReason: data.candidates?.[0]?.finishReason
        }
      };
    } catch (error) {
      console.error('[ModelManager] Gemini error:', error);
      throw error;
    }
  }

  private async *streamGemini(prompt: string, config: LucyConfig): AsyncGenerator<string> {
    const apiKey = config.apiKey || '';
    const model = config.model || 'gemini-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: config.temperature || 0.7,
          maxOutputTokens: config.maxTokens || 2048
        }
      })
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * YandexGPT Provider
   */
  private async generateYandex(prompt: string, config: LucyConfig): Promise<GenerateResponse> {
    const apiKey = config.apiKey || '';
    const model = config.model || 'yandexgpt-lite';
    const url = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`
        },
        body: JSON.stringify({
          modelUri: `gpt://${model}`,
          completionOptions: {
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 2048
          },
          messages: [{
            role: 'user',
            text: prompt
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`YandexGPT API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.result?.alternatives?.[0]?.message?.text || '';

      return {
        content,
        model,
        tokensUsed: data.result?.usage?.totalTokens,
        metadata: {
          provider: 'yandex'
        }
      };
    } catch (error) {
      console.error('[ModelManager] YandexGPT error:', error);
      throw error;
    }
  }

  private async *streamYandex(prompt: string, config: LucyConfig): AsyncGenerator<string> {
    // YandexGPT doesn't support streaming yet, fallback to regular generation
    const response = await this.generateYandex(prompt, config);
    yield response.content;
  }

  /**
   * LM Studio (LLaMA) Provider - Local inference
   */
  private async generateLMStudio(prompt: string, config: LucyConfig): Promise<GenerateResponse> {
    const url = 'http://localhost:1234/v1/chat/completions';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model || 'local-model',
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 2048
        })
      });

      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        content,
        model: data.model || config.model || 'local-model',
        tokensUsed: data.usage?.total_tokens,
        metadata: {
          provider: 'lmstudio',
          finishReason: data.choices?.[0]?.finish_reason
        }
      };
    } catch (error) {
      console.error('[ModelManager] LM Studio error:', error);
      throw error;
    }
  }

  private async *streamLMStudio(prompt: string, config: LucyConfig): AsyncGenerator<string> {
    const url = 'http://localhost:1234/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model || 'local-model',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2048,
        stream: true
      })
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Lucy AI (GitHub Models) Provider - Free models from GitHub
   */
  private async generateLucy(prompt: string, config: LucyConfig): Promise<GenerateResponse> {
    const token = config.apiKey || '';
    const model = config.model || 'gpt-4o';
    const baseURL = 'https://models.inference.ai.azure.com';
    const url = `${baseURL}/chat/completions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 2048
        })
      });

      if (!response.ok) {
        throw new Error(`Lucy AI error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        content,
        model: data.model || model,
        tokensUsed: data.usage?.total_tokens,
        metadata: {
          provider: 'lucy',
          finishReason: data.choices?.[0]?.finish_reason
        }
      };
    } catch (error) {
      console.error('[ModelManager] Lucy AI error:', error);
      throw error;
    }
  }

  private async *streamLucy(prompt: string, config: LucyConfig): AsyncGenerator<string> {
    const token = config.apiKey || '';
    const model = config.model || 'gpt-4o';
    const baseURL = 'https://models.inference.ai.azure.com';
    const url = `${baseURL}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2048,
        stream: true
      })
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

export default ModelManager;
