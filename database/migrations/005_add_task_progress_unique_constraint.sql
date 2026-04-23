-- Add unique constraint on (task_id, participant_id) for task_progress table
-- This ensures one progress record per task per participant and enables ON CONFLICT in upserts

-- First, remove any duplicate entries if they exist
DELETE FROM task_progress t1
WHERE EXISTS (
  SELECT 1 FROM task_progress t2
  WHERE t2.task_id = t1.task_id
    AND t2.participant_id = t1.participant_id
    AND t2.id < t1.id
);

-- Add unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'task_progress_task_participant_unique'
  ) THEN
    ALTER TABLE task_progress
    ADD CONSTRAINT task_progress_task_participant_unique 
    UNIQUE (task_id, participant_id);
  END IF;
END $$;


