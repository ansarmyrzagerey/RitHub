-- Add reviewer assignment table so studies can have an assigned reviewer
CREATE TABLE IF NOT EXISTS reviewer_assignments (
  id SERIAL PRIMARY KEY,
  study_id INT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  reviewer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now()
);

-- optional unique constraint per study
CREATE UNIQUE INDEX IF NOT EXISTS ux_reviewer_assignments_study ON reviewer_assignments(study_id);
