-- Migration: Add study questions tables (US 3.5)
-- This migration adds support for multiple questions per study, where each question
-- can have different artifacts and evaluation criteria

-- Study questions table
CREATE TABLE IF NOT EXISTS study_questions (
    id SERIAL PRIMARY KEY,
    study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Question artifacts junction table (which artifacts to compare in this question)
CREATE TABLE IF NOT EXISTS question_artifacts (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES study_questions(id) ON DELETE CASCADE,
    artifact_id INTEGER REFERENCES artifacts(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_id, artifact_id)
);

-- Question criteria table (evaluation criteria for each question)
CREATE TABLE IF NOT EXISTS question_criteria (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES study_questions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('predefined', 'custom')),
    scale VARCHAR(50) NOT NULL CHECK (scale IN ('likert_5', 'stars_5', 'binary', 'numeric')),
    description TEXT,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_study_questions_study ON study_questions(study_id);
CREATE INDEX IF NOT EXISTS idx_question_artifacts_question ON question_artifacts(question_id);
CREATE INDEX IF NOT EXISTS idx_question_artifacts_artifact ON question_artifacts(artifact_id);
CREATE INDEX IF NOT EXISTS idx_question_criteria_question ON question_criteria(question_id);

-- Add comment to document the purpose
COMMENT ON TABLE study_questions IS 'US 3.5: Stores questions for studies, allowing multiple questions per study with different artifacts and criteria';
COMMENT ON TABLE question_artifacts IS 'US 3.5: Junction table linking questions to artifacts (2-5 artifacts per question)';
COMMENT ON TABLE question_criteria IS 'US 3.5: Evaluation criteria specific to each question';
