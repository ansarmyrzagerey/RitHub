const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const importJobManager = require('../services/importJobManager');

/**
 * GET /api/artifacts/bulk-import/:jobId/progress
 * Server-Sent Events endpoint for real-time import progress
 */
router.get('/bulk-import/:jobId/progress', async (req, res) => {
    const { jobId } = req.params;
    const { token } = req.query;

    // Verify token from query param (EventSource doesn't support headers)
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const job = importJobManager.getJob(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    // Verify ownership
    if (job.userId !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial progress
    res.write(`data: ${JSON.stringify(job.getProgress())}\n\n`);

    // Send progress updates every second
    const interval = setInterval(() => {
        const progress = job.getProgress();
        res.write(`data: ${JSON.stringify(progress)}\n\n`);

        // Close connection when done
        if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'error') {
            clearInterval(interval);
            res.end();
        }
    }, 1000);

    // Cleanup on client disconnect
    req.on('close', () => {
        clearInterval(interval);
    });
});

/**
 * DELETE /api/artifacts/bulk-import/:jobId
 * Cancel an ongoing import job
 */
router.delete('/bulk-import/:jobId', auth, (req, res) => {
    const { jobId } = req.params;
    const job = importJobManager.getJob(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    // Verify ownership
    if (job.userId !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    // Can only cancel running jobs
    if (job.status !== 'running' && job.status !== 'pending') {
        return res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
    }

    job.cancel();

    res.json({
        success: true,
        message: 'Import job cancelled',
        jobId: jobId
    });
});

module.exports = router;
