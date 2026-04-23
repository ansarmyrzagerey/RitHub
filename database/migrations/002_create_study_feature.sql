-- Migration: Create Study Feature
-- This migration adds comprehensive study management capabilities including:
-- - Extended studies table with deadline, capacity, enrollment, and cancellation support
-- - Study-artifact relationships
-- - Study evaluation criteria
-- - Artifact sets for reusability
-- - Study state transition audit logging

-- Drop existing studies table and recreate with extended schema
DROP TABLE IF EXISTS study_participants CASCADE;
DROP TABLE IF EXISTS evaluation_tasks CASCADE;
DROP TABLE IF EXISTS evaluations CASCADE;
DROP TABLE IF EXISTS studies CASCADE;

-- Extended Studies table with full lifecycle management
CREATE TABLE studies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'archived')),
    deadline TIMESTAMP,
    participant_capacity INTEGER,
    enrolled_count INTEGER DEFAULT 0,
    enrollment_token VARCHAR(255) UNIQUE,
    enrollment_token_expires TIMESTAMP,
    cancelled_by INTEGER REFERENCES users(id),
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Study participants junction table
CREATE TABLE study_participants (
    id SERIAL PRIMARY KEY,
    study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_id, participant_id)
);

-- Study artifacts junction table (2-3 artifacts per study)
CREATE TABLE study_artifacts (
    id SERIAL PRIMARY KEY,
    study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
    artifact_id INTEGER REFERENCES artifacts(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_id, artifact_id)
);

-- Study evaluation criteria configuration
CREATE TABLE study_criteria (
    id SERIAL PRIMARY KEY,
    study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('predefined', 'custom')),
    scale VARCHAR(50) NOT NULL CHECK (scale IN ('likert_5', 'stars_5', 'binary', 'numeric')),
    description TEXT,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Artifact sets for reusable artifact combinations
CREATE TABLE artifact_sets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    artifact_ids INTEGER[] NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Study state transitions audit log
CREATE TABLE study_state_transitions (
    id SERIAL PRIMARY KEY,
    study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evaluation tasks table (recreated with CASCADE)
CREATE TABLE evaluation_tasks (
    id SERIAL PRIMARY KEY,
    study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
    artifact1_id INTEGER REFERENCES artifacts(id),
    artifact2_id INTEGER REFERENCES artifacts(id),
    artifact3_id INTEGER REFERENCES artifacts(id),
    task_type VARCHAR(100) NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evaluations table (recreated with CASCADE)
CREATE TABLE evaluations (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES evaluation_tasks(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES users(id),
    ratings JSONB,
    annotations JSONB,
    comments TEXT,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX idx_studies_status ON studies(status);
CREATE INDEX idx_studies_created_by ON studies(created_by);
CREATE INDEX idx_studies_enrollment_token ON studies(enrollment_token);
CREATE INDEX idx_studies_deadline ON studies(deadline);
CREATE INDEX idx_studies_cancelled_by ON studies(cancelled_by);

CREATE INDEX idx_study_participants_study ON study_participants(study_id);
CREATE INDEX idx_study_participants_participant ON study_participants(participant_id);

CREATE INDEX idx_study_artifacts_study ON study_artifacts(study_id);
CREATE INDEX idx_study_artifacts_artifact ON study_artifacts(artifact_id);

CREATE INDEX idx_study_criteria_study ON study_criteria(study_id);

CREATE INDEX idx_artifact_sets_created_by ON artifact_sets(created_by);

CREATE INDEX idx_study_transitions_study ON study_state_transitions(study_id);
CREATE INDEX idx_study_transitions_changed_by ON study_state_transitions(changed_by);

CREATE INDEX idx_evaluations_participant ON evaluations(participant_id);
CREATE INDEX idx_evaluations_task ON evaluations(task_id);
