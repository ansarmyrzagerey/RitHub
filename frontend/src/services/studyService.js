import api from './api';

export const studyService = {
  // Get all studies with optional filters
  async getStudies(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.creator) params.append('creator', filters.creator);
    if (filters.search) params.append('search', filters.search);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await api.get(`/studies?${params.toString()}`);
    return response.data;
  },

  // Get specific study
  async getStudy(id) {
    const response = await api.get(`/studies/${id}`);
    return response.data;
  },

  // Create new study
  async createStudy(studyData) {
    const response = await api.post('/studies', studyData);
    return response.data;
  },

  // Update study
  async updateStudy(id, studyData) {
    const response = await api.put(`/studies/${id}`, studyData);
    return response.data;
  },

  // Delete study (move to trash)
  async deleteStudy(id) {
    const response = await api.delete(`/studies/${id}`);
    return response.data;
  },

  // Restore study from trash
  async restoreStudy(id) {
    const response = await api.post(`/studies/${id}/restore`);
    return response.data;
  },

  // Permanently delete study
  async permanentDeleteStudy(id) {
    const response = await api.delete(`/studies/${id}/permanent`);
    return response.data;
  },

  // Get deleted studies (trash bin)
  async getDeletedStudies() {
    const response = await api.get('/studies/trash');
    return response.data;
  },

  // Activate study
  async activateStudy(id) {
    const response = await api.post(`/studies/${id}/activate`);
    return response.data;
  },

  // Cancel study (researcher)
  async cancelStudy(id, reason) {
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    const payload = trimmed ? { reason: trimmed } : {};
    const response = await api.post(`/studies/${id}/cancel`, payload);
    return response.data;
  },

  // Admin cancel study
  async adminCancelStudy(id, reason) {
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    const response = await api.post(`/studies/${id}/admin-cancel`, { reason: trimmed });
    return response.data;
  },

  // Archive study
  async archiveStudy(id) {
    const response = await api.post(`/studies/${id}/archive`);
    return response.data;
  },

  // Generate enrollment link
  async generateEnrollmentLink(id) {
    const response = await api.post(`/studies/${id}/enrollment-link`);
    return response.data;
  },

  // Get enrollment link
  async getEnrollmentLink(id) {
    const response = await api.get(`/studies/${id}/enrollment-link`);
    return response.data;
  },

  // Invalidate enrollment link
  async invalidateEnrollmentLink(id) {
    const response = await api.delete(`/studies/${id}/enrollment-link`);
    return response.data;
  },

  // Add artifact to study
  async addArtifactToStudy(id, artifactId, displayOrder) {
    const response = await api.post(`/studies/${id}/artifacts`, {
      artifact_id: artifactId,
      display_order: displayOrder
    });
    return response.data;
  },

  // Remove artifact from study
  async removeArtifactFromStudy(id, artifactId) {
    const response = await api.delete(`/studies/${id}/artifacts/${artifactId}`);
    return response.data;
  },

  // Get study artifacts
  async getStudyArtifacts(id) {
    const response = await api.get(`/studies/${id}/artifacts`);
    return response.data;
  },

  // Add criterion to study
  async addCriterionToStudy(id, criterion) {
    const response = await api.post(`/studies/${id}/criteria`, criterion);
    return response.data;
  },

  // Get study statistics for dashboard
  async getStatistics() {
    const response = await api.get('/studies/statistics');
    return response.data;
  },

  // Get state transition history for a study
  async getStateTransitions(id) {
    const response = await api.get(`/studies/${id}/state-transitions`);
    return response.data;
  },

  // Get evaluation data summary for a study
  async getEvaluationData(id) {
    const response = await api.get(`/studies/${id}/evaluation-data`);
    return response.data;
  },

  // Get quizzes for a study
  async getStudyQuizzes(id) {
    const response = await api.get(`/studies/${id}/quizzes`);
    return response.data;
  },

  // Assign quizzes to a study
  async assignQuizzesToStudy(id, quizIds) {
    const response = await api.post(`/studies/${id}/quizzes`, { quizIds });
    return response.data;
  },

  // ============================================================================
  // STUDY QUESTIONS API (US 3.5)
  // ============================================================================

  // Get criteria templates
  async getQuestionTemplates() {
    const response = await api.get('/studies/questions/templates');
    return response.data;
  },

  // Create a new question for a study
  async createQuestion(studyId, questionData) {
    const response = await api.post(`/studies/${studyId}/questions`, questionData);
    return response.data;
  },

  // Get all questions for a study
  async getStudyQuestions(studyId) {
    const response = await api.get(`/studies/${studyId}/questions`);
    return response.data;
  },

  // Get a specific question
  async getQuestion(studyId, questionId) {
    const response = await api.get(`/studies/${studyId}/questions/${questionId}`);
    return response.data;
  },

  // Update a question
  async updateQuestion(studyId, questionId, questionData) {
    const response = await api.put(`/studies/${studyId}/questions/${questionId}`, questionData);
    return response.data;
  },

  // Delete a question
  async deleteQuestion(studyId, questionId) {
    const response = await api.delete(`/studies/${studyId}/questions/${questionId}`);
    return response.data;
  },

  // Add artifact to question
  async addArtifactToQuestion(studyId, questionId, artifactId, displayOrder) {
    const response = await api.post(`/studies/${studyId}/questions/${questionId}/artifacts`, {
      artifact_id: artifactId,
      display_order: displayOrder
    });
    return response.data;
  },

  // Remove artifact from question
  async removeArtifactFromQuestion(studyId, questionId, artifactId) {
    const response = await api.delete(`/studies/${studyId}/questions/${questionId}/artifacts/${artifactId}`);
    return response.data;
  },

  // Add criterion to question
  async addCriterionToQuestion(studyId, questionId, criterion) {
    const response = await api.post(`/studies/${studyId}/questions/${questionId}/criteria`, criterion);
    return response.data;
  },

  // Update criterion
  async updateQuestionCriterion(studyId, questionId, criterionId, criterion) {
    const response = await api.put(`/studies/${studyId}/questions/${questionId}/criteria/${criterionId}`, criterion);
    return response.data;
  },

  // Remove criterion from question
  async removeQuestionCriterion(studyId, questionId, criterionId) {
    const response = await api.delete(`/studies/${studyId}/questions/${questionId}/criteria/${criterionId}`);
    return response.data;
  },

  // ============================================================================
  // PARTICIPANT & RESULTS API
  // ============================================================================

  // Get study participants
  async getStudyParticipants(studyId) {
    const response = await api.get(`/studies/${studyId}/participants`);
    return response.data;
  },

  // Get study quiz results
  async getStudyQuizResults(studyId) {
    const response = await api.get(`/studies/${studyId}/quiz-results`);
    return response.data;
  },

  // Get participants with their quiz results (combined endpoint for US 4.7)
  async getParticipantsWithQuizResults(studyId) {
    const response = await api.get(`/studies/${studyId}/participants/quiz-results`);
    return response.data;
  },

  // ============================================================================
  // ADMIN TRASH BIN API
  // ============================================================================

  // Get all deleted studies (admin view)
  async getAdminDeletedStudies() {
    const response = await api.get('/admin/studies/trash');
    return response.data;
  },

  // Admin restore study
  async adminRestoreStudy(id) {
    const response = await api.post(`/admin/studies/${id}/restore`);
    return response.data;
  },

  // Admin permanently delete study
  async adminPermanentDeleteStudy(id) {
    const response = await api.delete(`/admin/studies/${id}/permanent`);
    return response.data;
  },

  // Run manual cleanup
  async runManualCleanup(retentionDays = 20) {
    const response = await api.post('/admin/studies/cleanup', { retentionDays });
    return response.data;
  },

  // Get trash statistics
  async getTrashStats() {
    const response = await api.get('/admin/studies/trash/stats');
    return response.data;
  },
};

export default studyService;
