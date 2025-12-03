/**
 * Lucy AI - Advanced AI Assistant System
 * Based on Microsoft AI Architecture
 * Adapted for CursorVerse
 * 
 * @module lucy-ai
 * @version 1.0.0
 * @license MIT
 */

// Core AI Engine
export * from './core';

// Natural Language Processing
export * from './nlp';

// Main Lucy AI class for easy usage
import LucyAI from './LucyAI';
export { LucyAI };
export default LucyAI;
