// Validation utility functions

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - { isValid: boolean, message: string }
 */
export const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  
  return { isValid: true, message: 'Password is valid' };
};

/**
 * Validate form data
 * @param {object} formData - Form data to validate
 * @param {object} rules - Validation rules
 * @returns {object} - { isValid: boolean, errors: object }
 */
export const validateForm = (formData, rules) => {
  const errors = {};
  let isValid = true;
  
  Object.keys(rules).forEach(field => {
    const value = formData[field];
    const rule = rules[field];
    
    if (rule.required && (!value || value.trim() === '')) {
      errors[field] = `${rule.label || field} is required`;
      isValid = false;
    } else if (value && rule.pattern && !rule.pattern.test(value)) {
      errors[field] = rule.message || `${rule.label || field} format is invalid`;
      isValid = false;
    } else if (value && rule.minLength && value.length < rule.minLength) {
      errors[field] = `${rule.label || field} must be at least ${rule.minLength} characters`;
      isValid = false;
    } else if (value && rule.maxLength && value.length > rule.maxLength) {
      errors[field] = `${rule.label || field} must be no more than ${rule.maxLength} characters`;
      isValid = false;
    }
  });
  
  return { isValid, errors };
};

/**
 * Sanitize input string
 * @param {string} input - Input to sanitize
 * @returns {string}
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};

/**
 * Validate study title
 * @param {string} title - Title to validate
 * @returns {string|null} - Error message or null if valid
 */
export const validateStudyTitle = (title) => {
  if (!title || title.trim() === '') {
    return 'Title is required';
  }
  if (title.length > 255) {
    return 'Title must be 255 characters or less';
  }
  return null;
};

/**
 * Validate study description
 * @param {string} description - Description to validate
 * @returns {string|null} - Error message or null if valid
 */
export const validateStudyDescription = (description) => {
  if (!description || description.trim() === '') {
    return 'Description is required';
  }
  return null;
};

/**
 * Validate study deadline
 * @param {string} deadline - Deadline to validate (ISO string)
 * @returns {string|null} - Error message or null if valid
 */
export const validateStudyDeadline = (deadline) => {
  // For drafts, deadline can be omitted. Only validate when provided.
  if (!deadline) return null;
  
  const deadlineDate = new Date(deadline);
  const now = new Date();
  
  if (isNaN(deadlineDate.getTime())) {
    return 'Invalid deadline format';
  }
  
  if (deadlineDate <= now) {
    return 'Deadline must be in the future';
  }
  
  return null;
};

/**
 * Validate participant capacity
 * @param {number} capacity - Capacity to validate
 * @returns {string|null} - Error message or null if valid
 */
export const validateParticipantCapacity = (capacity) => {
  if (capacity === undefined || capacity === null || capacity === '') {
    return 'Participant capacity is required';
  }
  
  const num = parseInt(capacity, 10);
  
  if (isNaN(num)) {
    return 'Capacity must be a number';
  }
  
  if (num <= 0) {
    return 'Capacity must be a positive number';
  }
  
  if (num > 1000) {
    return 'Capacity cannot exceed 1000 participants';
  }
  
  return null;
};

/**
 * Validate artifact selection
 * @param {Array} artifacts - Selected artifacts
 * @returns {string|null} - Error message or null if valid
 */
export const validateArtifactSelection = (artifacts) => {
  if (!artifacts || !Array.isArray(artifacts)) {
    return 'Artifacts must be an array';
  }
  
  if (artifacts.length < 2) {
    return 'Please select at least 2 artifacts';
  }
  
  if (artifacts.length > 3) {
    return 'Please select no more than 3 artifacts';
  }
  
  return null;
};

/**
 * Validate evaluation criteria
 * @param {Array} criteria - Evaluation criteria
 * @returns {string|null} - Error message or null if valid
 */
export const validateEvaluationCriteria = (criteria) => {
  if (!criteria || !Array.isArray(criteria)) {
    return 'Criteria must be an array';
  }
  
  if (criteria.length === 0) {
    return 'Please add at least one evaluation criterion';
  }
  
  // Validate each criterion
  for (let i = 0; i < criteria.length; i++) {
    const criterion = criteria[i];
    
    if (!criterion.name || criterion.name.trim() === '') {
      return `Criterion ${i + 1}: Name is required`;
    }
    
    if (!criterion.scale) {
      return `Criterion ${i + 1}: Scale is required`;
    }
    
    const validScales = ['likert_5', 'stars_5', 'binary', 'numeric'];
    if (!validScales.includes(criterion.scale)) {
      return `Criterion ${i + 1}: Invalid scale type`;
    }
  }
  
  return null;
};

/**
 * Validate complete study data
 * @param {object} studyData - Complete study data
 * @returns {object} - { isValid: boolean, errors: object }
 */
export const validateStudyData = (studyData) => {
  const errors = {};
  
  const titleError = validateStudyTitle(studyData.title);
  if (titleError) errors.title = titleError;
  
  const descriptionError = validateStudyDescription(studyData.description);
  if (descriptionError) errors.description = descriptionError;
  
  const deadlineError = validateStudyDeadline(studyData.deadline);
  if (deadlineError) errors.deadline = deadlineError;
  
  const capacityError = validateParticipantCapacity(studyData.participant_capacity);
  if (capacityError) errors.participant_capacity = capacityError;
  
  const artifactsError = validateArtifactSelection(studyData.artifacts);
  if (artifactsError) errors.artifacts = artifactsError;
  
  const criteriaError = validateEvaluationCriteria(studyData.criteria);
  if (criteriaError) errors.criteria = criteriaError;
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
