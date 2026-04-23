const { body, param, validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = {};
    errors.array().forEach(error => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors
    });
  }
  next();
};

/**
 * Validation rules for study creation
 */
const validateStudyCreation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 255 })
    .withMessage('Title must be no more than 255 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  
  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid date')
    .custom((value) => {
      const deadline = new Date(value);
      const now = new Date();
      if (deadline <= now) {
        throw new Error('Deadline must be in the future');
      }
      return true;
    }),
  
  body('participant_capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Participant capacity must be a positive integer'),
  
  body('artifacts')
    .optional()
    .isArray({ min: 2, max: 3 })
    .withMessage('Must select between 2 and 3 artifacts'),
  
  body('criteria')
    .optional()
    .isArray()
    .withMessage('Criteria must be an array'),
  
  body('status')
    .optional()
    .isIn(['draft', 'active'])
    .withMessage('Status must be either draft or active'),
  
  handleValidationErrors
];

/**
 * Validation rules for study updates
 */
const validateStudyUpdate = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Title must be no more than 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Description cannot be empty'),
  
  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid date')
    .custom((value) => {
      const deadline = new Date(value);
      const now = new Date();
      if (deadline <= now) {
        throw new Error('Deadline must be in the future');
      }
      return true;
    }),
  
  body('participant_capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Participant capacity must be a positive integer'),
  
  handleValidationErrors
];

/**
 * Validation rules for study state transitions
 */
const validateStateTransition = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Study ID must be a valid positive integer'),
  
  body('reason')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Reason cannot be empty if provided'),
  
  handleValidationErrors
];

/**
 * Validation rules for study ID parameter
 */
const validateStudyId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Study ID must be a valid positive integer'),
  
  handleValidationErrors
];

/**
 * Validation rules for enrollment
 */
const validateEnrollment = [
  param('token')
    .trim()
    .notEmpty()
    .withMessage('Enrollment token is required')
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid enrollment token format'),
  
  handleValidationErrors
];

/**
 * Validation rules for adding artifacts to study
 */
const validateAddArtifacts = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Study ID must be a valid positive integer'),
  
  body('artifact_id')
    .isInt({ min: 1 })
    .withMessage('Artifact ID must be a valid positive integer'),
  
  body('display_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  
  handleValidationErrors
];

/**
 * Validation rules for adding criteria to study
 */
const validateAddCriteria = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Study ID must be a valid positive integer'),
  
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Criteria name is required')
    .isLength({ max: 255 })
    .withMessage('Criteria name must be no more than 255 characters'),
  
  body('type')
    .isIn(['predefined', 'custom'])
    .withMessage('Type must be either predefined or custom'),
  
  body('scale')
    .isIn(['likert_5', 'stars_5', 'binary', 'numeric'])
    .withMessage('Scale must be one of: likert_5, stars_5, binary, numeric'),
  
  body('description')
    .optional()
    .trim(),
  
  body('display_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  
  handleValidationErrors
];

/**
 * Validation rules for updating criteria
 */
const validateUpdateCriteria = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Study ID must be a valid positive integer'),
  
  param('criteriaId')
    .isInt({ min: 1 })
    .withMessage('Criteria ID must be a valid positive integer'),
  
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Criteria name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Criteria name must be no more than 255 characters'),
  
  body('description')
    .optional()
    .trim(),
  
  body('display_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  
  handleValidationErrors
];

/**
 * Validation rules for artifact set creation
 */
const validateArtifactSetCreation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Artifact set name is required')
    .isLength({ max: 255 })
    .withMessage('Name must be no more than 255 characters'),
  
  body('description')
    .optional()
    .trim(),
  
  body('artifact_ids')
    .isArray({ min: 2, max: 3 })
    .withMessage('Must include between 2 and 3 artifacts'),
  
  body('artifact_ids.*')
    .isInt({ min: 1 })
    .withMessage('Each artifact ID must be a valid positive integer'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateStudyCreation,
  validateStudyUpdate,
  validateStateTransition,
  validateStudyId,
  validateEnrollment,
  validateAddArtifacts,
  validateAddCriteria,
  validateUpdateCriteria,
  validateArtifactSetCreation
};
