-- RitHub Database Schema
-- Initial database setup for PostgreSQL

-- Users table (researchers, participants, admins)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    organization VARCHAR(255), -- Optional field for user's organization/institution
    role VARCHAR(50) NOT NULL CHECK (role IN ('researcher', 'participant', 'admin', 'reviewer')),
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Artifacts table
CREATE TABLE artifacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'source_code', 'test_case', 'uml_diagram', 'requirements', etc.
    file_path VARCHAR(500),
    content TEXT,
    metadata JSONB,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Studies table with extended lifecycle management
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

-- Badges table (global skill badges)
CREATE TABLE badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User badges table (tracks which users have which badges)
CREATE TABLE user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    earned_from_quiz_id INTEGER NULL,
    UNIQUE(user_id, badge_id)
);

-- Quizzes table (must be created before the foreign key constraint)
CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_ai_generated BOOLEAN DEFAULT false,
    is_skippable BOOLEAN DEFAULT false,
    is_passable BOOLEAN DEFAULT false, -- whether badge requirements apply
    is_giving_badges BOOLEAN DEFAULT false, -- whether to award badges on pass
    is_published BOOLEAN DEFAULT false, -- once published, quiz cannot be edited
    passing_score DECIMAL(5,2), -- percentage needed to pass (e.g., 70.00)
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for earned_from_quiz_id after quizzes table is created
ALTER TABLE user_badges 
    ADD CONSTRAINT fk_user_badges_quiz 
    FOREIGN KEY (earned_from_quiz_id) 
    REFERENCES quizzes(id) 
    ON DELETE SET NULL;

-- Quiz required badges junction table
CREATE TABLE quiz_required_badges (
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
    badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
    PRIMARY KEY (quiz_id, badge_id)
);

-- Quiz awarded badges junction table
CREATE TABLE quiz_awarded_badges (
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
    badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
    PRIMARY KEY (quiz_id, badge_id)
);

-- Study-Quiz junction table (many-to-many: quizzes can be assigned to multiple studies)
CREATE TABLE study_quizzes (
    id SERIAL PRIMARY KEY,
    study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_id, quiz_id)
);

-- Quiz questions table
CREATE TABLE quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('multiple', 'open', 'code')),
    title TEXT NOT NULL,
    options JSONB, -- for multiple choice options
    correct_answer TEXT,
    is_absolute BOOLEAN DEFAULT true, -- whether answer must be exact
    point_weight INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quiz attempts table (participant submissions)
-- study_id allows per-study quiz attempts (same quiz can be retaken for different studies)
CREATE TABLE quiz_attempts (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    study_id INTEGER REFERENCES studies(id) ON DELETE SET NULL,
    answers JSONB NOT NULL,
    score DECIMAL(5,2),
    passed BOOLEAN,
    grading_status VARCHAR(20) DEFAULT 'auto_graded' CHECK (grading_status IN ('auto_graded', 'pending_grading', 'graded')),
    graded_by INTEGER REFERENCES users(id),
    graded_at TIMESTAMP,
    manual_scores JSONB,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Study evaluation criteria configuration (deprecated - moved to question level)
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

-- Study questions table (US 3.5)
CREATE TABLE study_questions (
    id SERIAL PRIMARY KEY,
    study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    question_type VARCHAR(50) NOT NULL DEFAULT 'comparison' CHECK (question_type IN ('comparison', 'rating')),
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Question artifacts junction table (which artifacts to compare in this question)
CREATE TABLE question_artifacts (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES study_questions(id) ON DELETE CASCADE,
    artifact_id INTEGER REFERENCES artifacts(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_id, artifact_id)
);

-- Question criteria table (evaluation criteria for each question)
CREATE TABLE question_criteria (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES study_questions(id) ON DELETE CASCADE,
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

-- Evaluation tasks table
CREATE TABLE evaluation_tasks (
    id SERIAL PRIMARY KEY,
    study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
    artifact1_id INTEGER REFERENCES artifacts(id),
    artifact2_id INTEGER REFERENCES artifacts(id),
    artifact3_id INTEGER REFERENCES artifacts(id), -- for 3-way comparisons
    task_type VARCHAR(100) NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task criteria table (stores criteria for each evaluation task)
CREATE TABLE task_criteria (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES evaluation_tasks(id) ON DELETE CASCADE,
    criterion_id INTEGER REFERENCES question_criteria(id) ON DELETE CASCADE,
    criterion_name VARCHAR(255) NOT NULL,
    criterion_type VARCHAR(50) NOT NULL,
    criterion_scale VARCHAR(50) NOT NULL,
    criterion_description TEXT,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, criterion_id)
);

-- Evaluations table (participant responses)
CREATE TABLE evaluations (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES evaluation_tasks(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES users(id),
    ratings JSONB, -- store ratings as JSON
    annotations JSONB, -- store annotations as JSON
    comments TEXT,
    from_cancelled_study BOOLEAN DEFAULT false, -- marks data from cancelled studies
    flagged BOOLEAN DEFAULT false, -- flagged by researcher for review
    reflagged BOOLEAN DEFAULT false, -- reflagged by reviewer to admin
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competency assessments table
CREATE TABLE competency_assessments (
    id SERIAL PRIMARY KEY,
    participant_id INTEGER REFERENCES users(id),
    assessment_data JSONB, -- store quiz results and background info
    score INTEGER,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Artifact metadata versions table (for US 2.4)
CREATE TABLE artifact_metadata_versions (
    id SERIAL PRIMARY KEY,
    artifact_id INTEGER REFERENCES artifacts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    metadata JSONB,
    edited_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artifact_id, version_number)
);

-- Artifact analysis metrics table (for US 2.10)
CREATE TABLE artifact_metrics (
    id SERIAL PRIMARY KEY,
    artifact_id INTEGER REFERENCES artifacts(id) ON DELETE CASCADE,
    metric_type VARCHAR(100) NOT NULL, -- 'complexity', 'lines_of_code', 'test_coverage', etc.
    metric_value DECIMAL(10,4),
    metric_data JSONB, -- additional metric details
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_artifacts_type ON artifacts(type);
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
CREATE INDEX idx_study_questions_study ON study_questions(study_id);
CREATE INDEX idx_study_questions_type ON study_questions(question_type);
CREATE INDEX idx_question_artifacts_question ON question_artifacts(question_id);
CREATE INDEX idx_question_artifacts_artifact ON question_artifacts(artifact_id);
CREATE INDEX idx_question_criteria_question ON question_criteria(question_id);
CREATE INDEX idx_artifact_sets_created_by ON artifact_sets(created_by);
CREATE INDEX idx_study_transitions_study ON study_state_transitions(study_id);
CREATE INDEX idx_study_transitions_changed_by ON study_state_transitions(changed_by);
CREATE INDEX idx_evaluations_participant ON evaluations(participant_id);
CREATE INDEX idx_evaluations_task ON evaluations(task_id);
CREATE INDEX idx_evaluations_cancelled_study ON evaluations(from_cancelled_study);
CREATE INDEX idx_artifact_versions_artifact ON artifact_metadata_versions(artifact_id);
CREATE INDEX idx_artifact_versions_version ON artifact_metadata_versions(artifact_id, version_number);
CREATE INDEX idx_artifact_metrics_artifact ON artifact_metrics(artifact_id);
CREATE INDEX idx_artifact_metrics_type ON artifact_metrics(metric_type);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX idx_quizzes_study ON quizzes(study_id);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_grading_status ON quiz_attempts(grading_status);
CREATE INDEX idx_study_quizzes_study ON study_quizzes(study_id);
CREATE INDEX idx_study_quizzes_quiz ON study_quizzes(quiz_id);
CREATE INDEX idx_task_criteria_task ON task_criteria(task_id);
CREATE INDEX idx_task_criteria_criterion ON task_criteria(criterion_id);

-- Notifications table for users
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task progress table to track participant progress and time spent
CREATE TABLE task_progress (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES evaluation_tasks(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
    started_at TIMESTAMP NULL,
    time_spent_seconds INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviewer assignments table
CREATE TABLE reviewer_assignments (
    id SERIAL PRIMARY KEY,
    study_id INT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    reviewer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT now()
);

-- Additional indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_task_progress_task ON task_progress(task_id);
CREATE INDEX idx_task_progress_participant ON task_progress(participant_id);
CREATE UNIQUE INDEX ux_reviewer_study ON reviewer_assignments(study_id, reviewer_id);

-- Migration: Add support for screenshots and highlights in task responses
-- Table to store uploaded images (screenshots and highlight images)
CREATE TABLE IF NOT EXISTS task_response_images (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES evaluation_tasks(id) ON DELETE CASCADE,
  participant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  image_type VARCHAR(50) NOT NULL CHECK (image_type IN ('screenshot', 'highlight_image')),
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Optional: link to specific highlight if it's a highlight image
  highlight_id VARCHAR(100) -- UUID or identifier for the highlight
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_response_images_task ON task_response_images(task_id);
CREATE INDEX IF NOT EXISTS idx_task_response_images_participant ON task_response_images(participant_id);
CREATE INDEX IF NOT EXISTS idx_task_response_images_type ON task_response_images(image_type);
CREATE INDEX IF NOT EXISTS idx_task_response_images_highlight ON task_response_images(highlight_id) WHERE highlight_id IS NOT NULL;

-- Seed Data: Initial Badges
INSERT INTO badges (name, description, created_at) VALUES
('C++ Beginner', 'Demonstrates basic proficiency in C++ programming fundamentals', NOW()),
('QuickSort Proficiency', 'Shows mastery of the QuickSort algorithm and its implementation', NOW())
ON CONFLICT DO NOTHING;
