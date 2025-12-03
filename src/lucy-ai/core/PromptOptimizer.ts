/**
 * Prompt Optimizer - Intelligent Prompt Engineering
 * Based on Microsoft AI prompt optimization strategies
 */

export class PromptOptimizer {
  private systemPrompt: string = '';
  private readonly MAX_CONTEXT_LENGTH = 3000;

  /**
   * Set system prompt for specialized behavior
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Optimize prompt with context and system instructions
   */
  optimize(userPrompt: string, context: string = ''): string {
    // Build optimized prompt structure
    let optimizedPrompt = '';

    // Add system prompt if set
    if (this.systemPrompt) {
      optimizedPrompt += `System Instructions:\n${this.systemPrompt}\n\n`;
    }

    // Add context if available (truncate if too long)
    if (context) {
      const truncatedContext = this.truncateContext(context);
      optimizedPrompt += `Previous Conversation Context:\n${truncatedContext}\n\n`;
    }

    // Add user prompt
    optimizedPrompt += `Current User Request:\n${userPrompt}\n\n`;

    // Add response format instructions
    optimizedPrompt += this.getResponseFormatInstructions();

    return optimizedPrompt;
  }

  /**
   * Optimize for specific task types
   */
  optimizeForTask(userPrompt: string, taskType: 'code' | 'analysis' | 'creative' | 'factual'): string {
    const taskPrompts = {
      code: `You are an expert programmer. Provide clear, well-commented code with explanations.\n\n`,
      analysis: `Provide detailed analysis with structured reasoning. Use bullet points and clear sections.\n\n`,
      creative: `Be creative and engaging. Use vivid descriptions and imaginative ideas.\n\n`,
      factual: `Provide accurate, factual information with sources when possible. Be concise and precise.\n\n`
    };

    return taskPrompts[taskType] + userPrompt;
  }

  /**
   * Add few-shot examples for better results
   */
  addFewShotExamples(userPrompt: string, examples: Array<{ input: string; output: string }>): string {
    let promptWithExamples = 'Here are some examples of the desired format:\n\n';

    for (let i = 0; i < examples.length; i++) {
      promptWithExamples += `Example ${i + 1}:\n`;
      promptWithExamples += `Input: ${examples[i].input}\n`;
      promptWithExamples += `Output: ${examples[i].output}\n\n`;
    }

    promptWithExamples += `Now, please respond to this:\nInput: ${userPrompt}\nOutput: `;

    return promptWithExamples;
  }

  /**
   * Truncate context to fit within limits
   */
  private truncateContext(context: string): string {
    if (context.length <= this.MAX_CONTEXT_LENGTH) {
      return context;
    }

    // Keep most recent messages (from the end)
    const truncated = context.slice(-this.MAX_CONTEXT_LENGTH);
    return '...' + truncated;
  }

  /**
   * Get response format instructions based on context
   */
  private getResponseFormatInstructions(): string {
    return `Please provide a helpful, accurate, and well-structured response. Format your answer clearly with proper sections if needed.`;
  }

  /**
   * Optimize for multilingual support
   */
  optimizeForLanguage(userPrompt: string, language: string): string {
    const languageInstructions: Record<string, string> = {
      'ru': 'Отвечай на русском языке. Будь точным и понятным.',
      'en': 'Respond in English. Be precise and clear.',
      'es': 'Responde en español. Sé preciso y claro.',
      'fr': 'Répondez en français. Soyez précis et clair.',
      'de': 'Antworte auf Deutsch. Sei präzise und klar.',
      'zh': '用中文回答。要准确清晰。',
      'ja': '日本語で答えてください。正確で明確に。'
    };

    const instruction = languageInstructions[language] || languageInstructions['en'];
    return `${instruction}\n\n${userPrompt}`;
  }

  /**
   * Add constraints to prompt
   */
  addConstraints(userPrompt: string, constraints: {
    maxLength?: number;
    format?: 'json' | 'markdown' | 'plain' | 'code';
    tone?: 'formal' | 'casual' | 'technical' | 'friendly';
  }): string {
    let constrainedPrompt = userPrompt + '\n\nConstraints:\n';

    if (constraints.maxLength) {
      constrainedPrompt += `- Keep response under ${constraints.maxLength} characters\n`;
    }

    if (constraints.format) {
      const formatInstructions = {
        json: 'Respond in valid JSON format',
        markdown: 'Use Markdown formatting',
        plain: 'Use plain text without formatting',
        code: 'Provide code with syntax highlighting'
      };
      constrainedPrompt += `- Format: ${formatInstructions[constraints.format]}\n`;
    }

    if (constraints.tone) {
      constrainedPrompt += `- Tone: ${constraints.tone}\n`;
    }

    return constrainedPrompt;
  }

  /**
   * Chain-of-thought prompting for complex reasoning
   */
  enableChainOfThought(userPrompt: string): string {
    return `Let's approach this step by step:

${userPrompt}

Please think through this carefully and show your reasoning process before providing the final answer.`;
  }

  /**
   * Self-consistency prompting for better accuracy
   */
  enableSelfConsistency(userPrompt: string): string {
    return `${userPrompt}

After providing your answer, please verify it and check for any potential errors or inconsistencies.`;
  }
}

export default PromptOptimizer;
