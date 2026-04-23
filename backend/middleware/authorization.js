/**
 * Authorization Middleware
 * Provides role-based and ownership-based access control for study operations
 */

const Study = require('../models/study');

/**
 * Check if user is the owner of a study
 */
const isStudyOwner = async (req, res, next) => {
  try {
    const studyId = req.params.id;
    const study = await Study.findById(studyId);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    if (study.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only study owner can perform this action'
      });
    }

    // Attach study to request for use in route handler
    req.study = study;
    next();
  } catch (error) {
    console.error('Error checking study ownership:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify study ownership'
    });
  }
};

/**
 * Check if user is the owner of a study OR an admin
 */
const isStudyOwnerOrAdmin = async (req, res, next) => {
  try {
    const studyId = req.params.id;
    const study = await Study.findById(studyId);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const isOwner = study.created_by === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only study owner or admin can perform this action'
      });
    }

    // Attach study to request for use in route handler
    req.study = study;
    req.isOwner = isOwner;
    req.isAdmin = isAdmin;
    next();
  } catch (error) {
    console.error('Error checking study authorization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify study authorization'
    });
  }
};

/**
 * Check if user can view a study
 * Allows: owner, admin, or enrolled participant
 * Blocks access to deleted studies for participants
 */
const canViewStudy = async (req, res, next) => {
  try {
    const studyId = req.params.id;
    const study = await Study.findById(studyId);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const isOwner = study.created_by === req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Block access to deleted studies for participants
    if (study.status === 'deleted' && !isOwner && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    // For researchers, only allow viewing their own studies (unless admin/reviewer)
    if (req.user.role === 'researcher' && !isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own studies'
      });
    }

    // For participants, check enrollment (allow viewing if enrolled)
    if (req.user.role === 'participant' && !isOwner && !isAdmin) {
      const pool = require('../config/database');
      const enrollmentCheck = await pool.query(
        'SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2 LIMIT 1',
        [studyId, req.user.id]
      );
      if (enrollmentCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You must be enrolled in this study to view it'
        });
      }
    }

    // Attach study to request for use in route handler
    req.study = study;
    req.isOwner = isOwner;
    req.isAdmin = isAdmin;
    next();
  } catch (error) {
    console.error('Error checking study view permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify study view permission'
    });
  }
};

/**
 * Check if user can edit a study
 * Allows: owner or admin
 * Additional checks: study must be in draft or active status (not deleted)
 */
const canEditStudy = async (req, res, next) => {
  try {
    const studyId = req.params.id;
    const study = await Study.findById(studyId);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const isOwner = study.created_by === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only study owner or admin can edit this study'
      });
    }

    // Check if study can be edited based on status
    if (!['draft', 'active'].includes(study.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit study in ${study.status} status`
      });
    }

    // Attach study to request for use in route handler
    req.study = study;
    req.isOwner = isOwner;
    req.isAdmin = isAdmin;
    next();
  } catch (error) {
    console.error('Error checking study edit permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify study edit permission'
    });
  }
};

/**
 * Check if user can cancel a study (researcher cancellation)
 * Allows: owner only
 * Additional checks: study must be in draft or active status
 */
const canCancelStudy = async (req, res, next) => {
  try {
    const studyId = req.params.id;
    const study = await Study.findById(studyId);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const isOwner = study.created_by === req.user.id;

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only study owner can cancel this study'
      });
    }

    // Check if study can be cancelled
    if (!['draft', 'active'].includes(study.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel study in ${study.status} status`
      });
    }

    // Attach study to request for use in route handler
    req.study = study;
    next();
  } catch (error) {
    console.error('Error checking study cancel permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify study cancel permission'
    });
  }
};

/**
 * Check if user can perform admin cancellation
 * Allows: admin only
 * Additional checks: study must be in draft or active status
 */
const canAdminCancelStudy = async (req, res, next) => {
  try {
    const studyId = req.params.id;
    const study = await Study.findById(studyId);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    // Admin role check is already done by requireAdmin middleware
    // Just verify study status
    if (!['draft', 'active'].includes(study.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel study in ${study.status} status`
      });
    }

    // Attach study to request for use in route handler
    req.study = study;
    next();
  } catch (error) {
    console.error('Error checking admin cancel permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify admin cancel permission'
    });
  }
};

/**
 * Check if user can delete a study (move to trash)
 * Allows: owner or admin
 * Additional checks: study must not already be deleted
 */
const canDeleteStudy = async (req, res, next) => {
  try {
    const studyId = req.params.id;
    const study = await Study.findById(studyId);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const isOwner = study.created_by === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only study owner or admin can delete this study'
      });
    }

    // Check if study is already deleted
    if (study.status === 'deleted') {
      return res.status(400).json({
        success: false,
        message: 'Study is already deleted'
      });
    }

    // Attach study to request for use in route handler
    req.study = study;
    next();
  } catch (error) {
    console.error('Error checking study delete permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify study delete permission'
    });
  }
};

module.exports = {
  isStudyOwner,
  isStudyOwnerOrAdmin,
  canViewStudy,
  canEditStudy,
  canCancelStudy,
  canAdminCancelStudy,
  canDeleteStudy
};
