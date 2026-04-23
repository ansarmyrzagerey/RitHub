import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './AdminStudyDetails.css';

const AdminStudyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelDialog, setCancelDialog] = useState({
    open: false,
    reason: ''
  });
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchStudyDetails();
  }, [id]);

  const fetchStudyDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/admin/studies/${id}`);
      setStudy(response.data.study);
    } catch (err) {
      console.error('Error fetching study details:', err);
      setError(err.response?.data?.message || 'Failed to load study details');
    } finally {
      setLoading(false);
    }
  };

  const openCancelDialog = () => {
    setCancelDialog({ open: true, reason: '' });
  };

  const closeCancelDialog = () => {
    setCancelDialog({ open: false, reason: '' });
  };

  const handleCancelStudy = async () => {
    if (!cancelDialog.reason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }

    try {
      setCancelling(true);
      await api.post(`/studies/${id}/admin-cancel`, {
        reason: cancelDialog.reason
      });

      alert('Study cancelled successfully. Notifications have been sent.');
      closeCancelDialog();
      await fetchStudyDetails();
    } catch (err) {
      console.error('Error cancelling study:', err);
      alert(err.response?.data?.message || 'Failed to cancel study');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      draft: 'status-badge status-draft',
      active: 'status-badge status-active',
      completed: 'status-badge status-completed',
      cancelled: 'status-badge status-cancelled',
      archived: 'status-badge status-archived'
    };

    return <span className={statusClasses[status] || 'status-badge'}>{status}</span>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="admin-study-details">
        <div className="loading">Loading study details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-study-details">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/admin/dashboard')} className="btn-back">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="admin-study-details">
        <div className="error-message">Study not found</div>
        <button onClick={() => navigate('/admin/dashboard')} className="btn-back">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="admin-study-details">
      <div className="page-header">
        <button onClick={() => navigate('/admin/dashboard')} className="btn-back">
          ← Back to Dashboard
        </button>
        <h1>Study Details</h1>
      </div>

      {/* Study Information */}
      <div className="details-section">
        <div className="section-header">
          <h2>Study Information</h2>
          {(study.status === 'draft' || study.status === 'active') && (
            <button className="btn-cancel" onClick={openCancelDialog}>
              Cancel Study
            </button>
          )}
        </div>

        <div className="info-grid">
          <div className="info-item">
            <label>Study ID:</label>
            <span>{study.id}</span>
          </div>
          <div className="info-item">
            <label>Status:</label>
            {getStatusBadge(study.status)}
          </div>
          <div className="info-item full-width">
            <label>Title:</label>
            <span className="title">{study.title}</span>
          </div>
          <div className="info-item full-width">
            <label>Description:</label>
            <p className="description">{study.description}</p>
          </div>
          <div className="info-item">
            <label>Deadline:</label>
            <span>{formatDate(study.deadline)}</span>
          </div>
          <div className="info-item">
            <label>Participant Capacity:</label>
            <span>
              {study.enrolled_count} / {study.participant_capacity || 'Unlimited'}
            </span>
          </div>
          <div className="info-item">
            <label>Tasks:</label>
            <span>{study.task_count}</span>
          </div>
          <div className="info-item">
            <label>Created:</label>
            <span>{formatDate(study.created_at)}</span>
          </div>
          <div className="info-item">
            <label>Last Updated:</label>
            <span>{formatDate(study.updated_at)}</span>
          </div>
        </div>

        {/* Cancellation Information */}
        {study.status === 'cancelled' && (
          <div className="cancellation-section">
            <h3>Cancellation Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>Cancelled At:</label>
                <span>{formatDate(study.cancelled_at)}</span>
              </div>
              <div className="info-item full-width">
                <label>Reason:</label>
                <p className="cancellation-reason">{study.cancellation_reason}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Researcher Information */}
      <div className="details-section">
        <h2>Researcher Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Name:</label>
            <span>{study.researcher.first_name} {study.researcher.last_name}</span>
          </div>
          <div className="info-item">
            <label>Email:</label>
            <span>{study.researcher.email}</span>
          </div>
          {study.researcher.organization && (
            <div className="info-item">
              <label>Organization:</label>
              <span>{study.researcher.organization}</span>
            </div>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="details-section">
        <h2>Enrolled Participants ({study.participants.length})</h2>
        {study.participants.length === 0 ? (
          <p className="no-data">No participants enrolled yet</p>
        ) : (
          <div className="participants-table-container">
            <table className="participants-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Enrolled At</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {study.participants.map(participant => (
                  <tr key={participant.id}>
                    <td>{participant.first_name} {participant.last_name}</td>
                    <td>{participant.email}</td>
                    <td>{formatDate(participant.enrolled_at)}</td>
                    <td>
                      <div className="progress-cell">
                        <span>{participant.completed_tasks} / {participant.total_tasks} tasks</span>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${participant.total_tasks > 0 
                                ? (participant.completed_tasks / participant.total_tasks) * 100 
                                : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      {cancelDialog.open && (
        <div className="modal-overlay" onClick={closeCancelDialog}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Cancel Study</h2>
            <div className="modal-body">
              <p>
                You are about to cancel the study: <strong>{study.title}</strong>
              </p>
              <p className="warning-text">
                This action will:
              </p>
              <ul className="warning-list">
                <li>Send notifications to the researcher and all {study.enrolled_count} enrolled participants</li>
                <li>Mark all evaluation data as "from cancelled study"</li>
                <li>Move the study to archived section</li>
                <li>Preserve all data for future reference</li>
              </ul>
              
              <div className="form-group">
                <label htmlFor="cancellation-reason">
                  Cancellation Reason <span className="required">*</span>
                </label>
                <textarea
                  id="cancellation-reason"
                  rows="4"
                  placeholder="Please provide a detailed reason for cancelling this study (e.g., ethical concerns, policy violations, etc.)"
                  value={cancelDialog.reason}
                  onChange={(e) => setCancelDialog(prev => ({ ...prev, reason: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={closeCancelDialog}
                disabled={cancelling}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleCancelStudy}
                disabled={cancelling || !cancelDialog.reason.trim()}
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

export default AdminStudyDetails;
