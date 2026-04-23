const express = require('express');
const metricsCollector = require('../utils/metrics');

const router = express.Router();

/**
 * GET /api/metrics
 * Get LLM usage metrics
 */
router.get('/', (req, res) => {
    try {
        const metrics = metricsCollector.getMetrics();
        res.json({
            success: true,
            data: metrics,
        });
    } catch (error) {
        console.error('Metrics retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve metrics',
        });
    }
});

/**
 * POST /api/metrics/reset
 * Reset all metrics counters
 */
router.post('/reset', (req, res) => {
    try {
        metricsCollector.reset();
        res.json({
            success: true,
            message: 'Metrics reset successfully',
        });
    } catch (error) {
        console.error('Metrics reset error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset metrics',
        });
    }
});

module.exports = router;
