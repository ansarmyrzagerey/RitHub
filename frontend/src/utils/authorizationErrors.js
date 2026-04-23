/**
 * Authorization Error Messages
 * Provides user-friendly error messages for authorization failures
 */

export const AUTH_ERROR_MESSAGES = {
  NOT_RESEARCHER: 'Only researchers can create studies.',
  NOT_OWNER: 'Only the study owner can perform this action.',
  NOT_OWNER_OR_ADMIN: 'Only the study owner or an admin can perform this action.',
  NOT_ADMIN: 'Only administrators can perform this action.',
  CANNOT_EDIT_STATUS: 'Cannot edit study in this status.',
  CANNOT_CANCEL_STATUS: 'Cannot cancel study in this status.',
  CANNOT_DELETE_STATUS: 'Only draft studies can be deleted.',
  GENERIC: 'You do not have permission to perform this action.',
};

/**
 * Check if user can create studies
 */
export const canCreateStudy = (user) => {
  return user?.role === 'researcher';
};

/**
 * Check if user can edit a study
 */
export const canEditStudy = (user, study) => {
  if (!user || !study) return false;
  
  const isOwner = user.id === study.created_by;
  const isAdmin = user.role === 'admin';
  
  return (isOwner || isAdmin) && ['draft', 'active'].includes(study.status);
};

/**
 * Check if user can cancel a study (researcher cancellation)
 */
export const canCancelStudy = (user, study) => {
  if (!user || !study) return false;
  
  const isOwner = user.id === study.created_by;
  
  return isOwner && ['draft', 'active'].includes(study.status);
};

/**
 * Check if user can admin cancel a study
 */
export const canAdminCancelStudy = (user, study) => {
  if (!user || !study) return false;
  
  const isAdmin = user.role === 'admin';
  
  return isAdmin && ['draft', 'active'].includes(study.status);
};

/**
 * Check if user can delete a study
 */
export const canDeleteStudy = (user, study) => {
  if (!user || !study) return false;
  
  const isOwner = user.id === study.created_by;
  const isAdmin = user.role === 'admin';
  
  return (isOwner || isAdmin) && study.status === 'draft';
};

/**
 * Check if user can view a study
 */
export const canViewStudy = (user, study) => {
  if (!user || !study) return false;
  
  // For now, all authenticated users can view studies
  // In the future, we can add participant enrollment check
  return true;
};

/**
 * Check if user can manage enrollment links
 */
export const canManageEnrollmentLink = (user, study) => {
  if (!user || !study) return false;
  
  const isOwner = user.id === study.created_by;
  const isAdmin = user.role === 'admin';
  
  return isOwner || isAdmin;
};

/**
 * Get appropriate error message for authorization failure
 */
export const getAuthErrorMessage = (action, user, study) => {
  switch (action) {
    case 'create':
      return AUTH_ERROR_MESSAGES.NOT_RESEARCHER;
    case 'edit':
      if (!user || study.created_by !== user.id) {
        return AUTH_ERROR_MESSAGES.NOT_OWNER_OR_ADMIN;
      }
      return AUTH_ERROR_MESSAGES.CANNOT_EDIT_STATUS;
    case 'cancel':
      if (!user || study.created_by !== user.id) {
        return AUTH_ERROR_MESSAGES.NOT_OWNER;
      }
      return AUTH_ERROR_MESSAGES.CANNOT_CANCEL_STATUS;
    case 'admin-cancel':
      return AUTH_ERROR_MESSAGES.NOT_ADMIN;
    case 'delete':
      if (!user || (study.created_by !== user.id && user.role !== 'admin')) {
        return AUTH_ERROR_MESSAGES.NOT_OWNER_OR_ADMIN;
      }
      return AUTH_ERROR_MESSAGES.CANNOT_DELETE_STATUS;
    default:
      return AUTH_ERROR_MESSAGES.GENERIC;
  }
};
