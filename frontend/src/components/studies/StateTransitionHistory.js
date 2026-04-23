import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Avatar
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Archive as ArchiveIcon,
  PlayArrow as PlayArrowIcon,
  Create as CreateIcon,
  Done as DoneIcon
} from '@mui/icons-material';
import { studyService } from '../../services/studyService';

const StateTransitionHistory = ({ studyId }) => {
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTransitions();
  }, [studyId]);

  const fetchTransitions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await studyService.getStateTransitions(studyId);
      setTransitions(response.transitions || []);
    } catch (err) {
      console.error('Error fetching state transitions:', err);
      setError('Failed to load state transition history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      active: 'success',
      completed: 'info',
      cancelled: 'error',
      archived: 'default'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      draft: <CreateIcon fontSize="small" />,
      active: <PlayArrowIcon fontSize="small" />,
      completed: <DoneIcon fontSize="small" />,
      cancelled: <CancelIcon fontSize="small" />,
      archived: <ArchiveIcon fontSize="small" />
    };
    return icons[status] || <CheckCircleIcon fontSize="small" />;
  };

  const getStatusBgColor = (status) => {
    const colors = {
      draft: '#f5f5f5',
      active: '#e8f5e9',
      completed: '#e3f2fd',
      cancelled: '#ffebee',
      archived: '#fafafa'
    };
    return colors[status] || '#f5f5f5';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransitionLabel = (fromStatus, toStatus) => {
    if (!fromStatus) {
      return `Study created as ${toStatus}`;
    }
    return `Transitioned from ${fromStatus} to ${toStatus}`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (transitions.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No state transition history available
      </Alert>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid #e0e0e0' }}>
      <Typography variant="h6" gutterBottom>
        State Transition History
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Track all status changes and actions taken on this study
      </Typography>

      <Stack spacing={2}>
        {transitions.map((transition, index) => (
          <Box key={transition.id}>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'flex-start',
                p: 2,
                borderRadius: 1,
                bgcolor: getStatusBgColor(transition.to_status),
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Avatar
                sx={{
                  bgcolor: getStatusColor(transition.to_status) === 'error' ? 'error.main' :
                           getStatusColor(transition.to_status) === 'success' ? 'success.main' :
                           getStatusColor(transition.to_status) === 'info' ? 'info.main' : 'grey.400',
                  width: 40,
                  height: 40
                }}
              >
                {getStatusIcon(transition.to_status)}
              </Avatar>

              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {getTransitionLabel(transition.from_status, transition.to_status)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(transition.created_at)}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Chip
                    label={transition.to_status.toUpperCase()}
                    size="small"
                    color={getStatusColor(transition.to_status)}
                    sx={{ fontWeight: 600 }}
                  />
                </Box>

                {transition.changed_by && (
                  <Typography variant="body2" color="text.secondary">
                    Changed by: {transition.changed_by.first_name} {transition.changed_by.last_name}
                  </Typography>
                )}

                {!transition.changed_by && (
                  <Typography variant="body2" color="text.secondary">
                    System action
                  </Typography>
                )}

                {transition.reason && (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1,
                      p: 1.5,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      fontStyle: 'italic',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <strong>Reason:</strong> {transition.reason}
                  </Typography>
                )}
              </Box>
            </Box>
            {index < transitions.length - 1 && <Divider sx={{ my: 1 }} />}
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};

export default StateTransitionHistory;
