import axios from 'axios';

// Use relative path by default so the CRA dev proxy (or the same-origin host) can forward requests.
// Set REACT_APP_API_URL in the environment when running in Docker to point to the backend service (e.g. http://backend:5000/api).
// When running in Docker, the browser needs to access the backend through localhost:5000
const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '/api');

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add loading state tracking
let activeRequests = 0;

// Request interceptor - track loading state
api.interceptors.request.use(
  (config) => {
    activeRequests++;
    // Dispatch loading event
    window.dispatchEvent(new CustomEvent('api-loading', { detail: { loading: true } }));
    return config;
  },
  (error) => {
    activeRequests--;
    if (activeRequests === 0) {
      window.dispatchEvent(new CustomEvent('api-loading', { detail: { loading: false } }));
    }
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors and loading state
api.interceptors.response.use(
  (response) => {
    activeRequests--;
    if (activeRequests === 0) {
      window.dispatchEvent(new CustomEvent('api-loading', { detail: { loading: false } }));
    }
    return response;
  },
  (error) => {
    activeRequests--;
    if (activeRequests === 0) {
      window.dispatchEvent(new CustomEvent('api-loading', { detail: { loading: false } }));
    }

    // Handle auth errors
    // Don't redirect on 401 for change-password endpoint - let the component handle the error
    if (error.response?.status === 401 && !error.config?.url?.includes('/change-password')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// API service classes
class AuthService {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  }

  async register(userData) {
    const response = await api.post('/auth/register', userData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  }

  async forgotPassword(email) {
    const response = await api.post('/users/forgot-password', { email });
    return response.data;
  }

  logout() {
    localStorage.removeItem('token');
  }

  getCurrentUser() {
    return api.get('/users/profile');
  }

  requestEmailVerification(userId) {
    return api.post(`/users/${userId}/request-verification`);
  }

  verifyEmail(token) {
    return api.get(`/auth/verify?token=${token}`);
  }
}

// Participant Service
class ParticipantService {
  async getAssignedStudies() {
    return api.get('/participant/studies');
  }

  async getStudyDetails(studyId) {
    return api.get(`/participant/studies/${studyId}`);
  }

  async getTasks(studyId = null) {
    const url = studyId ? `/participant/tasks?studyId=${studyId}` : '/participant/tasks';
    return api.get(url);
  }

  async getTaskDetails(taskId) {
    return api.get(`/participant/tasks/${taskId}`);
  }

  async submitEvaluation(taskId, evaluationData) {
    return api.post(`/participant/tasks/${taskId}/evaluate`, evaluationData);
  }

  async getDeadlines() {
    return api.get('/participant/deadlines');
  }

  async getCompletedStudies() {
    return api.get('/participant/studies/completed');
  }

  async getQuizzes() {
    return api.get('/participant/quizzes');
  }

  async getQuizDetails(quizId) {
    return api.get(`/participant/quizzes/${quizId}`);
  }

  async submitQuiz(quizId, quizData) {
    return api.post(`/participant/quizzes/${quizId}/submit`, quizData);
  }
}

// User Service
class UserService {
  async changePassword(userId, passwordData) {
    const response = await api.post(`/users/${userId}/change-password`, passwordData);
    return response.data;
  }

  async updateProfile(userId, userData) {
    const response = await api.put(`/users/${userId}`, userData);
    return response.data;
  }

  async deleteAccount(userId, password) {
    const response = await api.post(`/users/${userId}/delete`, { password });
    return response.data;
  }
}

// Export service instances
export const authService = new AuthService();
export const participantService = new ParticipantService();
export const userService = new UserService();

export default api;