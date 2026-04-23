// General utility functions

/**
 * Check if a path is currently active
 * @param {string} currentPath - Current location pathname
 * @param {string} targetPath - Path to check against
 * @returns {boolean}
 */
export const isActivePath = (currentPath, targetPath) => {
  return currentPath === targetPath;
};

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string}
 */
export const formatNumber = (num) => {
  return num.toLocaleString();
};

/**
 * Get status color based on status string
 * @param {string} status - Status string
 * @returns {string}
 */
export const getStatusColor = (status) => {
  const statusColors = {
    active: 'success',
    completed: 'primary',
    draft: 'default',
    pending: 'warning',
    error: 'error',
  };
  return statusColors[status] || 'default';
};

/**
 * Get status icon based on status string
 * @param {string} status - Status string
 * @returns {string}
 */
export const getStatusIcon = (status) => {
  const statusIcons = {
    active: 'PlayArrow',
    completed: 'CheckCircle',
    draft: 'Schedule',
    pending: 'Pending',
    error: 'Error',
  };
  return statusIcons[status] || 'Schedule';
};

/**
 * Generate random ID
 * @param {number} length - Length of ID
 * @returns {string}
 */
export const generateId = (length = 8) => {
  return Math.random().toString(36).substr(2, length);
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function}
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function}
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
