import api from './api';

const listStudies = (params) => api.get('/researcher/studies', { params }).then(r => r.data);
const getParticipantsStatus = (studyId) => api.get(`/researcher/studies/${studyId}/participants`).then(r => r.data);
const getAnalytics = (studyId) => api.get(`/researcher/studies/${studyId}/analytics`).then(r => r.data);
const getTaskAnalytics = (studyId) => api.get(`/researcher/studies/${studyId}/task-analytics`).then(r => r.data);
const getEvaluations = (studyId) => api.get(`/researcher/studies/${studyId}/evaluations`).then(r => r.data);
const listArtifacts = (params) => api.get('/researcher/artifacts', { params }).then(r => r.data);
const getNotifications = (params) => api.get('/researcher/notifications', { params }).then(r => r.data);
const markNotificationRead = (id) => api.patch(`/researcher/notifications/${id}/read`).then(r => r.data);
const markNotificationUnread = (id) => api.patch(`/researcher/notifications/${id}/unread`).then(r => r.data);
const deleteNotification = (id) => api.delete(`/researcher/notifications/${id}`).then(r => r.data);
const exportStudy = (payload) => api.post('/researcher/export', payload, { responseType: 'blob' });
const flagEvaluation = (evaluationId, flagged) => api.patch(`/researcher/evaluations/${evaluationId}/flag`, { flagged }).then(r => r.data);

export default {
  listStudies,
  getParticipantsStatus,
  getAnalytics,
  getTaskAnalytics,
  getEvaluations,
  listArtifacts,
  getNotifications,
  markNotificationRead,
  markNotificationUnread,
  deleteNotification,
  exportStudy,
  flagEvaluation
};
