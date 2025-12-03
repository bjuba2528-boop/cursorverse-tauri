/**
 * Translator - Simple translation utilities
 * Based on Microsoft AI translation patterns
 */

import type { TranslationResult } from './types';

export class Translator {
  private languageCodes: Record<string, string> = {
    'русский': 'ru',
    'english': 'en',
    'английский': 'en',
    'spanish': 'es',
    'испанский': 'es',
    'french': 'fr',
    'французский': 'fr',
    'german': 'de',
    'немецкий': 'de',
    'chinese': 'zh',
    'китайский': 'zh',
    'japanese': 'ja',
    'японский': 'ja'
  };

  /**
   * Detect language of text
   */
  detectLanguage(text: string): string {
    // Simple heuristic-based detection
    const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
    const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
    const chineseCount = (text.match(/[\u4E00-\u9FFF]/g) || []).length;

    const total = text.length;
    const cyrillicRatio = cyrillicCount / total;
    const latinRatio = latinCount / total;
    const chineseRatio = chineseCount / total;

    if (cyrillicRatio > 0.3) return 'ru';
    if (chineseRatio > 0.3) return 'zh';
    if (latinRatio > 0.3) return 'en';

    return 'unknown';
  }

  /**
   * Translate text (placeholder - would use external API in production)
   */
  async translate(text: string, targetLanguage: string): Promise<TranslationResult> {
    const sourceLanguage = this.detectLanguage(text);
    const targetCode = this.languageCodes[targetLanguage.toLowerCase()] || targetLanguage;

    // This is a placeholder - in production, this would call a translation API
    // like Google Translate, Microsoft Translator, or DeepL

    return {
      translatedText: `[Translation to ${targetCode}]: ${text}`,
      sourceLanguage,
      targetLanguage: targetCode,
      confidence: 0.85
    };
  }

  /**
   * Get language code
   */
  getLanguageCode(language: string): string {
    return this.languageCodes[language.toLowerCase()] || language;
  }

  /**
   * Check if translation is needed
   */
  needsTranslation(text: string, targetLanguage: string): boolean {
    const detectedLanguage = this.detectLanguage(text);
    const targetCode = this.getLanguageCode(targetLanguage);
    return detectedLanguage !== targetCode;
  }
}

export default Translator;
