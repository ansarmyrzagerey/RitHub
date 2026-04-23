import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Alert,
  Chip,
  Paper,
} from '@mui/material';
import {
  AccessTime,
  People,
  Warning,
} from '@mui/icons-material';

const StudyConfigurationForm = ({ data, onChange, onNext, onBack }) => {
  const [formData, setFormData] = useState({
    deadline: data.deadline || '',
    participant_capacity: data.participant_capacity || 50,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    onChange(formData);
  }, [formData]);

  const validateDeadline = (value) => {
    // Deadline is optional for drafts; only validate when provided
    if (!value) return null;

    const deadlineDate = new Date(value);
    const now = new Date();

    if (deadlineDate <= now) {
      return 'Deadline must be in the future';
    }

    return null;
  };

  const validateCapacity = (value) => {
    if (!value) {
      return 'Participant capacity is required';
    }

    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      return 'Capacity must be a positive number';
    }

    if (num > 1000) {
      return 'Capacity cannot exceed 1000 participants';
    }

    return null;
  };

  const handleDeadlineChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, deadline: value }));

    const error = validateDeadline(value);
    setErrors((prev) => ({ ...prev, deadline: error }));
  };

  const handleCapacityChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, participant_capacity: value }));

    const error = validateCapacity(value);
    setErrors((prev) => ({ ...prev, participant_capacity: error }));
  };

  const getDeadlineWarning = () => {
    if (!formData.deadline) return null;

    const deadlineDate = new Date(formData.deadline);
    const now = new Date();
    const diffTime = deadlineDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1) {
      return { severity: 'error', message: 'Deadline is less than 24 hours away' };
    } else if (diffDays < 3) {
      return { severity: 'warning', message: `Deadline is ${diffDays} days away - consider extending for more participation` };
    } else if (diffDays < 7) {
      return { severity: 'info', message: `Deadline is ${diffDays} days away` };
    }

    return { severity: 'success', message: `Deadline is ${diffDays} days away` };
  };

  const getCapacityIndicator = () => {
    const capacity = parseInt(formData.participant_capacity, 10);
    if (isNaN(capacity)) return null;

    if (capacity < 10) {
      return { severity: 'warning', message: 'Small sample size may limit statistical significance' };
    } else if (capacity < 30) {
      return { severity: 'info', message: 'Moderate sample size' };
    } else {
      return { severity: 'success', message: 'Good sample size for statistical analysis' };
    }
  };

  const deadlineWarning = getDeadlineWarning();
  const capacityIndicator = getCapacityIndicator();

  // Format deadline for display
  const formatDeadlineDisplay = () => {
    if (!formData.deadline) return null;

    const deadlineDate = new Date(formData.deadline);
    return deadlineDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
        Study Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Set the deadline and participant capacity for your study
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Deadline Configuration */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AccessTime color="primary" />
            <Typography variant="h6">Study Deadline</Typography>
          </Box>

          <TextField
            fullWidth
            type="datetime-local"
            label="Deadline"
            value={formData.deadline}
            onChange={handleDeadlineChange}
            error={!!errors.deadline}
            helperText={errors.deadline || 'Select when the study should close for new submissions'}
            InputLabelProps={{
              shrink: true,
            }}
          />

          {formData.deadline && !errors.deadline && (
            <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Deadline Preview
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDeadlineDisplay()}
              </Typography>
            </Paper>
          )}

          {deadlineWarning && (
            <Alert severity={deadlineWarning.severity} sx={{ mt: 2 }} icon={<Warning />}>
              {deadlineWarning.message}
            </Alert>
          )}
        </Box>

        {/* Participant Capacity Configuration */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <People color="primary" />
            <Typography variant="h6">Participant Capacity</Typography>
          </Box>

          <TextField
            fullWidth
            type="number"
            label="Maximum Participants"
            value={formData.participant_capacity}
            onChange={handleCapacityChange}
            error={!!errors.participant_capacity}
            helperText={errors.participant_capacity || 'Maximum number of participants allowed to enroll'}
            required
            inputProps={{
              min: 1,
              max: 1000,
            }}
          />

          {capacityIndicator && (
            <Alert severity={capacityIndicator.severity} sx={{ mt: 2 }}>
              {capacityIndicator.message}
            </Alert>
          )}

          {formData.participant_capacity && !errors.participant_capacity && (
            <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Capacity Overview
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`${formData.participant_capacity} participants max`}
                  color="primary"
                />
                <Chip
                  label={`~${Math.ceil(formData.participant_capacity / data.artifacts?.length || 1)} per artifact`}
                  variant="outlined"
                />
              </Box>
            </Paper>
          )}
        </Box>

        {/* Summary */}
        <Paper sx={{ p: 3, bgcolor: 'primary.50', border: 1, borderColor: 'primary.main' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Configuration Summary
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime fontSize="small" />
              <Typography variant="body2">
                <strong>Deadline:</strong>{' '}
                {formData.deadline ? formatDeadlineDisplay() : 'Not set'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <People fontSize="small" />
              <Typography variant="body2">
                <strong>Capacity:</strong>{' '}
                {formData.participant_capacity || 'Not set'} participants
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default StudyConfigurationForm;
