-- Migration: Fix "criteria above" to "criteria below" in existing tasks
-- This updates all existing evaluation tasks that have the old text "criteria above"
-- to use the new text "criteria below" in their answer_options JSONB field

-- Update answer_options for comparison tasks (choice_required_text type)
UPDATE evaluation_tasks
SET answer_options = jsonb_set(
  answer_options,
  '{question}',
  '"Which artifact is better based on the criteria below?"'::jsonb
)
WHERE answer_options->>'question' = 'Which artifact is better based on the criteria above?';

-- Log how many tasks were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % tasks with "criteria above" to "criteria below"', updated_count;
END $$;


