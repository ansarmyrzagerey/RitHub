import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [studies, setStudies] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    sort: 'created_at',
    order: 'DESC'
  });
  const [cancelDialog, setCancelDialog] = useState({
    open: false,
    studyId: null,
    studyTitle: '',
    reason: ''
  });
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [studiesRes, statsRes] = await Promise.all([
        api.get('/admin/studies', { params: filters }),
        api.get('/admin/statistics')
      ]);

      setStudies(studiesRes.data.studies);
      setStatistics(statsRes.data.statistics);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const openCancelDialog = (studyId, studyTitle) => {
    setCancelDialog({
      open: true,
      studyId,
      studyTitle,
      reason: ''
    });
  };

  const closeCancelDialog = () => {
    setCancelDialog({
      open: false,
      studyId: null,
      studyTitle: '',
      reason: ''
    });
  };

  const handleCancelStudy = async () => {
    if (!cancelDialog.reason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }

    try {
      setCancelling(true);
      await api.post(`/admin/studies/${cancelDialog.studyId}/cancel`, {
        reason: cancelDialog.reason
      });
      
      closeCancelDialog();
      fetchData(); // Refresh data
      alert('Study cancelled successfully');
    } catch (err) {
      console.error('Error cancelling study:', err);
      alert(err.response?.data?.message || 'Failed to cancel study');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'completed': return '#2196f3';
      case 'cancelled': return '#f44336';
      case 'draft': return '#ff9800';
      default: return '#757575';
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Manage studies and monitor system activity</p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>{statistics.totalStudies || 0}</h3>
            <p>Total Studies</p>
          </div>
          <div className="stat-card">
            <h3>{statistics.activeStudies || 0}</h3>
            <p>Active Studies</p>
          </div>
          <div className="stat-card">
            <h3>{statistics.totalParticipants || 0}</h3>
            <p>Total Participants</p>
          </div>
          <div className="stat-card">
            <h3>{statistics.totalEvaluations || 0}</h3>
            <p>Total Evaluations</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={filters.status} 
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Search:</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="Search studies..."
          />
        </div>
        
        <div className="filter-group">
          <label>Sort by:</label>
          <select 
            value={filters.sort} 
            onChange={(e) => handleFilterChange('sort', e.target.value)}
          >
            <option value="created_at">Created Date</option>
            <option value="title">Title</option>
            <option value="status">Status</option>
            <option value="participant_count">Participants</option>
          </select>
        </div>
      </div>

      {/* Studies Table */}
      <div className="studies-table">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Researcher</th>
              <th>Status</th>
              <th>Participants</th>
              <th>Created</th>
              <th>Deadline</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {studies.map(study => (
              <tr key={study.id}>
                <td>
                  <strong>{study.title}</strong>
                  <br />
                  <small>{study.description?.substring(0, 100)}...</small>
                </td>
                <td>{study.researcher_name}</td>
                <td>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(study.status) }}
                  >
                    {study.status}
                  </span>
                </td>
                <td>{study.participant_count || 0}</td>
                <td>{formatDate(study.created_at)}</td>
                <td>{study.deadline ? formatDate(study.deadline) : 'No deadline'}</td>
                <td>
                  <button 
                    onClick={() => navigate(`/admin/studies/${study.id}`)}
                    className="btn-view"
                  >
                    View
                  </button>
                  {study.status === 'active' && (
                    <button 
                      onClick={() => openCancelDialog(study.id, study.title)}
                      className="btn-cancel"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {studies.length === 0 && (
        <div className="no-data">
          No studies found matching your criteria.
        </div>
      )}

      {/* Cancel Dialog */}
      {cancelDialog.open && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Cancel Study</h3>
            <p>Are you sure you want to cancel "{cancelDialog.studyTitle}"?</p>
            <div className="form-group">
              <label>Cancellation Reason:</label>
              <textarea
                value={cancelDialog.reason}
                onChange={(e) => setCancelDialog(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Please provide a reason for cancelling this study..."
                rows={4}
                required
              />
            </div>
            <div className="modal-actions">
              <button onClick={closeCancelDialog} disabled={cancelling}>
                Cancel
              </button>
              <button 
                onClick={handleCancelStudy} 
                disabled={cancelling || !cancelDialog.reason.trim()}
                className="btn-danger"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;