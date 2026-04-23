-- Migration: Add task_criteria table
-- This table stores the criteria for each evaluation task
-- Links evaluation_tasks to question_criteria

-- Create task_criteria table
CREATE TABLE IF NOT EXISTS task_criteria (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_criteria_task ON task_criteria(task_id);
CREATE INDEX IF NOT EXISTS idx_task_criteria_criterion ON task_criteria(criterion_id);

-- Add comment to document the purpose
COMMENT ON TABLE task_criteria IS 'Stores evaluation criteria for each task, generated from question_criteria';
