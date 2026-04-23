/**
 * Type definitions for OpenAI integration
 * These are JSDoc type definitions for use with JavaScript
 */

/**
 * @typedef {Object} QuizQuestion
 * @property {string} id - Unique identifier for the question
 * @property {string} question - The question text
 * @property {string[]} options - Array of answer options
 * @property {number} correctAnswer - Index of the correct answer
 * @property {string} [explanation] - Optional explanation of the answer
 */

/**
 * @typedef {Object} Quiz
 * @property {string} title - Quiz title
 * @property {string} description - Quiz description
 * @property {'easy'|'medium'|'hard'} difficulty - Difficulty level
 * @property {QuizQuestion[]} questions - Array of questions
 * @property {number} estimatedTime - Estimated time in minutes
 */

/**
 * @typedef {Object} ArtifactMetadata
 * @property {string} title - Artifact title
 * @property {string} description - Brief description
 * @property {string[]} tags - Array of tags
 * @property {string} createdAt - ISO date string
 */

/**
 * @typedef {Object} Artifact
 * @property {string} id - Unique identifier
 * @property {'code'|'document'|'diagram'|'other'} type - Artifact type
 * @property {string} content - The artifact content
 * @property {ArtifactMetadata} metadata - Artifact metadata
 */

/**
 * @typedef {Object} ArtifactAnalysis
 * @property {string} summary - Summary of the artifact
 * @property {string[]} strengths - List of strengths
 * @property {string[]} weaknesses - List of weaknesses
 * @property {string[]} suggestions - List of suggestions
 * @property {'low'|'medium'|'high'} complexity - Complexity level
 * @property {number} quality - Quality score 0-100
 */

/**
 * @typedef {Object} LLMRequest
 * @property {string} prompt - The prompt text
 * @property {string} [model] - Model to use
 * @property {number} [maxTokens] - Maximum tokens
 * @property {number} [temperature] - Temperature setting
 */

/**
 * @typedef {Object} TokenUsage
 * @property {number} prompt - Tokens used in prompt
 * @property {number} completion - Tokens used in completion
 * @property {number} total - Total tokens used
 */

/**
 * @typedef {Object} LLMResponse
 * @property {string} content - The response content
 * @property {string} model - Model used
 * @property {TokenUsage} tokensUsed - Token usage statistics
 * @property {string} finishReason - Why the response finished
 */

module.exports = {};
