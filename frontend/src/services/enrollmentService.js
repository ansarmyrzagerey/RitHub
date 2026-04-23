import api from './api';

export const enrollmentService = {
  // Generate enrollment link for a study
  async generateEnrollmentLink(studyId) {
    const response = await api.post(`/studies/${studyId}/enrollment-link`);
    return response.data;
  },

  // Get current enrollment link for a study
  async getEnrollmentLink(studyId) {
    const response = await api.get(`/studies/${studyId}/enrollment-link`);
    return response.data;
  },

  // Invalidate enrollment link for a study
  async invalidateEnrollmentLink(studyId) {
    const response = await api.delete(`/studies/${studyId}/enrollment-link`);
    return response.data;
  },

  // Validate enrollment token (public endpoint)
  async validateEnrollmentToken(token) {
    const response = await api.get(`/enrollment/${token}`);
    return response.data;
  },

  // Enroll participant in study using token
  async enrollParticipant(token, participantData = {}) {
    const response = await api.post(`/enrollment/${token}`, participantData);
    return response.data;
  },
};

export default enrollmentService;
