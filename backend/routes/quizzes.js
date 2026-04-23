const express = require('express');
const router = express.Router();
const Quiz = require('../models/quiz');
const QuizQuestion = require('../models/quizQuestion');
const { auth, requireResearcher } = require('../middleware/auth');
const quizGenerationService = require('../services/quizGenerationService');

// POST /api/quizzes/generate-ai - Generate quiz using AI
router.post('/generate-ai', auth, requireResearcher, async (req, res) => {
    try {
        const {
            title,
            description,
            topic,
            difficulty,
            numberOfQuestions,
            questionTypes,
            context
        } = req.body;

        const MAX_TOPIC_LENGTH = 100;
        const MAX_QUESTIONS = 20;
        const MAX_CONTEXT_LENGTH = 150;
        const MAX_TITLE_LENGTH = 50;

        // Trim and validate topic (required)
        const trimmedTopic = topic ? topic.trim() : '';
        if (!trimmedTopic) {
            return res.status(400).json({
                success: false,
                message: 'Topic is required'
            });
        }

        // Trim and validate title - use topic as fallback if empty
        const trimmedTitle = title ? title.trim() : '';
        let finalTitle = trimmedTitle;
        
        // If title is empty, use topic as fallback (truncated to max length)
        if (!finalTitle) {
            finalTitle = trimmedTopic.slice(0, MAX_TITLE_LENGTH);
        }

        // Validate title length
        if (finalTitle.length > MAX_TITLE_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Title must be ${MAX_TITLE_LENGTH} characters or less`
            });
        }

        // Validate topic length
        if (trimmedTopic.length > MAX_TOPIC_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Topic must be ${MAX_TOPIC_LENGTH} characters or less`
            });
        }

        // Validate context length
        if (context && context.length > MAX_CONTEXT_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Additional context must be ${MAX_CONTEXT_LENGTH} characters or less`
            });
        }

        // Validate number of questions
        const numQuestions = numberOfQuestions || 5;
        if (numQuestions < 1 || numQuestions > MAX_QUESTIONS) {
            return res.status(400).json({
                success: false,
                message: `Number of questions must be between 1 and ${MAX_QUESTIONS}`
            });
        }

        const result = await quizGenerationService.generateQuiz({
            title: title.slice(0, MAX_TITLE_LENGTH),
            description: description || '',
            topic: topic.slice(0, MAX_TOPIC_LENGTH),
            difficulty: difficulty || 'medium',
            numberOfQuestions: Math.min(Math.max(numQuestions, 1), MAX_QUESTIONS),
            questionTypes: questionTypes || ['multiple'],
            context: (context || '').slice(0, MAX_CONTEXT_LENGTH)
        });

        res.json(result);
    } catch (error) {
        console.error('AI quiz generation error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate quiz'
        });
    }
});

// GET /api/quizzes - Get all quizzes (for researchers)
router.get('/', auth, requireResearcher, async (req, res) => {
    try {
        const pool = require('../config/database');
        // Get quizzes with count of assigned studies
        const result = await pool.query(
            `SELECT q.*, 
                    COALESCE(sq.assigned_count, 0) as assigned_studies_count
             FROM quizzes q
             LEFT JOIN (
                 SELECT quiz_id, COUNT(*) as assigned_count 
                 FROM study_quizzes 
                 GROUP BY quiz_id
             ) sq ON q.id = sq.quiz_id
             WHERE q.created_by = $1 
             ORDER BY q.created_at DESC`,
            [req.user.id]
        );

        res.json({ success: true, quizzes: result.rows });
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch quizzes' });
    }
});

// GET /api/quizzes/:id - Get specific quiz
router.get('/:id', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        // Participants can only see published quizzes
        if (req.user.role === 'participant' && !quiz.is_published) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, quiz });
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch quiz' });
    }
});

// POST /api/quizzes - Create new quiz
router.post('/', auth, requireResearcher, async (req, res) => {
    try {
        const { studyId, title, description, isAIGenerated, isSkippable, isPassable, isGivingBadges, passingScore, requiredBadges, awardedBadges } = req.body;

        console.log('Creating quiz with data:', { studyId, title, description, isAIGenerated, isSkippable, isPassable, isGivingBadges, passingScore, requiredBadges, awardedBadges });

        // Validate required fields
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        const quiz = await Quiz.create({
            studyId: studyId || null,
            title,
            description: description || '',
            isAIGenerated: isAIGenerated || false,
            isSkippable: isSkippable || false,
            isPassable: isPassable || false,
            isGivingBadges: isGivingBadges || false,
            passingScore: passingScore || null,
            createdBy: req.user.id,
            requiredBadges: requiredBadges || [],
            awardedBadges: awardedBadges || []
        });

        console.log('Quiz created successfully:', quiz);

        res.status(201).json({
            success: true,
            message: 'Quiz created successfully',
            quiz
        });
    } catch (error) {
        console.error('Error creating quiz:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to create quiz',
            error: error.message
        });
    }
});

// PUT /api/quizzes/:id - Update quiz
router.put('/:id', auth, requireResearcher, async (req, res) => {
    try {
        const { title, description, isAIGenerated, isSkippable, isPassable, isGivingBadges, passingScore, requiredBadges, awardedBadges } = req.body;

        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        // Check ownership (only creator or admin can update)
        if (quiz.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Check if quiz is connected to ANY study (via junction table or legacy column)
        const isAssigned = await Quiz.isAssignedToAnyStudy(req.params.id);
        if (isAssigned || quiz.study_id !== null) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot edit quiz that is connected to a study' 
            });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (isAIGenerated !== undefined) updateData.is_ai_generated = isAIGenerated;
        if (isSkippable !== undefined) updateData.is_skippable = isSkippable;
        if (isPassable !== undefined) updateData.is_passable = isPassable;
        if (isGivingBadges !== undefined) updateData.is_giving_badges = isGivingBadges;
        if (passingScore !== undefined) updateData.passing_score = passingScore;

        const updatedQuiz = await Quiz.update(req.params.id, updateData, requiredBadges, awardedBadges);

        res.json({
            success: true,
            message: 'Quiz updated successfully',
            quiz: updatedQuiz
        });
    } catch (error) {
        console.error('Error updating quiz:', error);
        if (error.message === 'Cannot update published quiz') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to update quiz' });
    }
});

// POST /api/quizzes/:id/publish - Publish quiz
router.post('/:id/publish', auth, requireResearcher, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        // Check ownership
        if (quiz.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const publishedQuiz = await Quiz.publish(req.params.id);

        res.json({
            success: true,
            message: 'Quiz published successfully',
            quiz: publishedQuiz
        });
    } catch (error) {
        console.error('Error publishing quiz:', error);
        if (error.message === 'Quiz not found or already published') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to publish quiz' });
    }
});

// DELETE /api/quizzes/:id - Delete quiz
router.delete('/:id', auth, requireResearcher, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            console.log(`[Quiz Delete Route] Quiz ${req.params.id} not found`);
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        // Check ownership
        if (quiz.created_by !== req.user.id && req.user.role !== 'admin') {
            console.log(`[Quiz Delete Route] Access denied for user ${req.user.id} to delete quiz ${req.params.id}`);
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        console.log(`[Quiz Delete Route] User ${req.user.id} attempting to delete quiz ${req.params.id} (study_id: ${quiz.study_id})`);

        const deleted = await Quiz.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        console.log(`[Quiz Delete Route] Quiz ${req.params.id} deleted successfully`);
        res.json({ success: true, message: 'Quiz deleted successfully' });
    } catch (error) {
        console.error(`[Quiz Delete Route] Error deleting quiz ${req.params.id}:`, error.message);
        if (error.message === 'Cannot delete quiz that is connected to a study') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete quiz that is connected to a study. Please remove it from the study first.'
            });
        }
        if (error.message === 'Quiz not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to delete quiz' });
    }
});

// GET /api/quizzes/:id/eligibility - Check if user is eligible to take quiz
router.get('/:id/eligibility', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        if (!quiz.is_published) {
            return res.status(400).json({ success: false, message: 'Quiz is not published' });
        }

        const eligibility = await Quiz.checkUserEligibility(req.params.id, req.user.id);

        res.json({
            success: true,
            ...eligibility
        });
    } catch (error) {
        console.error('Error checking eligibility:', error);
        res.status(500).json({ success: false, message: 'Failed to check eligibility' });
    }
});

// GET /api/quizzes/:id/questions - Get all questions for a quiz
router.get('/:id/questions', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        // Participants can only see questions for published quizzes
        if (req.user.role === 'participant' && !quiz.is_published) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const questions = await QuizQuestion.findByQuizId(req.params.id);

        res.json({ success: true, questions });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch questions' });
    }
});

// POST /api/quizzes/:id/questions - Add question to quiz
router.post('/:id/questions', auth, requireResearcher, async (req, res) => {
    try {
        const { type, title, options, correctAnswer, isAbsolute, pointWeight, orderIndex } = req.body;

        // Validate required fields
        if (!type || !title) {
            return res.status(400).json({
                success: false,
                message: 'Type and title are required'
            });
        }

        if (!['multiple', 'open', 'code'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type must be one of: multiple, open, code'
            });
        }

        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        // Check ownership
        if (quiz.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const question = await QuizQuestion.create({
            quizId: req.params.id,
            type,
            title,
            options: options || null,
            correctAnswer: correctAnswer || null,
            isAbsolute: isAbsolute !== undefined ? isAbsolute : true,
            pointWeight: pointWeight || 1,
            orderIndex: orderIndex || 0
        });

        res.status(201).json({
            success: true,
            message: 'Question added successfully',
            question
        });
    } catch (error) {
        console.error('Error adding question:', error);
        if (error.message === 'Cannot add questions to published quiz') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to add question' });
    }
});

// PUT /api/quizzes/:quizId/questions/:questionId - Update question
router.put('/:quizId/questions/:questionId', auth, requireResearcher, async (req, res) => {
    try {
        const { type, title, options, correctAnswer, isAbsolute, pointWeight, orderIndex } = req.body;

        const quiz = await Quiz.findById(req.params.quizId);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        // Check ownership
        if (quiz.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const updateData = {};
        if (type !== undefined) updateData.type = type;
        if (title !== undefined) updateData.title = title;
        if (options !== undefined) updateData.options = options;
        if (correctAnswer !== undefined) updateData.correct_answer = correctAnswer;
        if (isAbsolute !== undefined) updateData.is_absolute = isAbsolute;
        if (pointWeight !== undefined) updateData.point_weight = pointWeight;
        if (orderIndex !== undefined) updateData.order_index = orderIndex;

        const updatedQuestion = await QuizQuestion.update(req.params.questionId, updateData);

        res.json({
            success: true,
            message: 'Question updated successfully',
            question: updatedQuestion
        });
    } catch (error) {
        console.error('Error updating question:', error);
        if (error.message === 'Cannot update questions in published quiz') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to update question' });
    }
});

// DELETE /api/quizzes/:quizId/questions/:questionId - Delete question
router.delete('/:quizId/questions/:questionId', auth, requireResearcher, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.quizId);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        // Check ownership
        if (quiz.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const deleted = await QuizQuestion.delete(req.params.questionId);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }

        res.json({ success: true, message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Error deleting question:', error);
        if (error.message === 'Cannot delete questions from published quiz') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to delete question' });
    }
});

// GET /api/quizzes/:id/required-badges - Get required badges for quiz
router.get('/:id/required-badges', auth, async (req, res) => {
    try {
        const pool = require('../config/database');
        const result = await pool.query(
            `SELECT b.id, b.name, b.description
             FROM quiz_required_badges qrb
             JOIN badges b ON qrb.badge_id = b.id
             WHERE qrb.quiz_id = $1`,
            [req.params.id]
        );

        res.json({ success: true, badges: result.rows });
    } catch (error) {
        console.error('Error fetching required badges:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch required badges' });
    }
});

// GET /api/quizzes/:id/awarded-badges - Get awarded badges for quiz
router.get('/:id/awarded-badges', auth, async (req, res) => {
    try {
        const pool = require('../config/database');
        const result = await pool.query(
            `SELECT b.id, b.name, b.description
             FROM quiz_awarded_badges qab
             JOIN badges b ON qab.badge_id = b.id
             WHERE qab.quiz_id = $1`,
            [req.params.id]
        );

        res.json({ success: true, badges: result.rows });
    } catch (error) {
        console.error('Error fetching awarded badges:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch awarded badges' });
    }
});

// GET /api/quizzes/:id/attempt - Get user's quiz attempt
// Optional query param: studyId - to get attempt for a specific study
router.get('/:id/attempt', auth, async (req, res) => {
    try {
        const pool = require('../config/database');
        const { studyId } = req.query;
        
        let result;
        if (studyId) {
            // First try to get attempt for specific study
            result = await pool.query(
                'SELECT id, quiz_id, user_id, study_id, score, passed, grading_status, submitted_at FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND study_id = $3 ORDER BY submitted_at DESC LIMIT 1',
                [req.params.id, req.user.id, studyId]
            );
            
            // If no study-specific attempt, check for legacy attempts (without study_id)
            // BUT only if this quiz was originally linked to this study
            if (result.rows.length === 0) {
                const quizOriginalStudy = await pool.query(
                    'SELECT study_id FROM quizzes WHERE id = $1',
                    [req.params.id]
                );
                const originalStudyId = quizOriginalStudy.rows[0]?.study_id;
                
                // Only use legacy attempt if this is the original study for this quiz
                if (originalStudyId && originalStudyId.toString() === studyId.toString()) {
                    result = await pool.query(
                        'SELECT id, quiz_id, user_id, study_id, score, passed, grading_status, submitted_at FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND study_id IS NULL ORDER BY submitted_at DESC LIMIT 1',
                        [req.params.id, req.user.id]
                    );
                }
            }
        } else {
            // Backward compatibility: get any attempt
            result = await pool.query(
                'SELECT id, quiz_id, user_id, study_id, score, passed, grading_status, submitted_at FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 ORDER BY submitted_at DESC LIMIT 1',
                [req.params.id, req.user.id]
            );
        }

        res.json({
            success: true,
            attempt: result.rows[0] || null
        });
    } catch (error) {
        console.error('Error fetching quiz attempt:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch quiz attempt' });
    }
});

// POST /api/quizzes/:id/submit - Submit quiz answers
router.post('/:id/submit', auth, async (req, res) => {
    try {
        const { answers, studyId } = req.body;
        const quizId = req.params.id;
        const userId = req.user.id;

        const pool = require('../config/database');

        // Check if user has already submitted this quiz for this specific study
        // If studyId is provided, check per-study; otherwise check globally (backward compatibility)
        let existingAttempt;
        if (studyId) {
            existingAttempt = await pool.query(
                'SELECT id FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND study_id = $3',
                [quizId, userId, studyId]
            );
        } else {
            existingAttempt = await pool.query(
                'SELECT id FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND study_id IS NULL',
                [quizId, userId]
            );
        }

        if (existingAttempt.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'You have already submitted this quiz for this study' });
        }

        // Get quiz and questions
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        if (!quiz.is_published) {
            return res.status(400).json({ success: false, message: 'Quiz is not published' });
        }

        const questions = await QuizQuestion.findByQuizId(quizId);

        // Check if quiz has manual grading questions
        const hasManualQuestions = questions.some(q => q.type === 'open' || q.type === 'code');

        // Calculate score for auto-gradable questions only
        let totalPoints = 0;
        let autoGradablePoints = 0;
        let earnedPoints = 0;
        let hasFailedAbsolute = false;

        questions.forEach(question => {
            totalPoints += question.point_weight || 1;
            const userAnswer = answers[question.id];

            if (question.type === 'multiple' && question.correct_answer !== null) {
                autoGradablePoints += question.point_weight || 1;
                if (userAnswer === question.correct_answer) {
                    earnedPoints += question.point_weight || 1;
                } else if (question.is_absolute) {
                    hasFailedAbsolute = true;
                }
            }
            // Open-ended and code questions need manual grading
        });

        let scorePercentage, passed, gradingStatus;

        if (hasManualQuestions) {
            // Partial score based on auto-graded questions only
            scorePercentage = autoGradablePoints > 0 ? (earnedPoints / autoGradablePoints) * 100 : 0;
            passed = null; // Will be determined after manual grading
            gradingStatus = 'pending_grading';
        } else {
            // Full auto-graded score
            scorePercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
            passed = !hasFailedAbsolute && scorePercentage >= (quiz.passing_score || 0);
            gradingStatus = 'auto_graded';
        }

        // Save attempt with study_id if provided
        const result = await pool.query(
            `INSERT INTO quiz_attempts (quiz_id, user_id, answers, score, passed, grading_status, study_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, quiz_id, user_id, score, passed, grading_status, submitted_at, study_id`,
            [quizId, userId, JSON.stringify(answers), scorePercentage, passed, gradingStatus, studyId || null]
        );

        const attempt = result.rows[0];

        // Award badges only if auto-graded and passed
        if (passed && quiz.is_giving_badges && gradingStatus === 'auto_graded') {
            try {
                await Quiz.awardBadges(quizId, userId);
            } catch (badgeError) {
                // Log error but don't fail the quiz submission
                console.error('Error awarding badges:', badgeError.message);
                // Continue with quiz submission even if badge award fails
            }
        }

        let message;
        if (gradingStatus === 'pending_grading') {
            message = 'Quiz submitted! Waiting for manual grading.';
        } else if (passed) {
            message = 'Quiz passed!';
        } else {
            message = 'Quiz completed';
        }

        res.json({
            success: true,
            message,
            attempt: {
                ...attempt,
                totalPoints,
                earnedPoints,
                autoGradablePoints,
                scorePercentage: Math.round(scorePercentage * 100) / 100,
                needsManualGrading: hasManualQuestions
            }
        });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.status(500).json({ success: false, message: 'Failed to submit quiz' });
    }
});

// GET /api/quizzes/:id/pending-attempts - Get attempts pending grading (researcher only)
router.get('/:id/pending-attempts', auth, requireResearcher, async (req, res) => {
    try {
        const pool = require('../config/database');
        const result = await pool.query(
            `SELECT qa.*, CONCAT(u.first_name, ' ', u.last_name) as participant_name, u.email as participant_email
             FROM quiz_attempts qa
             JOIN users u ON qa.user_id = u.id
             WHERE qa.quiz_id = $1 AND qa.grading_status = 'pending_grading'
             ORDER BY qa.submitted_at ASC`,
            [req.params.id]
        );

        res.json({
            success: true,
            attempts: result.rows
        });
    } catch (error) {
        console.error('Error fetching pending attempts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pending attempts' });
    }
});

// GET /api/quizzes/:id/attempts/:attemptId - Get specific attempt details (researcher only)
router.get('/:id/attempts/:attemptId', auth, requireResearcher, async (req, res) => {
    try {
        const pool = require('../config/database');
        const attemptResult = await pool.query(
            `SELECT qa.*, CONCAT(u.first_name, ' ', u.last_name) as participant_name, u.email as participant_email
             FROM quiz_attempts qa
             JOIN users u ON qa.user_id = u.id
             WHERE qa.id = $1 AND qa.quiz_id = $2`,
            [req.params.attemptId, req.params.id]
        );

        if (attemptResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Attempt not found' });
        }

        const attempt = attemptResult.rows[0];
        const questions = await QuizQuestion.findByQuizId(req.params.id);

        res.json({
            success: true,
            attempt,
            questions
        });
    } catch (error) {
        console.error('Error fetching attempt details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attempt details' });
    }
});

// POST /api/quizzes/:id/attempts/:attemptId/ai-grade - AI-assisted grading (researcher only)
router.post('/:id/attempts/:attemptId/ai-grade', auth, requireResearcher, async (req, res) => {
    try {
        const pool = require('../config/database');
        const gradingService = require('../services/gradingService');

        // Verify quiz exists and researcher owns it
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        // Check ownership (only creator or admin can use AI grading)
        if (quiz.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Get attempt
        const attemptResult = await pool.query(
            'SELECT * FROM quiz_attempts WHERE id = $1 AND quiz_id = $2',
            [req.params.attemptId, req.params.id]
        );

        if (attemptResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Attempt not found' });
        }

        const attempt = attemptResult.rows[0];
        const answers = attempt.answers || {};

        // Get questions and filter to open/code types only
        const questions = await QuizQuestion.findByQuizId(req.params.id);
        const gradableQuestions = questions.filter(q => q.type === 'open' || q.type === 'code');

        if (gradableQuestions.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No open-ended or code questions to grade' 
            });
        }

        // Map questions to include question_type field expected by gradingService
        const questionsForGrading = gradableQuestions.map(q => ({
            ...q,
            question_type: q.type
        }));

        // Call grading service
        const result = await gradingService.gradeAnswers({
            questions: questionsForGrading,
            answers
        });

        res.json(result);
    } catch (error) {
        console.error('AI grading error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'AI grading failed' 
        });
    }
});

// POST /api/quizzes/:id/attempts/:attemptId/grade - Grade manual questions (researcher only)
router.post('/:id/attempts/:attemptId/grade', auth, requireResearcher, async (req, res) => {
    try {
        const { manualScores } = req.body; // { questionId: points }
        const pool = require('../config/database');

        // Check if already graded
        const checkResult = await pool.query(
            'SELECT grading_status FROM quiz_attempts WHERE id = $1',
            [req.params.attemptId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Attempt not found' });
        }

        if (checkResult.rows[0].grading_status === 'graded') {
            return res.status(400).json({ success: false, message: 'This attempt has already been graded' });
        }

        // Get quiz and questions
        const quiz = await Quiz.findById(req.params.id);
        const questions = await QuizQuestion.findByQuizId(req.params.id);

        // Get attempt answers
        const attemptResult = await pool.query(
            'SELECT answers FROM quiz_attempts WHERE id = $1',
            [req.params.attemptId]
        );
        const answers = attemptResult.rows[0].answers;

        // Recalculate total score including manual grades
        let totalPoints = 0;
        let earnedPoints = 0;
        let hasFailedAbsolute = false;

        questions.forEach(question => {
            totalPoints += question.point_weight || 1;
            const userAnswer = answers[question.id];

            if (question.type === 'multiple' && question.correct_answer !== null) {
                // Auto-graded question
                if (userAnswer === question.correct_answer) {
                    earnedPoints += question.point_weight || 1;
                } else if (question.is_absolute) {
                    hasFailedAbsolute = true;
                }
            } else if (question.type === 'open' || question.type === 'code') {
                // Manual graded question
                const manualScore = manualScores[question.id] || 0;
                earnedPoints += manualScore;

                if (question.is_absolute && manualScore < (question.point_weight || 1)) {
                    hasFailedAbsolute = true;
                }
            }
        });

        const finalScore = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
        const passed = !hasFailedAbsolute && finalScore >= (quiz.passing_score || 0);

        // Update attempt
        const updateResult = await pool.query(
            `UPDATE quiz_attempts 
             SET score = $1, passed = $2, grading_status = 'graded', 
                 manual_scores = $3, graded_by = $4, graded_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [finalScore, passed, JSON.stringify(manualScores), req.user.id, req.params.attemptId]
        );

        const gradedAttempt = updateResult.rows[0];

        // Award badges if passed and quiz gives badges
        if (passed && quiz.is_giving_badges) {
            const userResult = await pool.query('SELECT user_id FROM quiz_attempts WHERE id = $1', [req.params.attemptId]);
            await Quiz.awardBadges(req.params.id, userResult.rows[0].user_id);
        }

        res.json({
            success: true,
            message: 'Quiz graded successfully',
            attempt: gradedAttempt
        });
    } catch (error) {
        console.error('Error grading attempt:', error);
        res.status(500).json({ success: false, message: 'Failed to grade attempt' });
    }
});

module.exports = router;
