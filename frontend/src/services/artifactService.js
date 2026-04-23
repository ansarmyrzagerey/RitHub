const API_BASE = '/api';

export const artifactService = {
  async getArtifacts(filters = {}) {
    const token = localStorage.getItem('token');
    const queryParams = new URLSearchParams();

    if (filters.tags) queryParams.append('tags', filters.tags.join(','));
    if (filters.studyId) queryParams.append('studyId', filters.studyId);
    if (filters.type) queryParams.append('type', filters.type);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.includeCollections !== undefined) queryParams.append('includeCollections', filters.includeCollections);

    const url = `${API_BASE}/artifacts${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await response.json();
  },

  async deleteArtifact(artifactId) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/artifacts/${artifactId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await response.json();
  },

  async getArtifactDetails(artifactId) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/artifacts/${artifactId}/details`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await response.json();
  }
};