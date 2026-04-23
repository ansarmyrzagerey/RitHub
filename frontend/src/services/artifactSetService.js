import api from './api';

export const artifactSetService = {
  // Create a new artifact set
  async createArtifactSet(artifactSetData) {
    const response = await api.post('/artifact-sets', artifactSetData);
    return response.data;
  },

  // Get all artifact sets for current user
  async getArtifactSets() {
    const response = await api.get('/artifact-sets');
    return response.data;
  },

  // Delete an artifact set
  async deleteArtifactSet(id) {
    const response = await api.delete(`/artifact-sets/${id}`);
    return response.data;
  },
};

export default artifactSetService;
