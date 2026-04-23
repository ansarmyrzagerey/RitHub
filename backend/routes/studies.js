const express = require('express');
const router = express.Router();
const Study = require('../models/study');
const StudyCriteria = require('../models/studyCriteria');
const StudyArtifact = require('../models/studyArtifact');
const ArtifactSet = require('../models/artifactSet');
const StudyQuestion = require('../models/studyQuestion');
const { auth, requireResearcher, requireAdmin } = require('../middleware/auth');
const {
  isStudyOwner,
  isStudyOwnerOrAdmin,
  canViewStudy,
  canEditStudy,
  canCancelStudy,
  canAdminCancelStudy,
  canDeleteStudy
} = require('../middleware/authorization');
const {
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
} = require('../middleware/validation');

// ============================================================================
// PUBLIC ENROLLMENT ENDPOINTS (Must be defined BEFORE parameterized routes)
// ============================================================================

/**
 * GET /api/studies/enrollment/:token - Validate enrollment token and get study info (public)
 * No authentication required
 */
router.get('/enrollment/:token', validateEnrollment, async (req, res) => {
  try {
    const { token } = req.params;

    const study = await Study.validateEnrollmentToken(token);

    if (!study) {
      return res.status(400).json({
        success: false,
        message: 'Invalid, expired, or inactive enrollment link'
      });
    }

    // Return study information for enrollment page
    res.json({
      success: true,
      study: {
        id: study.id,
        title: study.title,
        description: study.description,
        deadline: study.deadline,
        participant_capacity: study.participant_capacity,
        enrolled_count: study.enrolled_count,
        has_capacity: !study.participant_capacity || study.enrolled_count < study.participant_capacity
      }
    });

  } catch (error) {
    console.error('Error validating enrollment token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate enrollment token'
    });
  }
});

/**
 * POST /api/studies/enrollment/:token - Enroll participant in study
 * Requires: authentication
 * Authorization: participant role
 */
router.post('/enrollment/:token', auth, validateEnrollment, async (req, res) => {
  try {
    const { token } = req.params;

    // Validate enrollment token
    const study = await Study.validateEnrollmentToken(token);

    if (!study) {
      return res.status(400).json({
        success: false,
        message: 'Invalid, expired, or inactive enrollment link'
      });
    }

    // Enroll participant with capacity validation
    const enrollment = await Study.enrollParticipant(study.id, req.user.id);

    res.json({
      success: true,
      message: 'Successfully enrolled in study',
      enrollment: {
        study_id: enrollment.study_id,
        participant_id: enrollment.participant_id,
        enrolled_at: enrollment.enrolled_at
      }
    });

  } catch (error) {
    console.error('Error enrolling participant:', error);

    // Handle specific error messages
    if (error.message.includes('already enrolled')) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this study'
      });
    }

    if (error.message.includes('maximum capacity')) {
      return res.status(400).json({
        success: false,
        message: 'Study has reached maximum capacity'
      });
    }

    if (error.message.includes('deadline has passed')) {
      return res.status(400).json({
        success: false,
        message: 'Study enrollment deadline has passed'
      });
    }

    if (error.message.includes('not active')) {
      return res.status(400).json({
        success: false,
        message: 'Study is not currently active'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to enroll in study'
    });
  }
});

// ============================================================================
// CRITERIA TEMPLATES ENDPOINT (Must be defined BEFORE parameterized routes)
// ============================================================================

/**
 * GET /api/studies/criteria/templates - Get predefined criteria templates
 * Requires: authentication
 */
router.get('/criteria/templates', auth, async (req, res) => {
  try {
    const templates = StudyCriteria.getTemplates();

    res.json({
      success: true,
      templates: templates.templates,
      scales: templates.scales
    });

  } catch (error) {
    console.error('Error fetching criteria templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch criteria templates'
    });
  }
});

// ============================================================================
// ARTIFACT SET ENDPOINTS (Must be defined BEFORE parameterized routes)
// ============================================================================

/**
 * POST /api/studies/artifact-sets - Create artifact set
 * Requires: authentication
 * Authorization: researcher role
 * Body: { name, description, artifact_ids }
 */
router.post('/artifact-sets', auth, requireResearcher, validateArtifactSetCreation, async (req, res) => {
  try {
    const { name, description, artifact_ids } = req.body;

    const artifactSet = await ArtifactSet.create({
      name,
      description: description || null,
      created_by: req.user.id,
      artifact_ids
    });

    res.status(201).json({
      success: true,
      message: 'Artifact set created successfully',
      artifact_set: artifactSet
    });

  } catch (error) {
    console.error('Error creating artifact set:', error);

    if (error.message.includes('at least 2') ||
      error.message.includes('maximum of 3') ||
      error.message.includes('duplicate') ||
      error.message.includes('do not exist')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create artifact set'
    });
  }
});

/**
 * GET /api/studies/artifact-sets - Get all artifact sets for current user
 * Requires: authentication
 */
router.get('/artifact-sets', auth, async (req, res) => {
  try {
    const artifactSets = await ArtifactSet.findByCreator(req.user.id);

    res.json({
      success: true,
      artifact_sets: artifactSets
    });

  } catch (error) {
    console.error('Error fetching artifact sets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch artifact sets'
    });
  }
});

/**
 * DELETE /api/studies/artifact-sets/:id - Delete artifact set
 * Requires: authentication
 * Authorization: owner only
 */
router.delete('/artifact-sets/:id', auth, async (req, res) => {
  try {
    const deleted = await ArtifactSet.delete(req.params.id, req.user.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Artifact set not found'
      });
    }

    res.json({
      success: true,
      message: 'Artifact set deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting artifact set:', error);

    if (error.message.includes('not found') || error.message.includes('Only the creator')) {
      return res.status(error.message.includes('not found') ? 404 : 403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete artifact set'
    });
  }
});

// ============================================================================
// STUDY STATISTICS ENDPOINT (Must be defined BEFORE parameterized routes)
// ============================================================================

/**
 * GET /api/studies/statistics - Get study statistics for dashboard
 * Requires: authentication
 * Returns statistics for the current user (or platform-wide for admins)
 */
router.get('/statistics', auth, async (req, res) => {
  try {
    // Get statistics for current user
    const stats = await Study.getStatistics(req.user.id);

    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('Error fetching study statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study statistics'
    });
  }
});

/**
 * GET /api/studies/trash - Get deleted studies (trash bin)
 * Requires: authentication
 * Query params: created_by (optional, for filtering by creator)
 */
router.get('/trash', auth, async (req, res) => {
  try {
    const { created_by } = req.query;
    const filters = {};

    // Non-admin users can only see their own deleted studies
    if (req.user.role !== 'admin') {
      filters.created_by = req.user.id;
    } else if (created_by) {
      filters.created_by = parseInt(created_by);
    }

    const deletedStudies = await Study.findDeleted(filters);

    res.json({
      success: true,
      studies: deletedStudies
    });

  } catch (error) {
    console.error('Error fetching deleted studies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deleted studies'
    });
  }
});

// ============================================================================
// STUDY CRUD ENDPOINTS (Subtask 6.1)
// ============================================================================

/**
 * POST /api/studies - Create new study (draft)
 * Requires: researcher role
 * Body: { title, description, deadline, participant_capacity }
 */
router.post('/', auth, requireResearcher, ...validateStudyCreation, async (req, res) => {
  try {
    const { title, description, deadline, participant_capacity } = req.body;

    // Create study
    const study = await Study.create({
      title,
      description,
      created_by: req.user.id,
      deadline: deadline || null,
      participant_capacity: participant_capacity || null,
      status: 'draft'
    });

    res.status(201).json({
      success: true,
      message: 'Study created successfully',
      study
    });

  } catch (error) {
    console.error('Error creating study:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create study'
    });
  }
});

/**
 * GET /api/studies - Get all studies with filtering
 * Requires: authentication
 * Query params: status, creator (optional)
 */
router.get('/', auth, async (req, res) => {
  try {
    const { status, creator } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    const filters = {};

    // For researchers, only show their own studies (unless admin or specifically requesting another user's)
    if (userRole === 'researcher') {
      filters.created_by = userId;
    } else if (creator) {
      // Admins can filter by creator if specified
      filters.created_by = parseInt(creator);
    }

    // Apply status filter if provided
    if (status) {
      const validStatuses = ['draft', 'active', 'completed', 'cancelled', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      filters.status = status;
    }

    const studies = await Study.findAll(filters);

    res.json({
      success: true,
      studies
    });

  } catch (error) {
    console.error('Error fetching studies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch studies'
    });
  }
});

/**
 * GET /api/studies/:id - Get study details
 * Requires: authentication
 * Authorization: owner, admin, or enrolled participant
 */
router.get('/:id', auth, canViewStudy, async (req, res) => {
  try {
    // Study is already attached by canViewStudy middleware
    const study = req.study;

    // Fetch criteria for the study
    let criteria = [];
    try {
      criteria = await StudyCriteria.findByStudyId(study.id);
    } catch (criteriaError) {
      // If study_criteria table doesn't exist or error occurs, continue without criteria
      console.log('Note: Could not fetch study criteria:', criteriaError.message);
    }

    // Attach criteria to study object
    const studyWithCriteria = {
      ...study,
      criteria: criteria
    };

    res.json({
      success: true,
      study: studyWithCriteria
    });

  } catch (error) {
    console.error('Error fetching study:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study'
    });
  }
});

/**
 * PUT /api/studies/:id - Update study
 * Requires: authentication
 * Authorization: owner or admin
 * Body: { title, description, deadline, participant_capacity }
 */
router.put('/:id', auth, canEditStudy, validateStudyUpdate, async (req, res) => {
  try {
    // Study is already attached and validated by canEditStudy middleware
    const study = req.study;
    const { title, description, deadline, participant_capacity } = req.body;

    // Check if study can be edited based on status
    // Draft studies can be fully edited
    // Active studies can only have deadline and capacity updated
    if (study.status === 'active') {
      if (title || description) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update title or description of active study. Only deadline and capacity can be modified'
        });
      }
    }

    // Build update data
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (participant_capacity !== undefined) updateData.participant_capacity = participant_capacity;

    const updatedStudy = await Study.update(req.params.id, updateData);

    res.json({
      success: true,
      message: 'Study updated successfully',
      study: updatedStudy
    });

  } catch (error) {
    console.error('Error updating study:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update study'
    });
  }
});

/**
 * DELETE /api/studies/:id - Move study to trash bin (soft delete)
 * Requires: authentication
 * Authorization: owner or admin
 */
router.delete('/:id', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    // Study is already attached and validated by isStudyOwnerOrAdmin middleware
    const deletedStudy = await Study.delete(req.params.id, req.user.id);

    if (!deletedStudy) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete study'
      });
    }

    res.json({
      success: true,
      message: 'Study moved to trash bin successfully',
      study: deletedStudy
    });

  } catch (error) {
    console.error('Error deleting study:', error);

    if (error.message.includes('already deleted') || error.message.includes('not found')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete study'
    });
  }
});

// ============================================================================
// STUDY STATE TRANSITION ENDPOINTS (Subtask 6.2)
// ============================================================================

/**
 * POST /api/studies/:id/activate - Activate study
 * Requires: authentication
 * Authorization: owner or admin
 */
router.post('/:id/activate', auth, isStudyOwnerOrAdmin, validateStateTransition, async (req, res) => {
  try {
    // Study is already attached by isStudyOwnerOrAdmin middleware
    const study = req.study;

    // Validate study can be activated
    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot activate study from ${study.status} status. Only draft studies can be activated`
      });
    }

    const activatedStudy = await Study.activate(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Study activated successfully',
      study: activatedStudy
    });

  } catch (error) {
    console.error('Error activating study:', error);

    if (error.message.includes('Cannot activate')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to activate study'
    });
  }
});

/**
 * POST /api/studies/:id/cancel - Cancel study (researcher)
 * Requires: authentication
 * Authorization: owner only
 * Body: { reason } (optional)
 */
router.post('/:id/cancel', auth, canCancelStudy, validateStateTransition, async (req, res) => {
  try {
    // Study is already attached and validated by canCancelStudy middleware
    const { reason } = req.body;

    const cancelledStudy = await Study.cancel(req.params.id, req.user.id, reason || null);

    res.json({
      success: true,
      message: 'Study cancelled successfully',
      study: cancelledStudy
    });

  } catch (error) {
    console.error('Error cancelling study:', error);

    if (error.message.includes('Cannot cancel') || error.message.includes('Only study owner')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to cancel study'
    });
  }
});

/**
 * POST /api/studies/:id/admin-cancel - Admin cancel study
 * Requires: authentication
 * Authorization: admin only
 * Body: { reason } (required)
 */
router.post('/:id/admin-cancel', auth, requireAdmin, canAdminCancelStudy, validateStateTransition, async (req, res) => {
  try {
    // Study is already attached and validated by canAdminCancelStudy middleware
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required for admin cancellation'
      });
    }

    const cancelledStudy = await Study.adminCancel(req.params.id, req.user.id, reason);

    res.json({
      success: true,
      message: 'Study cancelled by admin successfully',
      study: cancelledStudy
    });

  } catch (error) {
    console.error('Error admin cancelling study:', error);

    if (error.message.includes('Cannot cancel') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to cancel study'
    });
  }
});

/**
 * POST /api/studies/:id/archive - Archive study
 * Requires: authentication
 * Authorization: owner or admin
 */
router.post('/:id/archive', auth, isStudyOwnerOrAdmin, validateStateTransition, async (req, res) => {
  try {
    // Study is already attached by isStudyOwnerOrAdmin middleware
    const archivedStudy = await Study.archive(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Study archived successfully',
      study: archivedStudy
    });

  } catch (error) {
    console.error('Error archiving study:', error);

    if (error.message.includes('Cannot archive')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to archive study'
    });
  }
});

// ============================================================================
// ENROLLMENT ENDPOINTS (Subtask 6.3)
// ============================================================================

/**
 * POST /api/studies/:id/enrollment-link - Generate enrollment link
 * Requires: authentication
 * Authorization: owner or admin
 */
router.post('/:id/enrollment-link', auth, isStudyOwnerOrAdmin, validateStudyId, async (req, res) => {
  try {
    // Study is already attached by isStudyOwnerOrAdmin middleware
    // Generate enrollment token
    const updatedStudy = await Study.generateEnrollmentToken(req.params.id);

    // Build enrollment URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const enrollmentUrl = `${frontendUrl}/enroll/${updatedStudy.enrollment_token}`;

    res.json({
      success: true,
      message: 'Enrollment link generated successfully',
      enrollment_link: enrollmentUrl,
      enrollment_token: updatedStudy.enrollment_token,
      expires_at: updatedStudy.enrollment_token_expires
    });

  } catch (error) {
    console.error('Error generating enrollment link:', error);

    if (error.message.includes('Can only generate')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to generate enrollment link'
    });
  }
});

/**
 * GET /api/studies/:id/enrollment-link - Get current enrollment link
 * Requires: authentication
 * Authorization: owner or admin
 */
router.get('/:id/enrollment-link', auth, isStudyOwnerOrAdmin, validateStudyId, async (req, res) => {
  try {
    // Study is already attached by isStudyOwnerOrAdmin middleware
    const study = req.study;

    if (!study.enrollment_token) {
      return res.status(404).json({
        success: false,
        message: 'No enrollment link has been generated for this study'
      });
    }

    // Build enrollment URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const enrollmentUrl = `${frontendUrl}/enroll/${study.enrollment_token}`;

    res.json({
      success: true,
      enrollment_link: enrollmentUrl,
      enrollment_token: study.enrollment_token,
      expires_at: study.enrollment_token_expires
    });

  } catch (error) {
    console.error('Error fetching enrollment link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enrollment link'
    });
  }
});

/**
 * DELETE /api/studies/:id/enrollment-link - Invalidate enrollment link
 * Requires: authentication
 * Authorization: owner or admin
 */
router.delete('/:id/enrollment-link', auth, isStudyOwnerOrAdmin, validateStudyId, async (req, res) => {
  try {
    // Study is already attached by isStudyOwnerOrAdmin middleware
    await Study.invalidateEnrollmentToken(req.params.id);

    res.json({
      success: true,
      message: 'Enrollment link invalidated successfully'
    });

  } catch (error) {
    console.error('Error invalidating enrollment link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to invalidate enrollment link'
    });
  }
});



// ============================================================================
// STUDY ARTIFACT ENDPOINTS (Subtask 6.4)
// ============================================================================

/**
 * POST /api/studies/:id/artifacts - Add artifact to study
 * Requires: authentication
 * Authorization: owner or admin
 * Body: { artifact_id, display_order }
 */
router.post('/:id/artifacts', auth, isStudyOwnerOrAdmin, validateAddArtifacts, async (req, res) => {
  try {
    // Study is already attached by isStudyOwnerOrAdmin middleware
    const { artifact_id, display_order } = req.body;

    // Add artifact to study (includes compatibility validation)
    const studyArtifact = await StudyArtifact.addToStudy(
      req.params.id,
      artifact_id,
      display_order || null
    );

    res.status(201).json({
      success: true,
      message: 'Artifact added to study successfully',
      study_artifact: studyArtifact
    });

  } catch (error) {
    console.error('Error adding artifact to study:', error);

    // Handle specific error messages
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('already added') ||
      error.message.includes('maximum of 3') ||
      error.message.includes('not compatible') ||
      error.message.includes('draft studies')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add artifact to study'
    });
  }
});
/**
 * GET /api/studies/:id/artifacts - Get all artifacts assigned to a study
 * Requires: authentication
 * Authorization: owner, admin, or enrolled participant
 */
router.get('/:id/artifacts', auth, canViewStudy, async (req, res) => {
  try {
    // Study is already attached by canViewStudy middleware
    const artifacts = await StudyArtifact.findByStudyId(req.params.id);

    res.json({
      success: true,
      artifacts
    });

  } catch (error) {
    console.error('Error fetching study artifacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study artifacts'
    });
  }
});

/**
 * DELETE /api/studies/:id/artifacts/:artifactId - Remove artifact from study
 * Requires: authentication
 * Authorization: owner or admin
 */
router.delete('/:id/artifacts/:artifactId', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    // Study is already attached by isStudyOwnerOrAdmin middleware
    await StudyArtifact.removeFromStudy(req.params.id, parseInt(req.params.artifactId));

    res.json({
      success: true,
      message: 'Artifact removed from study successfully'
    });

  } catch (error) {
    console.error('Error removing artifact from study:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('draft studies')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to remove artifact from study'
    });
  }
});

/**
 * GET /api/studies/:id/artifacts - Get all artifacts for a study
 * Requires: authentication
 */
router.get('/:id/artifacts', auth, validateStudyId, async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const artifacts = await StudyArtifact.findByStudyId(req.params.id);

    res.json({
      success: true,
      artifacts
    });

  } catch (error) {
    console.error('Error fetching study artifacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study artifacts'
    });
  }
});

// ============================================================================
// STUDY CRITERIA ENDPOINTS (Subtask 6.5)
// ============================================================================

/**
 * POST /api/studies/:id/criteria - Add criterion to study
 * Requires: authentication
 * Authorization: owner or admin
 * Body: { name, type, scale, description, display_order }
 */
router.post('/:id/criteria', auth, isStudyOwnerOrAdmin, validateAddCriteria, async (req, res) => {
  try {
    // Study is already attached by isStudyOwnerOrAdmin middleware
    const study = req.study;

    // Only allow adding criteria to draft studies
    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only add criteria to draft studies'
      });
    }

    const { name, type, scale, description, display_order } = req.body;

    // Get current criteria count to calculate display order
    const existingCriteria = await StudyCriteria.findByStudyId(req.params.id);
    const nextDisplayOrder = display_order !== undefined ? display_order : existingCriteria.length + 1;

    const criterion = await StudyCriteria.create({
      study_id: req.params.id,
      name,
      type,
      scale,
      description: description || null,
      display_order: nextDisplayOrder
    });

    res.status(201).json({
      success: true,
      message: 'Criterion added to study successfully',
      criterion
    });

  } catch (error) {
    console.error('Error adding criterion to study:', error);

    if (error.message.includes('Invalid scale')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add criterion to study'
    });
  }
});

/**
 * GET /api/studies/:id/criteria - Get all criteria for a study
 * Requires: authentication
 */
router.get('/:id/criteria', auth, validateStudyId, async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const criteria = await StudyCriteria.findByStudyId(req.params.id);

    res.json({
      success: true,
      criteria
    });

  } catch (error) {
    console.error('Error fetching study criteria:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study criteria'
    });
  }
});

/**
 * PUT /api/studies/:id/criteria/:criteriaId - Update criterion
 * Requires: authentication
 * Authorization: owner or admin
 * Body: { name, type, scale, description, display_order }
 */
router.put('/:id/criteria/:criteriaId', auth, isStudyOwnerOrAdmin, validateUpdateCriteria, async (req, res) => {
  try {
    // Study is already attached by isStudyOwnerOrAdmin middleware
    const study = req.study;

    // Only allow updating criteria in draft studies
    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only update criteria in draft studies'
      });
    }

    const { name, type, scale, description, display_order } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (scale !== undefined) updateData.scale = scale;
    if (description !== undefined) updateData.description = description;
    if (display_order !== undefined) updateData.display_order = display_order;

    const updatedCriterion = await StudyCriteria.update(req.params.criteriaId, updateData);

    if (!updatedCriterion) {
      return res.status(404).json({
        success: false,
        message: 'Criterion not found'
      });
    }

    res.json({
      success: true,
      message: 'Criterion updated successfully',
      criterion: updatedCriterion
    });

  } catch (error) {
    console.error('Error updating criterion:', error);

    if (error.message.includes('Invalid scale')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update criterion'
    });
  }
});

/**
 * DELETE /api/studies/:id/criteria/:criteriaId - Delete criterion
 * Requires: authentication
 * Authorization: owner or admin
 */
router.delete('/:id/criteria/:criteriaId', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    // Study is already attached by isStudyOwnerOrAdmin middleware
    const study = req.study;

    // Only allow deleting criteria from draft studies
    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete criteria from draft studies'
      });
    }

    const deleted = await StudyCriteria.delete(req.params.criteriaId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Criterion not found'
      });
    }

    res.json({
      success: true,
      message: 'Criterion deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting criterion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete criterion'
    });
  }
});


/**
 * GET /api/studies/:id/state-transitions - Get state transition history for a study
 * Requires: authentication
 * Authorization: owner, admin, or enrolled participant
 */
router.get('/:id/state-transitions', auth, canViewStudy, validateStudyId, async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const transitions = await Study.getStateTransitions(req.params.id);

    res.json({
      success: true,
      transitions
    });

  } catch (error) {
    console.error('Error fetching state transitions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch state transitions'
    });
  }
});

/**
 * GET /api/studies/:id/evaluation-data - Get evaluation data summary for a study
 * Requires: authentication
 * Authorization: owner or admin
 */
router.get('/:id/evaluation-data', auth, isStudyOwnerOrAdmin, validateStudyId, async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const evaluationData = await Study.getEvaluationData(req.params.id);

    res.json({
      success: true,
      evaluation_data: evaluationData
    });

  } catch (error) {
    console.error('Error fetching evaluation data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch evaluation data'
    });
  }
});

/**
 * GET /api/studies/:id/quizzes - Get all quizzes for a study
 * Requires: authentication
 * Note: Uses junction table study_quizzes for many-to-many relationship
 */
router.get('/:id/quizzes', auth, validateStudyId, async (req, res) => {
  try {
    const pool = require('../config/database');
    // Get quizzes via junction table (primary source)
    const result = await pool.query(
      `SELECT q.*, sq.assigned_at
       FROM quizzes q
       JOIN study_quizzes sq ON q.id = sq.quiz_id
       WHERE sq.study_id = $1
       ORDER BY sq.assigned_at DESC`,
      [req.params.id]
    );

    // Fallback: also check legacy study_id column for backward compatibility
    if (result.rows.length === 0) {
      const legacyResult = await pool.query(
        'SELECT * FROM quizzes WHERE study_id = $1 ORDER BY created_at DESC',
        [req.params.id]
      );
      return res.json({
        success: true,
        quizzes: legacyResult.rows
      });
    }

    res.json({
      success: true,
      quizzes: result.rows
    });

  } catch (error) {
    console.error('Error fetching study quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study quizzes'
    });
  }
});

/**
 * POST /api/studies/:id/quizzes - Assign quizzes to a study
 * Requires: authentication
 * Authorization: owner or admin
 * Body: { quizIds: [1, 2, 3] }
 * Note: Quizzes can be assigned to multiple studies via the study_quizzes junction table
 */
router.post('/:id/quizzes', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    const { quizIds } = req.body;
    const studyId = parseInt(req.params.id, 10);

    console.log(`[Assign Quizzes] Study ID: ${studyId}, Quiz IDs:`, quizIds);

    if (!Array.isArray(quizIds)) {
      return res.status(400).json({
        success: false,
        message: 'quizIds must be an array'
      });
    }

    if (quizIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one quiz ID is required'
      });
    }

    // Validate quizIds are numbers
    const validQuizIds = quizIds.filter(id => {
      const numId = parseInt(id, 10);
      return !isNaN(numId) && numId > 0;
    }).map(id => parseInt(id, 10));

    if (validQuizIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz IDs provided'
      });
    }

    const pool = require('../config/database');

    // Verify study exists
    const studyCheck = await pool.query(
      'SELECT id, created_by FROM studies WHERE id = $1',
      [studyId]
    );

    if (studyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    // Verify all quizzes exist
    const quizCheck = await pool.query(
      'SELECT id FROM quizzes WHERE id = ANY($1::int[])',
      [validQuizIds]
    );

    if (quizCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No quizzes found with the provided IDs'
      });
    }

    const existingQuizIds = quizCheck.rows.map(r => r.id);

    // Remove existing assignments for this study first (to handle re-assignment)
    await pool.query(
      'DELETE FROM study_quizzes WHERE study_id = $1',
      [studyId]
    );

    // Insert new assignments into junction table
    let assignedCount = 0;
    for (const quizId of existingQuizIds) {
      try {
        await pool.query(
          'INSERT INTO study_quizzes (study_id, quiz_id) VALUES ($1, $2) ON CONFLICT (study_id, quiz_id) DO NOTHING',
          [studyId, quizId]
        );
        assignedCount++;
      } catch (insertError) {
        console.error(`[Assign Quizzes] Failed to assign quiz ${quizId}:`, insertError.message);
      }
    }

    console.log(`[Assign Quizzes] Assigned ${assignedCount} quiz(zes) to study ${studyId} via junction table`);

    // Set the first quiz as required_quiz_id for backward compatibility
    const firstQuizId = existingQuizIds[0];
    const requiredQuizResult = await pool.query(
      'UPDATE studies SET required_quiz_id = $1 WHERE id = $2 RETURNING id, required_quiz_id',
      [firstQuizId, studyId]
    );

    console.log(`[Assign Quizzes] Set required_quiz_id to ${firstQuizId} for study ${studyId}`);

    res.json({
      success: true,
      message: `${assignedCount} quiz(zes) assigned to study`,
      assignedCount: assignedCount,
      requiredQuizId: firstQuizId
    });

  } catch (error) {
    console.error('[Assign Quizzes] Error assigning quizzes to study:', error);
    console.error('[Assign Quizzes] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to assign quizzes to study',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/studies/:id/participants/quiz-results - Get participant quiz results for a study
 * Requires: authentication
 * Authorization: owner or admin
 */
router.get('/:id/participants/quiz-results', auth, isStudyOwnerOrAdmin, validateStudyId, async (req, res) => {
  try {
    const studyId = req.params.id;
    const pool = require('../config/database');

    console.log(`[Quiz Results] Fetching participants for study ${studyId}`);

    // First, get all participants enrolled in the study (with DISTINCT to avoid duplicates)
    const participantsQuery = `
      SELECT DISTINCT
        u.id as participant_id,
        u.first_name,
        u.last_name,
        u.email
      FROM study_participants sp
      JOIN users u ON sp.participant_id = u.id
      WHERE sp.study_id = $1
      ORDER BY u.last_name, u.first_name
    `;
    const participantsResult = await pool.query(participantsQuery, [studyId]);
    
    console.log(`[Quiz Results] Found ${participantsResult.rows.length} participants for study ${studyId}`);

    // Get the quiz(es) for this study via junction table
    let quizzesResult = await pool.query(
      `SELECT q.id, q.title, q.passing_score 
       FROM quizzes q
       JOIN study_quizzes sq ON q.id = sq.quiz_id
       WHERE sq.study_id = $1`,
      [studyId]
    );
    
    // Fallback to legacy study_id column if no results from junction table
    if (quizzesResult.rows.length === 0) {
      quizzesResult = await pool.query(
        'SELECT id, title, passing_score FROM quizzes WHERE study_id = $1',
        [studyId]
      );
    }
    const studyQuizzes = quizzesResult.rows;
    const quizIds = studyQuizzes.map(q => q.id);

    // Get quiz attempts for participants in this study (only for study's quizzes)
    let attemptsMap = new Map();
    if (quizIds.length > 0) {
      const attemptsQuery = `
        SELECT 
          qa.id as attempt_id,
          qa.user_id,
          qa.quiz_id,
          qa.score,
          qa.passed,
          qa.answers,
          qa.submitted_at,
          qa.grading_status,
          q.title as quiz_title,
          q.passing_score
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.quiz_id = ANY($1)
        ORDER BY qa.submitted_at DESC
      `;
      const attemptsResult = await pool.query(attemptsQuery, [quizIds]);
      
      // Map attempts by user_id (take the latest attempt per user)
      for (const attempt of attemptsResult.rows) {
        if (!attemptsMap.has(attempt.user_id)) {
          attemptsMap.set(attempt.user_id, attempt);
        }
      }
    }

    // Process each participant
    const participants = [];

    for (const row of participantsResult.rows) {
      const participantData = {
        participant_id: row.participant_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        quiz_attempt: null
      };

      // Check if participant has taken a quiz for this study
      const attempt = attemptsMap.get(row.participant_id);
      if (attempt) {
        // Fetch questions for this quiz
        const questionsQuery = `
          SELECT 
            id,
            title,
            type,
            correct_answer,
            options,
            point_weight,
            order_index
          FROM quiz_questions
          WHERE quiz_id = $1
          ORDER BY order_index
        `;

        const questionsResult = await pool.query(questionsQuery, [attempt.quiz_id]);
        const userAnswers = attempt.answers || {};

        // Build per-question results
        const questions = questionsResult.rows.map(q => {
          const userAnswer = userAnswers[q.id];
          let isCorrect = null;

          // Determine correctness for auto-gradable questions
          if (q.type === 'multiple' && q.correct_answer !== null) {
            isCorrect = userAnswer === q.correct_answer;
          }

          return {
            question_id: q.id,
            question_title: q.title,
            question_type: q.type,
            user_answer: userAnswer,
            correct_answer: q.correct_answer,
            is_correct: isCorrect,
            options: q.options,
            point_weight: q.point_weight
          };
        });

        participantData.quiz_attempt = {
          attempt_id: attempt.attempt_id,
          quiz_id: attempt.quiz_id,
          quiz_title: attempt.quiz_title,
          score: attempt.score,
          passed: attempt.passed,
          passing_score: attempt.passing_score,
          grading_status: attempt.grading_status,
          submitted_at: attempt.submitted_at,
          questions: questions
        };
      }

      participants.push(participantData);
    }

    res.json({
      success: true,
      participants: participants
    });

  } catch (error) {
    console.error('Error fetching participant quiz results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch participant quiz results'
    });
  }
});



// ============================================================================
// STUDY QUESTIONS ENDPOINTS (US 3.5)
// ============================================================================

/**
 * GET /api/studies/questions/templates - Get criteria templates
 * Requires: authentication
 */
router.get('/questions/templates', auth, async (req, res) => {
  try {
    const templates = StudyQuestion.getTemplates();
    res.json({
      success: true,
      templates: templates.templates,
      scales: templates.scales
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates'
    });
  }
});

/**
 * POST /api/studies/:id/questions - Create a new question for a study
 * Requires: authentication
 * Authorization: owner or admin
 * Body: { title, description, display_order, artifacts: [{artifact_id, display_order}], criteria: [{name, type, scale, description, display_order}] }
 */
router.post('/:id/questions', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    const study = req.study;

    // Only allow adding questions to draft studies
    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only add questions to draft studies'
      });
    }

    const { title, description, question_type, display_order, artifacts, criteria } = req.body;

    console.log('=== CREATING QUESTION IN BACKEND ===');
    console.log('Request body:', req.body);
    console.log('Extracted question_type:', question_type);

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Question title is required'
      });
    }

    // Check if a question with the same title already exists for this study
    const existingQuestion = await StudyQuestion.findByTitleAndStudyId(req.params.id, title);
    if (existingQuestion) {
      return res.status(409).json({
        success: false,
        message: 'A question with this title already exists for this study',
        existingQuestion: existingQuestion
      });
    }

    // Get current question count to calculate display order
    const existingQuestions = await StudyQuestion.findByStudyId(req.params.id);
    const nextDisplayOrder = display_order !== undefined ? display_order : existingQuestions.length + 1;

    // Create question
    const question = await StudyQuestion.create({
      study_id: req.params.id,
      title,
      description: description || null,
      question_type: question_type || 'comparison',
      display_order: nextDisplayOrder
    });

    console.log('Created question:', question);

    // Add artifacts if provided
    if (artifacts && Array.isArray(artifacts)) {
      for (const artifact of artifacts) {
        await StudyQuestion.addArtifact(
          question.id,
          artifact.artifact_id,
          artifact.display_order
        );
      }
    }

    // Add criteria if provided
    if (criteria && Array.isArray(criteria)) {
      for (const criterion of criteria) {
        await StudyQuestion.addCriterion({
          question_id: question.id,
          name: criterion.name,
          type: criterion.type,
          scale: criterion.scale,
          description: criterion.description || null,
          display_order: criterion.display_order
        });
      }
    }

    // Fetch complete question with artifacts and criteria
    const completeQuestion = await StudyQuestion.findById(question.id);

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      question: completeQuestion
    });

  } catch (error) {
    console.error('Error creating question:', error);

    if (error.message.includes('Invalid scale') ||
      error.message.includes('Maximum of') ||
      error.message.includes('already added')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create question'
    });
  }
});

/**
 * GET /api/studies/:id/questions - Get all questions for a study
 * Requires: authentication
 */
router.get('/:id/questions', auth, validateStudyId, async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const questions = await StudyQuestion.findByStudyId(req.params.id);

    res.json({
      success: true,
      questions
    });

  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch questions'
    });
  }
});

/**
 * GET /api/studies/:id/questions/:questionId - Get a specific question
 * Requires: authentication
 */
router.get('/:id/questions/:questionId', auth, validateStudyId, async (req, res) => {
  try {
    const question = await StudyQuestion.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      question
    });

  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch question'
    });
  }
});

/**
 * PUT /api/studies/:id/questions/:questionId - Update a question
 * Requires: authentication
 * Authorization: owner or admin
 * Body: { title, description, display_order }
 */
router.put('/:id/questions/:questionId', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    const study = req.study;

    // Only allow updating questions in draft studies
    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only update questions in draft studies'
      });
    }

    const { title, description, display_order } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (display_order !== undefined) updateData.display_order = display_order;

    const updatedQuestion = await StudyQuestion.update(req.params.questionId, updateData);

    if (!updatedQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      message: 'Question updated successfully',
      question: updatedQuestion
    });

  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update question'
    });
  }
});

/**
 * DELETE /api/studies/:id/questions/:questionId - Delete a question
 * Requires: authentication
 * Authorization: owner or admin
 */
router.delete('/:id/questions/:questionId', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    const study = req.study;

    // Only allow deleting questions from draft studies
    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete questions from draft studies'
      });
    }

    const deleted = await StudyQuestion.delete(req.params.questionId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete question'
    });
  }
});

/**
 * POST /api/studies/:id/questions/:questionId/artifacts - Add artifact to question
 * Requires: authentication
 * Authorization: owner or admin
 * Body: { artifact_id, display_order }
 */
router.post('/:id/questions/:questionId/artifacts', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    const study = req.study;

    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only add artifacts to questions in draft studies'
      });
    }

    const { artifact_id, display_order } = req.body;

    if (!artifact_id) {
      return res.status(400).json({
        success: false,
        message: 'artifact_id is required'
      });
    }

    const questionArtifact = await StudyQuestion.addArtifact(
      req.params.questionId,
      artifact_id,
      display_order || 1
    );

    res.status(201).json({
      success: true,
      message: 'Artifact added to question successfully',
      question_artifact: questionArtifact
    });

  } catch (error) {
    console.error('Error adding artifact to question:', error);

    if (error.message.includes('already added') || error.message.includes('Maximum of')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add artifact to question'
    });
  }
});

/**
 * DELETE /api/studies/:id/questions/:questionId/artifacts/:artifactId - Remove artifact from question
 * Requires: authentication
 * Authorization: owner or admin
 */
router.delete('/:id/questions/:questionId/artifacts/:artifactId', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    const study = req.study;

    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only remove artifacts from questions in draft studies'
      });
    }

    const removed = await StudyQuestion.removeArtifact(
      req.params.questionId,
      parseInt(req.params.artifactId)
    );

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Artifact not found in question'
      });
    }

    res.json({
      success: true,
      message: 'Artifact removed from question successfully'
    });

  } catch (error) {
    console.error('Error removing artifact from question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove artifact from question'
    });
  }
});

/**
 * POST /api/studies/:id/questions/:questionId/criteria - Add criterion to question
 * Requires: authentication
 * Authorization: owner or admin
 * Body: { name, type, scale, description, display_order }
 */
router.post('/:id/questions/:questionId/criteria', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    const study = req.study;

    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only add criteria to questions in draft studies'
      });
    }

    const { name, type, scale, description, display_order } = req.body;

    if (!name || !type || !scale) {
      return res.status(400).json({
        success: false,
        message: 'name, type, and scale are required'
      });
    }

    // Check if a criterion with the same name already exists for this question
    const existingCriterion = await StudyQuestion.findCriterionByNameAndQuestionId(req.params.questionId, name);
    if (existingCriterion) {
      return res.status(409).json({
        success: false,
        message: 'A criterion with this name already exists for this question',
        existingCriterion: existingCriterion
      });
    }

    const criterion = await StudyQuestion.addCriterion({
      question_id: req.params.questionId,
      name,
      type,
      scale,
      description: description || null,
      display_order: display_order || 1
    });

    res.status(201).json({
      success: true,
      message: 'Criterion added to question successfully',
      criterion
    });

  } catch (error) {
    console.error('Error adding criterion to question:', error);

    if (error.message.includes('Invalid scale')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add criterion to question'
    });
  }
});

/**
 * PUT /api/studies/:id/questions/:questionId/criteria/:criterionId - Update criterion
 * Requires: authentication
 * Authorization: owner or admin
 * Body: { name, type, scale, description, display_order }
 */
router.put('/:id/questions/:questionId/criteria/:criterionId', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    const study = req.study;

    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only update criteria in draft studies'
      });
    }

    const { name, type, scale, description, display_order } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (scale !== undefined) updateData.scale = scale;
    if (description !== undefined) updateData.description = description;
    if (display_order !== undefined) updateData.display_order = display_order;

    const updatedCriterion = await StudyQuestion.updateCriterion(req.params.criterionId, updateData);

    if (!updatedCriterion) {
      return res.status(404).json({
        success: false,
        message: 'Criterion not found'
      });
    }

    res.json({
      success: true,
      message: 'Criterion updated successfully',
      criterion: updatedCriterion
    });

  } catch (error) {
    console.error('Error updating criterion:', error);

    if (error.message.includes('Invalid scale')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update criterion'
    });
  }
});

/**
 * DELETE /api/studies/:id/questions/:questionId/criteria/:criterionId - Remove criterion from question
 * Requires: authentication
 * Authorization: owner or admin
 */
router.delete('/:id/questions/:questionId/criteria/:criterionId', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    const study = req.study;

    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only remove criteria from questions in draft studies'
      });
    }

    const removed = await StudyQuestion.removeCriterion(req.params.criterionId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Criterion not found'
      });
    }

    res.json({
      success: true,
      message: 'Criterion removed from question successfully'
    });

  } catch (error) {
    console.error('Error removing criterion from question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove criterion from question'
    });
  }
});

/**
 * GET /api/studies/:id/participants - Get all participants for a study with quiz results
 * Requires: authentication
 * Authorization: owner or admin
 */
router.get('/:id/participants', auth, isStudyOwnerOrAdmin, validateStudyId, async (req, res) => {
  try {
    const studyId = req.params.id;
    const pool = require('../config/database');

    // 1. Fetch participants
    const participantsRes = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, sp.enrolled_at 
       FROM study_participants sp 
       JOIN users u ON sp.participant_id = u.id 
       WHERE sp.study_id = $1
       ORDER BY sp.enrolled_at DESC`,
      [studyId]
    );
    const participants = participantsRes.rows;

    // 2. Fetch study quiz via junction table
    let quizRes = await pool.query(
      `SELECT q.id, q.passing_score 
       FROM quizzes q
       JOIN study_quizzes sq ON q.id = sq.quiz_id
       WHERE sq.study_id = $1
       LIMIT 1`,
      [studyId]
    );
    
    // Fallback to legacy study_id column
    if (quizRes.rows.length === 0) {
      quizRes = await pool.query(
        'SELECT id, passing_score FROM quizzes WHERE study_id = $1',
        [studyId]
      );
    }
    const quiz = quizRes.rows[0];

    // 3. If quiz exists, fetch attempts and map to participants
    if (quiz) {
      const attemptsRes = await pool.query(
        `SELECT DISTINCT ON (user_id) user_id, score, grading_status, submitted_at
         FROM quiz_attempts 
         WHERE quiz_id = $1
         ORDER BY user_id, submitted_at DESC`,
        [quiz.id]
      );

      const attemptsMap = new Map();
      attemptsRes.rows.forEach(attempt => {
        attemptsMap.set(attempt.user_id, attempt);
      });

      // Add quiz results to participants
      participants.forEach(p => {
        const attempt = attemptsMap.get(p.id);
        if (attempt) {
          p.quiz_score = attempt.score;
          p.quiz_status = attempt.score >= quiz.passing_score ? 'Pass' : 'Fail';
        } else {
          p.quiz_score = null;
          p.quiz_status = 'Pending';
        }
      });
    } else {
      // No quiz assigned to study
      participants.forEach(p => {
        p.quiz_score = null;
        p.quiz_status = 'N/A';
      });
    }

    res.json({
      success: true,
      participants
    });

  } catch (error) {
    console.error('Error fetching study participants:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study participants'
    });
  }
});

/**
 * GET /api/studies/:id/quiz-results - Get study quiz results
 * Requires: authentication
 * Authorization: owner or admin
 */
router.get('/:id/quiz-results', auth, isStudyOwnerOrAdmin, async (req, res) => {
  try {
    const results = await Study.getQuizResults(req.params.id);
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error fetching quiz results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz results'
    });
  }
});

// ============================================================================
// TRASH BIN MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/studies/:id/restore - Restore study from trash bin
 * Requires: authentication
 * Authorization: owner or admin
 */
router.post('/:id/restore', auth, async (req, res) => {
  try {
    // Check if user has permission to restore this study
    const study = await Study.findById(req.params.id);
    
    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    // Check if user is owner or admin
    const isOwner = study.created_by === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only study owner or admin can restore studies.'
      });
    }

    const restoredStudy = await Study.restore(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Study restored from trash bin successfully',
      study: restoredStudy
    });

  } catch (error) {
    console.error('Error restoring study:', error);

    if (error.message.includes('not deleted') || error.message.includes('not found') || error.message.includes('previous status')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to restore study'
    });
  }
});

/**
 * DELETE /api/studies/:id/permanent - Permanently delete study
 * Requires: authentication
 * Authorization: owner or admin
 */
router.delete('/:id/permanent', auth, async (req, res) => {
  try {
    // Check if user has permission to permanently delete this study
    const study = await Study.findById(req.params.id);
    
    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    // Check if user is owner or admin
    const isOwner = study.created_by === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only study owner or admin can permanently delete studies.'
      });
    }

    const deleted = await Study.permanentDelete(req.params.id, req.user.id);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: 'Failed to permanently delete study'
      });
    }

    res.json({
      success: true,
      message: 'Study permanently deleted successfully'
    });

  } catch (error) {
    console.error('Error permanently deleting study:', error);

    if (error.message.includes('trash bin')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete study'
    });
  }
});

module.exports = router;
