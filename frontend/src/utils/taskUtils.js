/**
 * Utility functions for task completion and data checking
 */

/**
 * Checks if a task has all required fields filled based on its answer_type
 * @param {Object} task - The task object with answer_type, artifact1, artifact2, artifact3
 * @param {Object} taskData - The task data object with ratings, choice, text, comments, etc.
 * @returns {boolean} - True if task is complete, false otherwise
 */
export const isTaskComplete = (task, taskData = {}) => {
  if (!task) return false;
  
  const answerType = task.answer_type || 'rating';
  
  if (answerType === 'rating' || answerType === 'rating_required_comments') {
    // For rating tasks, check if all artifacts have ratings
    // Check for artifact1_id or artifact1 to determine if artifact exists
    // artifact1_id is from the database, artifact1 is the full artifact object
    const hasArtifact1 = task.artifact1_id !== undefined ? !!task.artifact1_id : (task.artifact1 !== undefined ? !!task.artifact1 : undefined);
    const hasArtifact2 = task.artifact2_id !== undefined ? !!task.artifact2_id : (task.artifact2 !== undefined ? !!task.artifact2 : undefined);
    const hasArtifact3 = task.artifact3_id !== undefined ? !!task.artifact3_id : (task.artifact3 !== undefined ? !!task.artifact3 : undefined);
    
    // If we can't determine artifact existence (no artifact info at all), assume incomplete
    // This prevents false positives when task data is incomplete
    if (hasArtifact1 === undefined && hasArtifact2 === undefined && hasArtifact3 === undefined) {
      // No artifact information available - can't determine completion, so assume incomplete
      return false;
    }
    
    const hasRating1 = hasArtifact1 ? (taskData.ratings?.artifact1 && taskData.ratings.artifact1 > 0) : true;
    const hasRating2 = hasArtifact2 ? (taskData.ratings?.artifact2 && taskData.ratings.artifact2 > 0) : true;
    const hasRating3 = hasArtifact3 ? (taskData.ratings?.artifact3 && taskData.ratings.artifact3 > 0) : true;
    const hasComments = answerType === 'rating_required_comments' ? taskData.comments?.trim() : true;
    
    return hasRating1 && hasRating2 && hasRating3 && hasComments;
  } else if (answerType === 'choice' || answerType === 'choice_required_text') {
    // For choice tasks, check if choice is selected and text if required
    const hasChoice = !!taskData.choice;
    const hasText = answerType === 'choice_required_text' ? taskData.text?.trim() : true;
    
    return hasChoice && hasText;
  } else if (answerType === 'text_required') {
    // For text tasks, check if text is provided
    return !!taskData.text?.trim();
  }
  
  // Default: consider incomplete if we don't recognize the answer type
  return false;
};

/**
 * Checks if a task has any data (ratings, choice, text, comments, highlights, screenshots, etc.)
 * @param {Object} taskData - The task data object
 * @returns {boolean} - True if task has any data, false otherwise
 */
export const hasTaskData = (taskData = {}) => {
  // Check for ratings (any rating > 0)
  if (taskData.ratings) {
    const ratingValues = Object.values(taskData.ratings);
    if (ratingValues.some(rating => rating && rating > 0)) {
      return true;
    }
  }
  
  // Check for choice selection
  if (taskData.choice) {
    return true;
  }
  
  // Check for text input
  if (taskData.text?.trim()) {
    return true;
  }
  
  // Check for comments
  if (taskData.comments?.trim()) {
    return true;
  }
  
  // Check for highlights
  if (taskData.highlights && taskData.highlights.length > 0) {
    return true;
  }
  
  // Check for artifact highlights
  if (taskData.artifactHighlights) {
    const artifact1Highlights = taskData.artifactHighlights.artifact1 || [];
    const artifact2Highlights = taskData.artifactHighlights.artifact2 || [];
    const artifact3Highlights = taskData.artifactHighlights.artifact3 || [];
    if (artifact1Highlights.length > 0 || artifact2Highlights.length > 0 || artifact3Highlights.length > 0) {
      return true;
    }
  }
  
  // Check for screenshots
  if (taskData.screenshots && taskData.screenshots.length > 0) {
    return true;
  }
  
  // Check for annotations
  if (taskData.annotations && Object.keys(taskData.annotations).length > 0) {
    return true;
  }
  
  return false;
};

/**
 * Calculates the number of completed tasks based on task data
 * @param {Array} tasks - Array of task objects
 * @param {Object} taskAnswers - Object mapping task IDs to task data (e.g., { taskId: { ratings: {...}, ... } })
 * @returns {number} - Number of completed tasks
 */
export const calculateCompletedTasks = (tasks = [], taskAnswers = {}) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return 0;
  }
  
  return tasks.filter(task => {
    // Get task data - handle both string and number IDs
    const taskData = taskAnswers[task.id] || taskAnswers[task.id.toString()] || {};
    
    // Check if task is complete
    return isTaskComplete(task, taskData);
  }).length;
};
