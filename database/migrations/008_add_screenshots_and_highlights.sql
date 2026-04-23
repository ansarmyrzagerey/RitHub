-- Migration: Add support for screenshots and highlights in task responses
-- This migration doesn't require schema changes since we use JSONB fields
-- but we add a table to track uploaded images for better management

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

-- Add comment for documentation
COMMENT ON TABLE task_response_images IS 'Stores uploaded images (screenshots and highlight images) for task responses';
COMMENT ON COLUMN task_response_images.image_type IS 'Type of image: screenshot or highlight_image';
COMMENT ON COLUMN task_response_images.highlight_id IS 'Optional identifier linking this image to a specific highlight annotation';


