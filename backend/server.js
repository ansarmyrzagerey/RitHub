const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Email service initialization - Fixed
console.log('Email service loaded successfully');

// Deadline enforcement service
const { startDeadlineEnforcement } = require('./services/deadlineEnforcementService');
const { startDeadlineNotifications } = require('./services/deadlineNotificationService');
// Scheduled cleanup service (US 2.8)
const scheduledCleanupService = require('./services/scheduledCleanupService');

// Error handling middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Handle malformed JSON body errors
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  next(err);
});

// Serve static files from uploads directory
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'RitHub API is running' });
});

// Routes
app.use('/api/users', require('./routes/users'));
// Auth routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/artifacts', require('./routes/artifacts'));
app.use('/api/artifacts', require('./routes/importProgress')); // SSE progress tracking
app.use('/api/collections', require('./routes/collections'));
app.use('/api/artifact-sets', require('./routes/artifactSets'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/badges', require('./routes/badges'));
// Participant-specific routes (participant dashboard endpoints)
app.use('/api/participant', require('./routes/participant'));

app.use('/api/researcher', require('./routes/researcher'));
// Admin routes (US 2.7)
app.use('/api/admin', require('./routes/admin'));
// Study routes
app.use('/api/studies', require('./routes/studies'));
// Analysis routes (US 2.5)
app.use('/api/analysis', require('./routes/analysis'));
// External tools API (US 2.9)
app.use('/api/external', require('./routes/externalTools'));
app.use('/api/studies', require('./routes/taskGeneration'));
// app.use('/api/evaluations', require('./routes/evaluations'));

// OpenAI routes
app.use('/api/quiz', require('./routes/quiz.routes'));
app.use('/api/artifact', require('./routes/artifact.routes'));
app.use('/api/metrics', require('./routes/metrics.routes'));
// Reviewer routes
app.use('/api/reviewer', require('./routes/reviewer'));

// Error handling middleware
app.use((err, req, res, next) => {
  // Handle JSON parse errors specifically
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    console.error('Malformed JSON:', err.message);
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  next(err);
});

// 404 handler - must come after all routes
app.use(notFoundHandler);

// Global error handling middleware - must be last
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`);

    // Start deadline enforcement service
    startDeadlineEnforcement();

    // Start deadline notification service
    startDeadlineNotifications();

    // Start scheduled cleanup service (US 2.8)
    // Run cleanup every 24 hours
    scheduledCleanupService.start(24);

    // Start study trash bin cleanup service
    const studyCleanupService = require('./services/studyCleanupService');
    studyCleanupService.start();
  });
}

module.exports = app;
