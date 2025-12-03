/**
 * Entity Extractor - Extract named entities from text
 * Based on Microsoft AI entity recognition
 */

import type { Entity } from './types';

export class EntityExtractor {
  /**
   * Extract entities from text
   */
  extract(text: string): Entity[] {
    const entities: Entity[] = [];

    // Extract emails
    entities.push(...this.extractEmails(text));

    // Extract URLs
    entities.push(...this.extractUrls(text));

    // Extract phone numbers
    entities.push(...this.extractPhoneNumbers(text));

    // Extract dates
    entities.push(...this.extractDates(text));

    // Extract file paths
    entities.push(...this.extractFilePaths(text));

    // Extract numbers
    entities.push(...this.extractNumbers(text));

    return entities;
  }

  /**
   * Extract emails
   */
  private extractEmails(text: string): Entity[] {
    const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    return this.extractWithRegex(text, regex, 'email');
  }

  /**
   * Extract URLs
   */
  private extractUrls(text: string): Entity[] {
    const regex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    return this.extractWithRegex(text, regex, 'url');
  }

  /**
   * Extract phone numbers
   */
  private extractPhoneNumbers(text: string): Entity[] {
    const regex = /(\+7|8)?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g;
    return this.extractWithRegex(text, regex, 'phone');
  }

  /**
   * Extract dates
   */
  private extractDates(text: string): Entity[] {
    const entities: Entity[] = [];

    // DD.MM.YYYY or DD/MM/YYYY
    const dateRegex = /\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/g;
    entities.push(...this.extractWithRegex(text, dateRegex, 'date'));

    // Month names
    const monthRegex = /\b(январ[ья]|феврал[ья]|март[а]?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|август[а]?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])\s+\d{4}\b/gi;
    entities.push(...this.extractWithRegex(text, monthRegex, 'date'));

    return entities;
  }

  /**
   * Extract file paths
   */
  private extractFilePaths(text: string): Entity[] {
    const entities: Entity[] = [];

    // Windows paths
    const winRegex = /[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g;
    entities.push(...this.extractWithRegex(text, winRegex, 'filepath'));

    // Unix paths
    const unixRegex = /(?:\/[^\/\s]+)+/g;
    entities.push(...this.extractWithRegex(text, unixRegex, 'filepath'));

    return entities;
  }

  /**
   * Extract numbers
   */
  private extractNumbers(text: string): Entity[] {
    const regex = /\b\d+(?:\.\d+)?\b/g;
    return this.extractWithRegex(text, regex, 'number');
  }

  /**
   * Helper method to extract entities using regex
   */
  private extractWithRegex(text: string, regex: RegExp, type: string): Entity[] {
    const entities: Entity[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      entities.push({
        type,
        value: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.9
      });
    }

    return entities;
  }

  /**
   * Get entities of specific type
   */
  getEntitiesByType(text: string, type: string): Entity[] {
    return this.extract(text).filter(entity => entity.type === type);
  }

  /**
   * Check if text contains specific entity type
   */
  hasEntityType(text: string, type: string): boolean {
    return this.getEntitiesByType(text, type).length > 0;
  }
}

export default EntityExtractor;
