import axios from 'axios';

const API_BASE_URL = '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const quizService = {
  // Generate quiz using AI
  async generateAIQuiz(data) {
    const response = await api.post('/quizzes/generate-ai', data);
    return response.data;
  },

  // Get all quizzes
  async getQuizzes() {
    const response = await api.get('/quizzes');
    return response.data;
  },
  // Get all badges
  async getBadges() {
    const response = await api.get('/badges');
    return response.data;
  },

  // Get specific quiz
  async getQuiz(id) {
    const response = await api.get(`/quizzes/${id}`);
    return response.data;
  },

  // Create new quiz
  async createQuiz(data) {
    const response = await api.post('/quizzes', data);
    return response.data;
  },

  // Update quiz
  async updateQuiz(id, data) {
    const response = await api.put(`/quizzes/${id}`, data);
    return response.data;
  },

  // Publish quiz
  async publishQuiz(id) {
    const response = await api.post(`/quizzes/${id}/publish`);
    return response.data;
  },

  // Delete quiz
  async deleteQuiz(id) {
    const response = await api.delete(`/quizzes/${id}`);
    return response.data;
  },

  // Check user eligibility for quiz
  async checkEligibility(id) {
    const response = await api.get(`/quizzes/${id}/eligibility`);
    return response.data;
  },

  // Get all questions for a quiz
  async getQuestions(quizId) {
    const response = await api.get(`/quizzes/${quizId}/questions`);
    return response.data;
  },

  // Add question to quiz
  async addQuestion(quizId, data) {
    const response = await api.post(`/quizzes/${quizId}/questions`, data);
    return response.data;
  },

  // Update question
  async updateQuestion(quizId, questionId, data) {
    const response = await api.put(`/quizzes/${quizId}/questions/${questionId}`, data);
    return response.data;
  },

  // Delete question
  async deleteQuestion(quizId, questionId) {
    const response = await api.delete(`/quizzes/${quizId}/questions/${questionId}`);
    return response.data;
  },

  // Request AI grading for a quiz attempt
  async requestAIGrading(quizId, attemptId) {
    const response = await api.post(`/quizzes/${quizId}/attempts/${attemptId}/ai-grade`);
    return response.data;
  },
};

export default quizService;
