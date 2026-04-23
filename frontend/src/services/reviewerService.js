import api from './api';

const ReviewerService = {
  getNotifications(params = { limit: 10, offset: 0 }) {
    const q = new URLSearchParams(params).toString();
    return api.get(`/reviewer/notifications?${q}`).then(r => r.data);
  },
  markRead(id) {
    return api.patch(`/reviewer/notifications/${id}/read`).then(r => r.data);
  },
  assignToStudy(studyId) {
    return api.post('/reviewer/assignments', { studyId }).then(r => r.data);
  },
  assignByEvaluation(evaluationId) {
    return api.post('/reviewer/assignments/by-evaluation', { evaluationId }).then(r => r.data);
  },
  getStudies(search) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return api.get(`/reviewer/studies${q}`).then(r => r.data);
  },
  getStudyAnalytics(studyId) {
    return api.get(`/reviewer/studies/${studyId}/analytics`).then(r => r.data);
  },
  unflagEvaluation(evalId) {
    return api.patch(`/reviewer/evaluations/${evalId}/unflag`).then(r => r.data);
  },
  flagEvaluation(evalId) {
    return api.post(`/reviewer/evaluations/${evalId}/flag`).then(r => r.data);
  }
};

export default ReviewerService;
