import api from './api';

const ParticipantService = {
  getNotifications() {
    return api.get('/participant/notifications').then(r => r.data);
  },
  markRead(notificationId) {
    return api.patch(`/participant/notifications/${notificationId}/read`).then(r => r.data);
  },
  markUnread(notificationId) {
    return api.patch(`/participant/notifications/${notificationId}/unread`).then(r => r.data);
  },
  getAssignedStudies(params) {
    return api.get('/participant/studies', { params })
      .then(r => {
        // Backend returns array directly, axios wraps it in r.data
        return r.data;
      })
      .catch(error => {
        console.error('Error fetching assigned studies:', error);
        // Return empty array on error instead of throwing
        return [];
      });
  },
  getStudyDetails(studyId, params = {}) {
    return api.get(`/participant/studies/${studyId}`, { params }).then(r => r.data);
  },
  getStudyTasks(studyId, params = {}) {
    return api.get(`/participant/studies/${studyId}/tasks`, { params }).then(r => r.data);
  },
  startTask(taskId) {
    return api.post(`/participant/tasks/${taskId}/start`).then(r => r.data);
  },
  submitTask(taskId, taskData) {
    return api.post(`/participant/tasks/${taskId}/submit`, taskData).then(r => r.data);
  },
  getTaskDetails(taskId) {
    return api.get(`/participant/tasks/${taskId}`).then(r => r.data);
  },
  getDraftEvaluation(studyId) {
    return api.get(`/participant/studies/${studyId}/draft`).then(r => r.data);
  },
  saveDraftEvaluation(studyId, taskAnswers) {
    return api.post(`/participant/studies/${studyId}/draft`, { task_answers: taskAnswers }).then(r => r.data);
  },
  completeDraftEvaluation(studyId) {
    return api.post(`/participant/studies/${studyId}/draft/complete`).then(r => r.data);
  },
  getCompletedEvaluations(studyId, params = {}) {
    return api.get(`/participant/studies/${studyId}/completed-evaluations`, { params }).then(r => r.data);
  },
  uploadScreenshot(taskId, formData) {
    return api.post(`/participant/tasks/${taskId}/upload-screenshot`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).then(r => r.data);
  },
  uploadHighlightImage(taskId, formData) {
    return api.post(`/participant/tasks/${taskId}/upload-highlight-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).then(r => r.data);
  },
  getDashboardTasks() {
    return api.get('/participant/dashboard/tasks').then(r => r.data);
  },
  getDashboardDeadlines() {
    return api.get('/participant/dashboard/deadlines').then(r => r.data);
  },
  saveEvaluationTags(taskId, tags) {
    return api.post(`/participant/tasks/${taskId}/tags`, { tags }).then(r => r.data);
  },
  getEvaluationTags(taskId) {
    return api.get(`/participant/tasks/${taskId}/tags`).then(r => r.data);
  },
  // Evaluation trash bin methods
  getDeletedEvaluations() {
    return api.get('/participant/evaluations/trash').then(r => r.data);
  },
  deleteEvaluation(evaluationId) {
    return api.delete(`/participant/evaluations/${evaluationId}`).then(r => r.data);
  },
  restoreEvaluation(evaluationId) {
    return api.post(`/participant/evaluations/${evaluationId}/restore`).then(r => r.data);
  },
  permanentDeleteEvaluation(evaluationId) {
    return api.delete(`/participant/evaluations/${evaluationId}/permanent`).then(r => r.data);
  },
  // Quiz attempt trash bin methods
  getDeletedQuizAttempts() {
    return api.get('/participant/quiz-attempts/trash').then(r => r.data);
  },
  deleteQuizAttempt(attemptId) {
    return api.delete(`/participant/quiz-attempts/${attemptId}`).then(r => r.data);
  },
  restoreQuizAttempt(attemptId) {
    return api.post(`/participant/quiz-attempts/${attemptId}/restore`).then(r => r.data);
  },
  permanentDeleteQuizAttempt(attemptId) {
    return api.delete(`/participant/quiz-attempts/${attemptId}/permanent`).then(r => r.data);
  },
  // Completed studies methods
  getCompletedStudies() {
    return api.get('/participant/studies/completed').then(r => r.data);
  },
  deleteCompletedStudy(studyId) {
    return api.delete(`/participant/studies/${studyId}/delete`).then(r => r.data);
  },
  // Completed studies trash bin methods
  getDeletedCompletedStudies() {
    return api.get('/participant/studies/completed/trash').then(r => r.data);
  },
  restoreCompletedStudy(studyId) {
    return api.post(`/participant/studies/completed/${studyId}/restore`).then(r => r.data);
  },
  permanentDeleteCompletedStudy(studyId) {
    return api.delete(`/participant/studies/completed/${studyId}/permanent`).then(r => r.data);
  }
};

export default ParticipantService;
