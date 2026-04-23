import api from './api';

export const criteriaService = {
  // Get predefined criteria templates
  async getCriteriaTemplates() {
    const response = await api.get('/criteria/templates');
    return response.data;
  },

  // Add criteria to a study
  async addCriteriaToStudy(studyId, criteriaData) {
    const response = await api.post(`/studies/${studyId}/criteria`, criteriaData);
    return response.data;
  },

  // Get all criteria for a study
  async getStudyCriteria(studyId) {
    const response = await api.get(`/studies/${studyId}/criteria`);
    return response.data;
  },

  // Update a specific criterion
  async updateCriterion(studyId, criteriaId, criteriaData) {
    const response = await api.put(`/studies/${studyId}/criteria/${criteriaId}`, criteriaData);
    return response.data;
  },

  // Delete a criterion from a study
  async deleteCriterion(studyId, criteriaId) {
    const response = await api.delete(`/studies/${studyId}/criteria/${criteriaId}`);
    return response.data;
  },
};

export default criteriaService;
