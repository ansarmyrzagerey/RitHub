const LLMService = require('../llm/llm.service');
const { buildQuizPrompt } = require('../../prompts/templates');
const Logger = require('../../utils/logger');

/**
 * Quiz Service - Handles quiz generation logic
 */
class QuizService {
    constructor() {
        this.llmService = new LLMService();
    }

    /**
     * Generate a quiz using AI
     * @param {Object} params - Quiz generation parameters
     * @param {string} params.topic - The quiz topic (required)
     * @param {number} [params.questionCount=8] - Number of questions
     * @param {string} [params.proficiencyLevel='intermediate'] - beginner, intermediate, or expert
     * @param {string} [params.questionType='multiple-choice'] - multiple-choice, true-false, or open-ended
     * @returns {Promise<Object>} Generated quiz with questions array
     */
    async generateQuiz(params) {
        // Set defaults
        const questionCount = params.questionCount || 8;
        const proficiencyLevel = params.proficiencyLevel || 'intermediate';
        const questionType = params.questionType || 'multiple-choice';

        // Validate proficiency level
        const validLevels = ['beginner', 'intermediate', 'expert'];
        if (!validLevels.includes(proficiencyLevel)) {
            throw new Error(`Invalid proficiency level. Must be one of: ${validLevels.join(', ')}`);
        }

        // Validate question type
        const validTypes = ['multiple-choice', 'true-false', 'open-ended'];
        if (!validTypes.includes(questionType)) {
            throw new Error(`Invalid question type. Must be one of: ${validTypes.join(', ')}`);
        }

        // Validate question count
        if (questionCount < 1 || questionCount > 50) {
            throw new Error('Question count must be between 1 and 50');
        }

        Logger.info(`Generating ${questionType} quiz: ${questionCount} questions on "${params.topic}" (${proficiencyLevel})`);

        // Build the prompt
        const prompt = buildQuizPrompt({
            topic: params.topic,
            questionCount,
            proficiencyLevel,
            questionType,
        });

        try {
            // Call LLM service with quiz-generation task type
            const response = await this.llmService.generate(prompt, 'quiz-generation');

            // Parse the response
            const quiz = this.parseQuizResponse(response.content, questionType);

            Logger.info(`Successfully generated quiz with ${quiz.questions.length} questions`);

            return quiz;
        } catch (error) {
            Logger.error('Quiz generation failed', error);
            throw new Error(`Failed to generate quiz: ${error.message}`);
        }
    }

    /**
     * Parse and validate the quiz response from LLM
     * @private
     * @param {string} content - Raw LLM response
     * @param {string} questionType - Expected question type
     * @returns {Object} Parsed and validated quiz
     */
    parseQuizResponse(content, questionType) {
        try {
            // Remove any potential markdown code blocks
            let cleaned = content.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }

            const parsed = JSON.parse(cleaned);

            // Validate structure
            if (!parsed.questions || !Array.isArray(parsed.questions)) {
                throw new Error('Invalid response structure: missing questions array');
            }

            // Validate each question
            parsed.questions.forEach((q, index) => {
                if (!q.id || !q.question || !q.options) {
                    throw new Error(`Question ${index + 1} is missing required fields`);
                }

                // Validate options based on question type
                if (questionType === 'multiple-choice' && q.options.length !== 4) {
                    throw new Error(`Question ${index + 1} must have exactly 4 options for multiple-choice`);
                }
                if (questionType === 'true-false' && q.options.length !== 2) {
                    throw new Error(`Question ${index + 1} must have exactly 2 options for true-false`);
                }
                if (questionType === 'open-ended' && q.options.length !== 0) {
                    throw new Error(`Question ${index + 1} should have empty options array for open-ended`);
                }

                // Validate correctAnswer exists
                if (q.correctAnswer === undefined || q.correctAnswer === null) {
                    throw new Error(`Question ${index + 1} is missing correctAnswer`);
                }
            });

            return parsed;
        } catch (error) {
            throw new Error(`Failed to parse quiz response: ${error.message}`);
        }
    }
}

module.exports = QuizService;
