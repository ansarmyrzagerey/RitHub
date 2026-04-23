-- Migration: Update cascade constraints to prevent deletion of evaluation data
-- This ensures that studies with evaluation data cannot be accidentally deleted

-- Drop existing foreign key constraints
ALTER TABLE evaluation_tasks 
DROP CONSTRAINT IF EXISTS evaluation_tasks_study_id_fkey;

ALTER TABLE evaluations 
DROP CONSTRAINT IF EXISTS evaluations_task_id_fkey;

-- Re-add constraints with RESTRICT to prevent deletion
ALTER TABLE evaluation_tasks 
ADD CONSTRAINT evaluation_tasks_study_id_fkey 
FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE RESTRICT;

ALTER TABLE evaluations 
ADD CONSTRAINT evaluations_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES evaluation_tasks(id) ON DELETE RESTRICT;

-- Add comment to document the purpose
COMMENT ON CONSTRAINT evaluation_tasks_study_id_fkey ON evaluation_tasks IS 'Prevents deletion of studies with evaluation data - use cancellation instead';
COMMENT ON CONSTRAINT evaluations_task_id_fkey ON evaluations IS 'Prevents deletion of evaluation tasks with response data';
