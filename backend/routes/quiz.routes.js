const express = require('express');
const QuizService = require('../services/quiz/quiz.service');

const router = express.Router();
const quizService = new QuizService();

/**
 * POST /api/quiz/generate
 * Generate a quiz using AI
 * 
 * Request body:
 * {
 *   "topic": "JavaScript ES6",           // Required
 *   "questionCount": 8,                  // Optional, default 8
 *   "proficiencyLevel": "intermediate",  // Optional, default "intermediate"
 *   "questionType": "multiple-choice"    // Optional, default "multiple-choice"
 * }
 */
router.post('/generate', async (req, res) => {
    try {
        const { topic, questionCount, proficiencyLevel, questionType } = req.body;

        // Validate required fields
        if (!topic || typeof topic !== 'string' || topic.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Topic is required and must be a non-empty string',
            });
        }

        // Generate quiz
        const quiz = await quizService.generateQuiz({
            topic: topic.trim(),
            questionCount,
            proficiencyLevel,
            questionType,
        });

        res.json({
            success: true,
            data: quiz,
        });
    } catch (error) {
        console.error('Quiz generation error:', error);

        // Return appropriate status code based on error type
        const statusCode = error.message.includes('Invalid') ? 400 : 500;

        res.status(statusCode).json({
            success: false,
            error: error.message || 'Failed to generate quiz',
        });
    }
});

module.exports = router;
