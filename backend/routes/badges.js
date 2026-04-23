const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth, requireResearcher } = require('../middleware/auth');

// GET /api/badges - Get all badges
router.get('/', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, description FROM badges ORDER BY name ASC');
        res.json({ success: true, badges: result.rows });
    } catch (error) {
        console.error('Error fetching badges:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch badges' });
    }
});

// POST /api/badges - Create new badge (researcher only)
router.post('/', auth, requireResearcher, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Badge name is required' });
        }

        const result = await pool.query(
            'INSERT INTO badges (name, description, created_at) VALUES ($1, $2, NOW()) RETURNING id, name, description',
            [name.trim(), description?.trim() || '']
        );

        res.status(201).json({
            success: true,
            message: 'Badge created successfully',
            badge: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating badge:', error);
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({ success: false, message: 'A badge with this name already exists' });
        }
        res.status(500).json({ success: false, message: 'Failed to create badge' });
    }
});

// GET /api/badges/my-badges - Get current user's earned badges
router.get('/my-badges', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ub.id, ub.earned_at, b.id as badge_id, b.name, b.description, 
                    q.id as quiz_id, q.title as quiz_title
             FROM user_badges ub
             JOIN badges b ON ub.badge_id = b.id
             LEFT JOIN quizzes q ON ub.earned_from_quiz_id = q.id
             WHERE ub.user_id = $1
             ORDER BY ub.earned_at DESC`,
            [req.user.id]
        );

        res.json({ success: true, badges: result.rows });
    } catch (error) {
        console.error('Error fetching user badges:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch badges' });
    }
});

module.exports = router;
