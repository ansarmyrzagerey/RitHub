-- Add quiz_attempts table for tracking participant quiz submissions

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}',
    score DECIMAL(5,2),
    grading_status VARCHAR(50) DEFAULT 'pending_grading' CHECK (grading_status IN ('pending_grading', 'graded', 'auto_graded')),
    graded_by INTEGER REFERENCES users(id),
    graded_at TIMESTAMP,
    feedback TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_grading_status ON quiz_attempts(grading_status);

-- Add unique constraint to prevent duplicate attempts (one attempt per user per quiz)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_attempts_unique ON quiz_attempts(quiz_id, user_id);
