import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CompletedEvaluationsDialog from '../components/CompletedEvaluationsDialog';
import TagApproval from '../components/admin/TagApproval';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [studies, setStudies] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('studies'); // 'studies', 'flagged', 'researchers', 'participants', 'tags'
  const [flaggedEvaluations, setFlaggedEvaluations] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [researcherSearch, setResearcherSearch] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [pendingTagsCount, setPendingTagsCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
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
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [participantStudyEvaluation, setParticipantStudyEvaluation] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    user: null,
    userType: '',
    deleting: false
  });
  const [suspendDialog, setSuspendDialog] = useState({
    open: false,
    user: null,
    userType: '',
    suspending: false,
    suspendedUntil: '',
    durationDays: 7
  });

  const handleViewUserDetails = async (user, userType) => {
    try {
      const endpoint = userType === 'researcher'
        ? `/admin/researchers/${user.id}`
        : `/admin/participants/${user.id}`;

      const response = await api.get(endpoint);
      setSelectedUser(response.data.user);
      setUserDetailsOpen(true);
    } catch (error) {
      console.error('Error fetching user details:', error);
      alert('Failed to load user details');
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters, viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Always fetch flagged evaluations to get alerts count
      const flaggedRes = await api.get('/admin/flagged-evaluations');
      setFlaggedEvaluations(flaggedRes.data.evaluations);
      setAlertsCount(flaggedRes.data.evaluations.length);

      if (viewMode === 'studies') {
        const [studiesRes, statsRes] = await Promise.all([
          api.get('/admin/studies', { params: filters }),
          api.get('/admin/statistics')
        ]);
        setStudies(studiesRes.data.studies);
        setStatistics(statsRes.data.statistics);
      } else if (viewMode === 'flagged') {
        const statsRes = await api.get('/admin/statistics');
        setStatistics(statsRes.data.statistics);
      } else if (viewMode === 'researchers') {
        const [researchersRes, statsRes] = await Promise.all([
          api.get('/admin/researchers'),
          api.get('/admin/statistics')
        ]);
        setResearchers(researchersRes.data.researchers);
        setStatistics(statsRes.data.statistics);
      } else if (viewMode === 'participants') {
        const [participantsRes, statsRes] = await Promise.all([
          api.get('/admin/participants'),
          api.get('/admin/statistics')
        ]);
        setParticipants(participantsRes.data.participants);
        setStatistics(statsRes.data.statistics);
      } else if (viewMode === 'tags') {
        const statsRes = await api.get('/admin/statistics');
        setStatistics(statsRes.data.statistics);
        // Fetch pending tags count for statistics
        const token = localStorage.getItem('token');
        const tagsRes = await fetch('/api/tags/pending', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json());
        setPendingTagsCount(tagsRes.success ? tagsRes.tags.length : 0);
      }
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

  const openCancelDialog = (study) => {
    setCancelDialog({
      open: true,
      studyId: study.id,
      studyTitle: study.title,
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
      await api.post(`/studies/${cancelDialog.studyId}/admin-cancel`, {
        reason: cancelDialog.reason
      });

      // Refresh data
      await fetchData();
      closeCancelDialog();
      alert('Study cancelled successfully. Notifications have been sent to the researcher and participants.');
    } catch (err) {
      console.error('Error cancelling study:', err);
      alert(err.response?.data?.message || 'Failed to cancel study');
    } finally {
      setCancelling(false);
    }
  };
  const handleViewParticipantEvaluations = async (participantId, studyId, studyTitle) => {
    try {
      // Fetch evaluations for this participant in this study via admin endpoint
      const response = await api.get(`/admin/participants/${participantId}/studies/${studyId}/evaluations`);
      
      if (response.data && response.data.tasks && response.data.tasks.length > 0) {
        // Use the exact same format as the flagged evaluations endpoint
        setParticipantStudyEvaluation(response.data);
      } else {
        alert('No evaluations found for this participant in this study');
      }
    } catch (err) {
      console.error('Error fetching participant evaluations:', err);
      alert('Failed to load evaluations');
    }
  };

  const openDeleteDialog = (user, userType) => {
    setDeleteDialog({
      open: true,
      user,
      userType,
      deleting: false
    });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({
      open: false,
      user: null,
      userType: '',
      deleting: false
    });
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog.user) return;

    try {
      setDeleteDialog(prev => ({ ...prev, deleting: true }));

      await api.delete(`/admin/users/${deleteDialog.user.id}`);

      // Refresh data
      await fetchData();
      closeDeleteDialog();
      alert('User deleted successfully');
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeleteDialog(prev => ({ ...prev, deleting: false }));
    }
  };

  const openSuspendDialog = (user, userType) => {
    const isSuspended = user.suspended_until && new Date(user.suspended_until) > new Date();
    setSuspendDialog({
      open: true,
      user,
      userType,
      suspending: false,
      suspendedUntil: isSuspended ? user.suspended_until : '',
      durationDays: 7
    });
  };

  const closeSuspendDialog = () => {
    setSuspendDialog({
      open: false,
      user: null,
      userType: '',
      suspending: false,
      suspendedUntil: '',
      durationDays: 7
    });
  };

  const handleSuspendUser = async () => {
    if (!suspendDialog.user) return;

    const isSuspended = suspendDialog.user.suspended_until && new Date(suspendDialog.user.suspended_until) > new Date();

    try {
      setSuspendDialog(prev => ({ ...prev, suspending: true }));

      if (isSuspended) {
        // Unsuspend
        await api.post(`/admin/users/${suspendDialog.user.id}/unsuspend`);
        alert('User unsuspended successfully');
      } else {
        // Suspend
        if (!suspendDialog.suspendedUntil) {
          // Calculate date from duration
          const suspendDate = new Date();
          suspendDate.setDate(suspendDate.getDate() + suspendDialog.durationDays);
          suspendDialog.suspendedUntil = suspendDate.toISOString();
        }

        await api.post(`/admin/users/${suspendDialog.user.id}/suspend`, {
          suspended_until: suspendDialog.suspendedUntil
        });
        alert(`User suspended until ${new Date(suspendDialog.suspendedUntil).toLocaleString()}`);
      }

      // Refresh data
      await fetchData();
      closeSuspendDialog();
    } catch (err) {
      console.error('Error suspending/unsuspending user:', err);
      alert(err.response?.data?.message || 'Failed to suspend/unsuspend user');
    } finally {
      setSuspendDialog(prev => ({ ...prev, suspending: false }));
    }
  };

  const isUserSuspended = (user) => {
    return user.suspended_until && new Date(user.suspended_until) > new Date();
  };

  const handleUnflagEvaluation = async (studyId, participantId) => {
    try {
      // Find the evaluation ID for this study and participant
      const evaluation = flaggedEvaluations.find(
        ev => ev.study_id === studyId && ev.participant_id === participantId
      );
      
      if (!evaluation || !evaluation.tasks || evaluation.tasks.length === 0) {
        alert('Could not find evaluation to unflag');
        return;
      }

      // Get ALL evaluation IDs from all tasks (there could be multiple)
      const evaluationIds = evaluation.tasks
        .map(task => task.evaluationId)
        .filter(id => id !== null && id !== undefined);
      
      if (evaluationIds.length === 0) {
        console.error('No evaluation IDs found. Evaluation:', evaluation);
        alert('Could not find evaluation IDs');
        return;
      }

      console.log('Unflagging evaluation IDs:', evaluationIds);
      
      // Unflag all evaluations for this participant in this study
      await Promise.all(evaluationIds.map(id => 
        api.patch(`/admin/evaluations/${id}/unflag`)
      ));
      
      console.log('All evaluations unflagged successfully');
      
      // Refresh flagged evaluations immediately
      const flaggedRes = await api.get('/admin/flagged-evaluations');
      setFlaggedEvaluations(flaggedRes.data.evaluations);
      setAlertsCount(flaggedRes.data.evaluations.length);
      
      alert('Evaluation unflagged successfully');
    } catch (err) {
      console.error('Error unflagging evaluation:', err);
      alert(err.response?.data?.message || 'Failed to unflag evaluation');
    }
  };

  const filterBySearch = (users, searchTerm) => {
    if (!searchTerm.trim()) return users;
    
    const lowerSearch = searchTerm.toLowerCase();
    return users.filter(user => {
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
      const username = (user.username || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      
      return fullName.includes(lowerSearch) || username.includes(lowerSearch) || email.includes(lowerSearch);
    });
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && !studies.length) {
    return (
      <div className="admin-dashboard">
        <div className="loading">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Dashboard</h1>
        <p>Manage all studies and monitor platform activity</p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="statistics-grid">
          <div className={`stat-card ${viewMode === 'studies' ? 'stat-active' : ''}`} onClick={() => setViewMode('studies')}>
            <div className="stat-value">{statistics.total_studies}</div>
            <div className="stat-label">Total Studies</div>
          </div>
          <div className={`stat-card ${viewMode === 'studies' ? 'stat-active' : ''}`} onClick={() => setViewMode('studies')}>
            <div className="stat-value">{statistics.active_studies}</div>
            <div className="stat-label">Active Studies</div>
          </div>
          <div className={`stat-card ${viewMode === 'researchers' ? 'stat-active' : ''}`} onClick={() => setViewMode('researchers')}>
            <div className="stat-value">{statistics.total_researchers}</div>
            <div className="stat-label">Researchers</div>
          </div>
          <div className={`stat-card ${viewMode === 'participants' ? 'stat-active' : ''}`} onClick={() => setViewMode('participants')}>
            <div className="stat-value">{statistics.total_participants}</div>
            <div className="stat-label">Participants</div>
          </div>
          <div className={`stat-card ${viewMode === 'studies' ? 'stat-active' : ''}`} onClick={() => setViewMode('studies')}>
            <div className="stat-value">{statistics.total_enrollments}</div>
            <div className="stat-label">Enrollments</div>
          </div>
          <div className={`stat-card ${viewMode === 'studies' ? 'stat-active' : ''}`} onClick={() => setViewMode('studies')}>
            <div className="stat-value">{statistics.total_evaluations}</div>
            <div className="stat-label">Evaluations</div>
          </div>
          <div className={`stat-card ${viewMode === 'flagged' ? 'stat-active' : ''}`} onClick={() => setViewMode('flagged')}>
            <div className="stat-value">{alertsCount}</div>
            <div className="stat-label">Alerts</div>
          </div>
          <div className={`stat-card ${viewMode === 'tags' ? 'stat-active' : ''}`} onClick={() => setViewMode('tags')}>
            <div className="stat-value">{pendingTagsCount}</div>
            <div className="stat-label">Pending Tags</div>
          </div>
        </div>
      )}

      {/* Filters - Only show for studies view */}
      {viewMode === 'studies' && (
        <div className="filters-section">
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="all">All Studies</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search by title or researcher..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Sort by:</label>
            <select
              value={filters.sort}
              onChange={(e) => handleFilterChange('sort', e.target.value)}
            >
              <option value="created_at">Created Date</option>
              <option value="updated_at">Updated Date</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
              <option value="enrolled_count">Enrollment</option>
              <option value="deadline">Deadline</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Order:</label>
            <select
              value={filters.order}
              onChange={(e) => handleFilterChange('order', e.target.value)}
            >
              <option value="DESC">Descending</option>
              <option value="ASC">Ascending</option>
            </select>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* Flagged Evaluations Table */}
      {viewMode === 'flagged' && (
        <div className="studies-section">
          <h2>Flagged Evaluations ({flaggedEvaluations.length})</h2>
          {flaggedEvaluations.length === 0 ? (
            <div className="no-studies">No flagged evaluations</div>
          ) : (
            <div className="studies-table-container">
              <table className="studies-table">
                <thead>
                  <tr>
                    <th>Study</th>
                    <th>Researcher</th>
                    <th>Participant</th>
                    <th>Completed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedEvaluations.map((evaluation, index) => (
                    <tr key={`${evaluation.study_id}-${evaluation.participant_id}-${index}`}>
                      <td>
                        <div className="study-title-cell">
                          <strong>{evaluation.study_title}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="researcher-cell">
                          <div>{evaluation.researcher_first_name} {evaluation.researcher_last_name}</div>
                          <small>{evaluation.researcher_email}</small>
                        </div>
                      </td>
                      <td>
                        <div className="researcher-cell">
                          <div>{evaluation.participant_first_name} {evaluation.participant_last_name}</div>
                          <small>{evaluation.participant_email}</small>
                        </div>
                      </td>
                      <td>{formatDate(evaluation.completedAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                          <button
                            className="action-button view-button"
                            onClick={() => setSelectedEvaluation(evaluation)}
                          >
                            View Details
                          </button>
                          <button
                            className="action-button suspend-button"
                            onClick={() => setSuspendDialog({
                              open: true,
                              user: {
                                id: evaluation.participant_id,
                                first_name: evaluation.participant_first_name,
                                last_name: evaluation.participant_last_name,
                                email: evaluation.participant_email,
                                suspended_until: evaluation.participant_suspended_until
                              },
                              userType: 'participant',
                              suspending: false,
                              suspendedUntil: '',
                              durationDays: 7
                            })}
                          >
                            {evaluation.participant_suspended_until && new Date(evaluation.participant_suspended_until) > new Date() 
                              ? 'Unsuspend' 
                              : 'Suspend'}
                          </button>
                          <button
                            className="action-button unflag-button"
                            onClick={() => handleUnflagEvaluation(evaluation.study_id, evaluation.participant_id)}
                          >
                            Unflag
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Researchers Table */}
      {viewMode === 'researchers' && (
        <div className="studies-section">
          <h2>All Researchers ({researchers.length})</h2>
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={researcherSearch}
              onChange={(e) => setResearcherSearch(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '0.95rem',
                boxSizing: 'border-box'
              }}
            />
          </div>
          {filterBySearch(researchers, researcherSearch).length === 0 ? (
            <div className="no-studies">{researchers.length === 0 ? 'No researchers found' : 'No researchers match your search'}</div>
          ) : (
            <div className="studies-table-container">
              <table className="studies-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Organization</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Owned Studies</th>
                    <th>Artifacts</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filterBySearch(researchers, researcherSearch).map(researcher => (
                    <tr key={researcher.id}>
                      <td>{researcher.id}</td>
                      <td>
                        <div className="researcher-cell">
                          <div><strong>{researcher.first_name} {researcher.last_name}</strong></div>
                          <small>{researcher.username}</small>
                        </div>
                      </td>
                      <td>{researcher.email}</td>
                      <td>{researcher.organization || 'N/A'}</td>
                      <td>{researcher.phone_number || 'N/A'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className={`status-badge ${researcher.is_verified ? 'status-active' : 'status-draft'}`}>
                            {researcher.is_verified ? 'Verified' : 'Not Verified'}
                          </span>
                          {isUserSuspended(researcher) && (
                            <span className="status-badge status-cancelled" style={{ fontSize: '0.85em' }}>
                              Suspended until {new Date(researcher.suspended_until).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{researcher.owned_studies_count}</td>
                      <td>{researcher.artifacts_count}</td>
                      <td>{formatDate(researcher.created_at)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-view"
                            onClick={() => handleViewUserDetails(researcher, 'researcher')}
                          >
                            View
                          </button>
                          <button
                            className={isUserSuspended(researcher) ? "btn-secondary" : "btn-warning"}
                            onClick={() => openSuspendDialog(researcher, 'researcher')}
                          >
                            {isUserSuspended(researcher) ? 'Unsuspend/Restore' : 'Suspend'}
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => openDeleteDialog(researcher, 'researcher')}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Participants Table */}
      {viewMode === 'participants' && (
        <div className="studies-section">
          <h2>All Participants ({participants.length})</h2>
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '0.95rem',
                boxSizing: 'border-box'
              }}
            />
          </div>
          {filterBySearch(participants, participantSearch).length === 0 ? (
            <div className="no-studies">{participants.length === 0 ? 'No participants found' : 'No participants match your search'}</div>
          ) : (
            <div className="studies-table-container">
              <table className="studies-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Organization</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Assigned Studies</th>
                    <th>Completed</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filterBySearch(participants, participantSearch).map(participant => (
                    <tr key={participant.id}>
                      <td>{participant.id}</td>
                      <td>
                        <div className="researcher-cell">
                          <div><strong>{participant.first_name} {participant.last_name}</strong></div>
                          <small>{participant.username}</small>
                        </div>
                      </td>
                      <td>{participant.email}</td>
                      <td>{participant.organization || 'N/A'}</td>
                      <td>{participant.phone_number || 'N/A'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className={`status-badge ${participant.is_verified ? 'status-active' : 'status-draft'}`}>
                            {participant.is_verified ? 'Verified' : 'Not Verified'}
                          </span>
                          {isUserSuspended(participant) && (
                            <span className="status-badge status-cancelled" style={{ fontSize: '0.85em' }}>
                              Suspended until {new Date(participant.suspended_until).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{participant.assigned_studies_count}</td>
                      <td>{participant.completed_evaluations_count}</td>
                      <td>{formatDate(participant.created_at)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-view"
                            onClick={() => handleViewUserDetails(participant, 'participant')}
                          >
                            View
                          </button>
                          <button
                            className={isUserSuspended(participant) ? "btn-secondary" : "btn-warning"}
                            onClick={() => openSuspendDialog(participant, 'participant')}
                          >
                            {isUserSuspended(participant) ? 'Unsuspend/Restore' : 'Suspend'}
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => openDeleteDialog(participant, 'participant')}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tags Approval */}
      {viewMode === 'tags' && (
        <div className="studies-section">
          <TagApproval />
        </div>
      )}

      {/* Studies Table */}
      {viewMode === 'studies' && (
        <div className="studies-section">
          <h2>All Studies ({studies.length})</h2>
          {studies.length === 0 ? (
            <div className="no-studies">No studies found</div>
          ) : (
            <div className="studies-table-container">
              <table className="studies-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Researcher</th>
                    <th>Status</th>
                    <th>Enrollment</th>
                    <th>Tasks</th>
                    <th>Deadline</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studies.map(study => (
                    <tr key={study.id} className={study.status === 'cancelled' ? 'cancelled-row' : ''}>
                      <td>{study.id}</td>
                      <td>
                        <div className="study-title-cell">
                          <strong>{study.title}</strong>
                          {study.status === 'cancelled' && study.cancellation_reason && (
                            <div className="cancellation-info">
                              <small>Cancelled: {study.cancellation_reason}</small>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="researcher-cell">
                          <div>{study.researcher.first_name} {study.researcher.last_name}</div>
                          <small>{study.researcher.email}</small>
                          {study.researcher.organization && (
                            <small className="organization">{study.researcher.organization}</small>
                          )}
                        </div>
                      </td>
                      <td>{getStatusBadge(study.status)}</td>
                      <td>
                        {study.enrolled_count}
                        {study.participant_capacity && ` / ${study.participant_capacity}`}
                      </td>
                      <td>{study.task_count}</td>
                      <td>{formatDate(study.deadline)}</td>
                      <td>{formatDate(study.created_at)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-view"
                            onClick={() => navigate(`/admin/studies/${study.id}`)}
                          >
                            View
                          </button>
                          {(study.status === 'draft' || study.status === 'active') && (
                            <button
                              className="btn-cancel"
                              onClick={() => openCancelDialog(study)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {cancelDialog.open && (
        <div className="modal-overlay" onClick={closeCancelDialog}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Cancel Study</h2>
            <div className="modal-body">
              <p>You are about to cancel the study: <strong>{cancelDialog.studyTitle}</strong></p>
              <p className="warning-text">This action will:</p>
              <ul className="warning-list">
                <li>Send notifications to the researcher and all enrolled participants</li>
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

      {/* Completed Evaluation Dialog */}
      {selectedEvaluation && (
        <CompletedEvaluationsDialog
          open={true}
          onClose={() => setSelectedEvaluation(null)}
          studyId={selectedEvaluation.study_id}
          studyTitle={selectedEvaluation.study_title}
          evaluationData={selectedEvaluation.tasks.map(task => ({
            task_id: task.taskId,
            task_type: task.taskType,
            instructions: task.instructions,
            answer_type: task.answerType,
            answer_options: task.answerOptions,
            artifact1: task.artifact1,
            artifact2: task.artifact2,
            artifact3: task.artifact3,
            evaluation: {
              ratings: task.ratings,
              choice: task.choice,
              text: task.text,
              annotations: task.annotations,
              comments: task.comments,
              completed_at: selectedEvaluation.completedAt
            }
          }))}
        />
      )}

      {/* Participant Evaluation Dialog */}
      {participantStudyEvaluation && (
        <CompletedEvaluationsDialog
          open={true}
          onClose={() => setParticipantStudyEvaluation(null)}
          studyId={participantStudyEvaluation.study_id}
          studyTitle={participantStudyEvaluation.study_title}
          evaluationData={participantStudyEvaluation.tasks.map(task => ({
            task_id: task.taskId,
            task_type: task.taskType,
            instructions: task.instructions,
            answer_type: task.answerType,
            answer_options: task.answerOptions,
            artifact1: task.artifact1,
            artifact2: task.artifact2,
            artifact3: task.artifact3,
            evaluation: {
              ratings: task.ratings,
              choice: task.choice,
              text: task.text,
              annotations: task.annotations,
              comments: task.comments,
              completed_at: participantStudyEvaluation.completedAt
            }
          }))}
        />
      )}

      {/* User Details Modal */}
      {userDetailsOpen && selectedUser && (
        <div className="modal-overlay" onClick={() => setUserDetailsOpen(false)}>
          <div className="modal-content user-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedUser.first_name} {selectedUser.last_name}</h2>
              <button className="close-button" onClick={() => setUserDetailsOpen(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="user-info-grid">
                <div className="info-item">
                  <label>Username:</label>
                  <span>{selectedUser.username}</span>
                </div>
                <div className="info-item">
                  <label>Email:</label>
                  <span>{selectedUser.email}</span>
                </div>
                <div className="info-item">
                  <label>Phone:</label>
                  <span>{selectedUser.phone_number || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Organization:</label>
                  <span>{selectedUser.organization || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Status:</label>
                  <span className={`status-badge ${selectedUser.is_verified ? 'status-active' : 'status-draft'}`}>
                    {selectedUser.is_verified ? 'Verified' : 'Not Verified'}
                  </span>
                </div>
                <div className="info-item">
                  <label>Joined:</label>
                  <span>{formatDate(selectedUser.created_at)}</span>
                </div>
              </div>

              {/* Researcher-specific sections */}
              {selectedUser.role === 'researcher' && (
                <>
                  <div className="studies-list-section">
                    <h3>Owned Studies ({selectedUser.owned_studies?.length || 0})</h3>
                    {selectedUser.owned_studies && selectedUser.owned_studies.length > 0 ? (
                      <div className="studies-list">
                        {selectedUser.owned_studies.map(study => (
                          <div key={study.id} className="study-item">
                            <div className="study-item-header">
                              <strong>{study.title}</strong>
                              {getStatusBadge(study.status)}
                            </div>
                            <div className="study-item-details">
                              <small>Tasks: {study.task_count} | Enrolled: {study.enrolled_count}</small>
                            </div>
                            <button
                              className="btn-view"
                              onClick={() => {
                                setUserDetailsOpen(false);
                                navigate(`/admin/studies/${study.id}`);
                              }}
                            >
                              View Analytics
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-data">No studies created yet</p>
                    )}
                  </div>

                  <div className="artifacts-list-section">
                    <h3>Artifacts ({selectedUser.artifacts?.length || 0})</h3>
                    {selectedUser.artifacts && selectedUser.artifacts.length > 0 ? (
                      <div className="artifacts-list">
                        {selectedUser.artifacts.map(artifact => (
                          <div key={artifact.id} className="artifact-item">
                            <div className="artifact-info">
                              <strong>{artifact.name}</strong>
                              <span className="artifact-type">{artifact.type}</span>
                            </div>
                            <small>Created: {formatDate(artifact.created_at)}</small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-data">No artifacts uploaded yet</p>
                    )}
                  </div>
                </>
              )}

              {/* Participant-specific sections */}
              {selectedUser.role === 'participant' && (
                <>
                  <div className="studies-list-section">
                    <h3>Assigned Studies ({selectedUser.assigned_studies?.length || 0})</h3>
                    {selectedUser.assigned_studies && selectedUser.assigned_studies.length > 0 ? (
                      <div className="studies-list">
                        {selectedUser.assigned_studies.map(study => (
                          <div key={study.id} className="study-item">
                            <div className="study-item-header">
                              <strong>{study.title}</strong>
                              {getStatusBadge(study.status)}
                            </div>
                            <div className="study-item-details">
                              <small>
                                Completed: {study.completed_tasks}/{study.total_tasks} tasks
                              </small>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="btn-view"
                                onClick={() => {
                                  navigate(`/admin/studies/${study.id}`);
                                }}
                              >
                                View Study
                              </button>
                              <button
                                className="btn-view"
                                onClick={() => {
                                  handleViewParticipantEvaluations(selectedUser.id, study.id, study.title);
                                }}
                              >
                                View Evaluation
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-data">No studies assigned yet</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Suspend Dialog */}
      {suspendDialog.open && suspendDialog.user && (
        <div className="modal-overlay" onClick={closeSuspendDialog}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{isUserSuspended(suspendDialog.user) ? 'Unsuspend/Restore User' : 'Suspend User'}</h2>
            <div className="modal-body">
              {isUserSuspended(suspendDialog.user) ? (
                <>
                  <p>Are you sure you want to unsuspend this user?</p>
                  <div className="user-delete-info">
                    <div className="info-item">
                      <label>Name:</label>
                      <span>{suspendDialog.user.first_name} {suspendDialog.user.last_name}</span>
                    </div>
                    <div className="info-item">
                      <label>Email:</label>
                      <span>{suspendDialog.user.email}</span>
                    </div>
                    <div className="info-item">
                      <label>Currently Suspended Until:</label>
                      <span>{new Date(suspendDialog.user.suspended_until).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="warning-message">
                    <strong>Note:</strong> The user will be able to sign in immediately after unsuspension.
                  </div>
                </>
              ) : (
                <>
                  <p>Suspend this user account? They will not be able to sign in until the suspension expires.</p>
                  <div className="user-delete-info">
                    <div className="info-item">
                      <label>Name:</label>
                      <span>{suspendDialog.user.first_name} {suspendDialog.user.last_name}</span>
                    </div>
                    <div className="info-item">
                      <label>Email:</label>
                      <span>{suspendDialog.user.email}</span>
                    </div>
                    <div className="info-item">
                      <label>Role:</label>
                      <span className="capitalize">{suspendDialog.user.role}</span>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label htmlFor="suspend-duration">
                      Suspension Duration (days)
                    </label>
                    <input
                      type="number"
                      id="suspend-duration"
                      min="1"
                      max="365"
                      value={suspendDialog.durationDays}
                      onChange={(e) => {
                        const days = parseInt(e.target.value) || 7;
                        const suspendDate = new Date();
                        suspendDate.setDate(suspendDate.getDate() + days);
                        setSuspendDialog(prev => ({
                          ...prev,
                          durationDays: days,
                          suspendedUntil: suspendDate.toISOString()
                        }));
                      }}
                      style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label htmlFor="suspend-until">
                      Or specify exact date and time
                    </label>
                    <input
                      type="datetime-local"
                      id="suspend-until"
                      value={suspendDialog.suspendedUntil ? new Date(suspendDialog.suspendedUntil).toISOString().slice(0, 16) : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const date = new Date(e.target.value);
                          setSuspendDialog(prev => ({
                            ...prev,
                            suspendedUntil: date.toISOString()
                          }));
                        }
                      }}
                      style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                    />
                  </div>
                  {suspendDialog.suspendedUntil && (
                    <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                      <small>User will be suspended until: <strong>{new Date(suspendDialog.suspendedUntil).toLocaleString()}</strong></small>
                    </div>
                  )}
                  <div className="warning-message" style={{ marginTop: '16px' }}>
                    <strong>Warning:</strong> The user will not be able to sign in until the suspension expires.
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={closeSuspendDialog}
                disabled={suspendDialog.suspending}
              >
                Cancel
              </button>
              <button
                className={isUserSuspended(suspendDialog.user) ? "btn-secondary" : "btn-warning"}
                onClick={handleSuspendUser}
                disabled={suspendDialog.suspending || (!isUserSuspended(suspendDialog.user) && !suspendDialog.suspendedUntil)}
              >
                {suspendDialog.suspending 
                  ? (isUserSuspended(suspendDialog.user) ? 'Unsuspending/Restoring...' : 'Suspending...') 
                  : (isUserSuspended(suspendDialog.user) ? 'Unsuspend/Restore User' : 'Suspend User')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Delete Confirmation Dialog */}
      {deleteDialog.open && deleteDialog.user && (
        <div className="modal-overlay" onClick={closeDeleteDialog}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Delete User</h2>
            <div className="modal-body">
              <p>Are you sure you want to delete this user?</p>
              <div className="user-delete-info">
                <div className="info-item">
                  <label>Name:</label>
                  <span>{deleteDialog.user.first_name} {deleteDialog.user.last_name}</span>
                </div>
                <div className="info-item">
                  <label>Email:</label>
                  <span>{deleteDialog.user.email}</span>
                </div>
                <div className="info-item">
                  <label>Role:</label>
                  <span className="capitalize">{deleteDialog.user.role}</span>
                </div>
                <div className="info-item">
                  <label>User ID:</label>
                  <span>{deleteDialog.user.id}</span>
                </div>
              </div>
              <div className="warning-message">
                <strong>Warning:</strong> This action cannot be undone. The user and all their associated data will be permanently deleted.
                {deleteDialog.userType === 'researcher' && deleteDialog.user.owned_studies_count > 0 && (
                  <div className="warning-detail">
                    • {deleteDialog.user.owned_studies_count} studies will be cancelled and ownership transferred to you
                  </div>
                )}
                {deleteDialog.userType === 'researcher' && deleteDialog.user.artifacts_count > 0 && (
                  <div className="warning-detail">
                    • {deleteDialog.user.artifacts_count} artifacts will have their uploader reference removed
                  </div>
                )}
                {deleteDialog.userType === 'participant' && deleteDialog.user.assigned_studies_count > 0 && (
                  <div className="warning-detail">
                    • User will be removed from {deleteDialog.user.assigned_studies_count} assigned studies
                  </div>
                )}
                {deleteDialog.userType === 'participant' && deleteDialog.user.completed_evaluations_count > 0 && (
                  <div className="warning-detail">
                    • {deleteDialog.user.completed_evaluations_count} evaluation responses will be deleted
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={closeDeleteDialog}
                disabled={deleteDialog.deleting}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleDeleteUser}
                disabled={deleteDialog.deleting}
              >
                {deleteDialog.deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;