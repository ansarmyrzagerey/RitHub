import toast from 'react-hot-toast';

/**
 * Extract error message from API error response
 * @param {Error} error - Error object from API call
 * @returns {string} - User-friendly error message
 */
export const getErrorMessage = (error) => {
  // Network error
  if (!error.response) {
    return 'Network error. Please check your connection and try again.';
  }

  // API error response
  const { data, status } = error.response;

  // Handle validation errors with details
  if (data?.details && typeof data.details === 'object') {
    const errorMessages = Object.values(data.details);
    return errorMessages.join('. ');
  }

  // Handle error message from API
  if (data?.message) {
    return data.message;
  }

  // Handle error string from API
  if (data?.error) {
    return data.error;
  }

  // Default messages based on status code
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'You are not authorized. Please log in and try again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'A conflict occurred. The resource may already exist.';
    case 422:
      return 'Validation failed. Please check your input.';
    case 500:
      return 'Server error. Please try again later.';
    case 503:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

/**
 * Handle API error and show toast notification
 * @param {Error} error - Error object from API call
 * @param {string} defaultMessage - Optional default message
 * @returns {string} - Error message
 */
export const handleApiError = (error, defaultMessage = null) => {
  const message = defaultMessage || getErrorMessage(error);
  
  // Show error toast
  toast.error(message, {
    duration: 5000,
    position: 'top-right',
  });

  // Log error for debugging
  console.error('API Error:', {
    message,
    error,
    response: error.response,
    timestamp: new Date().toISOString()
  });

  return message;
};

/**
 * Show success toast notification
 * @param {string} message - Success message
 */
export const showSuccess = (message) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
  });
};

/**
 * Show info toast notification
 * @param {string} message - Info message
 */
export const showInfo = (message) => {
  toast(message, {
    duration: 3000,
    position: 'top-right',
    icon: 'ℹ️',
  });
};

/**
 * Show warning toast notification
 * @param {string} message - Warning message
 */
export const showWarning = (message) => {
  toast(message, {
    duration: 4000,
    position: 'top-right',
    icon: '⚠️',
  });
};

/**
 * Retry a failed API call with exponential backoff
 * @param {Function} apiCall - Function that returns a Promise
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @returns {Promise} - Result of the API call
 */
export const retryApiCall = async (apiCall, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx) except 408 (timeout) and 429 (rate limit)
      if (error.response) {
        const status = error.response.status;
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          throw error;
        }
      }

      // Don't retry if this was the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      
      // Show retry notification
      showInfo(`Retrying... (Attempt ${attempt + 1}/${maxRetries})`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  throw lastError;
};

/**
 * Wrapper for API calls with automatic error handling and retry
 * @param {Function} apiCall - Function that returns a Promise
 * @param {object} options - Options for error handling
 * @param {boolean} options.showError - Show error toast (default: true)
 * @param {boolean} options.retry - Enable retry on failure (default: false)
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {string} options.errorMessage - Custom error message
 * @returns {Promise} - Result of the API call
 */
export const withErrorHandling = async (apiCall, options = {}) => {
  const {
    showError = true,
    retry = false,
    maxRetries = 3,
    errorMessage = null
  } = options;

  try {
    if (retry) {
      return await retryApiCall(apiCall, maxRetries);
    } else {
      return await apiCall();
    }
  } catch (error) {
    if (showError) {
      handleApiError(error, errorMessage);
    }
    throw error;
  }
};

/**
 * Check if error is a network error
 * @param {Error} error - Error object
 * @returns {boolean}
 */
export const isNetworkError = (error) => {
  return !error.response && error.message === 'Network Error';
};

/**
 * Check if error is an authentication error
 * @param {Error} error - Error object
 * @returns {boolean}
 */
export const isAuthError = (error) => {
  return error.response && error.response.status === 401;
};

/**
 * Check if error is a validation error
 * @param {Error} error - Error object
 * @returns {boolean}
 */
export const isValidationError = (error) => {
  return error.response && (error.response.status === 400 || error.response.status === 422);
};

/**
 * Format validation errors for display
 * @param {Error} error - Error object with validation details
 * @returns {object} - Formatted validation errors
 */
export const formatValidationErrors = (error) => {
  if (!error.response || !error.response.data || !error.response.data.details) {
    return {};
  }

  return error.response.data.details;
};
