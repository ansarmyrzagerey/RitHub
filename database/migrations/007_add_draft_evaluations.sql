-- Draft evaluations table - one draft per study per participant
CREATE TABLE IF NOT EXISTS draft_evaluations (
  id SERIAL PRIMARY KEY,
  study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
  participant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  task_answers JSONB NOT NULL DEFAULT '{}', -- Stores answers for each task: { taskId: { ratings, choice, text, comments, annotations } }
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(study_id, participant_id) -- One draft per study per participant
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_draft_evaluations_study ON draft_evaluations(study_id);
CREATE INDEX IF NOT EXISTS idx_draft_evaluations_participant ON draft_evaluations(participant_id);
CREATE INDEX IF NOT EXISTS idx_draft_evaluations_updated ON draft_evaluations(updated_at);

