import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Divider,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  Description,
  Code,
  Assessment,
  AccessTime,
  People,
  Save,
  Rocket,
  Quiz,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { studyService } from '../../services/studyService';

const ReviewAndLaunchPanel = ({ data, onBack, onSaveDraft, onComplete, editMode = false }) => {
  const [isActivating, setIsActivating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Debug: Log the data received
  console.log('=== REVIEWANDLAUNCHPANEL RECEIVED DATA ===');
  console.log('Questions in data:', data.questions?.map(q => ({
    title: q.title,
    question_type: q.question_type,
    artifacts: q.artifacts?.length || 0,
    criteria: q.criteria?.length || 0
  })));
  const [validationResults, setValidationResults] = useState(null);

  // Validate all study data
  const validateStudy = () => {
    const errors = [];
    const warnings = [];
    const info = [];

    // Basic Information validation
    if (!data.title || data.title.trim() === '') {
      errors.push('Study title is required');
    }
    if (!data.description || data.description.trim() === '') {
      errors.push('Study description is required');
    }

    // Questions validation
    if (!data.questions || data.questions.length === 0) {
      errors.push('At least one question must be created');
    } else {
      // Validate each question
      let totalArtifacts = 0;
      let totalCriteria = 0;
      let questionsWithoutArtifacts = 0;
      let questionsWithoutCriteria = 0;

      data.questions.forEach((question, index) => {
        if (!question.title || question.title.trim() === '') {
          errors.push(`Question ${index + 1} is missing a title`);
        }

        const artifactCount = question.artifacts?.length || 0;
        const criteriaCount = question.criteria?.length || 0;

        totalArtifacts += artifactCount;
        totalCriteria += criteriaCount;

        // Check artifacts based on question type
        if (question.question_type === 'comparison') {
          if (artifactCount < 2) {
            questionsWithoutArtifacts++;
            errors.push(`Question "${question.title || index + 1}" (comparison) needs at least 2 artifacts`);
          } else if (artifactCount > 3) {
            errors.push(`Question "${question.title || index + 1}" (comparison) can have maximum 3 artifacts`);
          }
        } else if (question.question_type === 'rating') {
          if (artifactCount !== 1) {
            questionsWithoutArtifacts++;
            errors.push(`Question "${question.title || index + 1}" (rating) needs exactly 1 artifact`);
          }
        }

        // Check criteria
        if (criteriaCount === 0) {
          questionsWithoutCriteria++;
          warnings.push(`Question "${question.title || index + 1}" has no evaluation criteria`);
        }
      });

      // Info messages
      if (data.questions.length > 0) {
        info.push(`${data.questions.length} question${data.questions.length !== 1 ? 's' : ''} created`);
      }
      if (totalArtifacts > 0) {
        info.push(`${totalArtifacts} total artifact${totalArtifacts !== 1 ? 's' : ''} across all questions`);
      }
      if (totalCriteria > 0) {
        info.push(`${totalCriteria} total evaluation criteri${totalCriteria !== 1 ? 'a' : 'on'} defined`);
      }
    }

    // Deadline validation
    if (!data.deadline) {
      errors.push('Study deadline is required');
    } else {
      const deadlineDate = new Date(data.deadline);
      const now = new Date();
      if (deadlineDate <= now) {
        errors.push('Deadline must be in the future');
      } else {
        const diffDays = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays < 1) {
          warnings.push('Deadline is less than 24 hours away');
        }
      }
    }

    // Capacity validation
    if (!data.participant_capacity || data.participant_capacity <= 0) {
      errors.push('Participant capacity must be greater than 0');
    } else if (data.participant_capacity < 10) {
      warnings.push('Small sample size may limit statistical significance');
    }

    return { errors, warnings, info, isValid: errors.length === 0 };
  };

  const handleActivate = async () => {
    const validation = validateStudy();
    setValidationResults(validation);

    if (!validation.isValid) {
      toast.error('Please fix validation errors before activating');
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmActivate = async () => {
    let toastId;
    try {
      setIsActivating(true);
      setShowConfirmDialog(false);

      let studyId = data.id;

      // Always save draft first to ensure quizzes are assigned
      // This handles both new studies and existing drafts
      toastId = toast.loading('Saving study...');
      
      // Call onSaveDraft with skipNavigation=true to get the study ID back
      const savedStudyId = await onSaveDraft(true);
      
      if (!savedStudyId) {
        toast.error('Failed to save study. Please try again.', { id: toastId });
        setIsActivating(false);
        return;
      }
      
      studyId = savedStudyId;

      // Activate the study
      if (toastId) {
        toast.loading('Activating study...', { id: toastId });
      } else {
        toastId = toast.loading('Activating study...');
      }
      await studyService.activateStudy(studyId);

      toast.success('Study activated successfully!', { id: toastId });
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to activate study:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to activate study';
      if (toastId) {
        toast.error(errorMessage, { id: toastId });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsActivating(false);
    }
  };

  const validation = validationResults || validateStudy();

  const formatDeadline = () => {
    if (!data.deadline) return 'Not set';
    const date = new Date(data.deadline);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
        Review & {editMode ? 'Update' : 'Launch'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        {editMode ? 'Review your changes and save or activate the study' : 'Review your study configuration and launch when ready'}
      </Typography>

      {/* Validation Status */}
      <Box sx={{ mb: 4 }}>
        {validation.errors.length > 0 && (
          <Alert severity="error" icon={<Error />} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Validation Errors
            </Typography>
            <List dense>
              {validation.errors.map((error, index) => (
                <ListItem key={index} sx={{ py: 0 }}>
                  <ListItemText primary={error} />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}

        {validation.warnings.length > 0 && (
          <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Warnings
            </Typography>
            <List dense>
              {validation.warnings.map((warning, index) => (
                <ListItem key={index} sx={{ py: 0 }}>
                  <ListItemText primary={warning} />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}

        {validation.isValid && (
          <Alert severity="success" icon={<CheckCircle />}>
            All validation checks passed! Your study is ready to launch.
          </Alert>
        )}
      </Box>

      {/* Study Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
          Study Summary
        </Typography>

        {/* Basic Information */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Description color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Basic Information
            </Typography>
          </Box>
          <Box sx={{ pl: 4 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Title:</strong> {data.title || 'Not set'}
            </Typography>
            <Typography variant="body2">
              <strong>Description:</strong> {data.description || 'Not set'}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Questions */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Assessment color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Questions ({data.questions?.length || 0})
            </Typography>
          </Box>
          <Box sx={{ pl: 4 }}>
            {data.questions && data.questions.length > 0 ? (
              <List dense>
                {data.questions.map((question, index) => (
                  <ListItem key={question.id || index} sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, width: '100%' }}>
                      <ListItemIcon sx={{ minWidth: 'auto' }}>
                        <CheckCircle fontSize="small" color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {question.title || `Question ${index + 1}`}
                            </Typography>
                            <Chip 
                              label={question.question_type} 
                              size="small" 
                              color={question.question_type === 'comparison' ? 'primary' : 'secondary'}
                            />
                          </Box>
                        }
                        secondary={question.description}
                      />
                    </Box>
                    <Box sx={{ pl: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="text.secondary">
                        <Code fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                        {question.artifacts?.length || 0} artifact{question.artifacts?.length !== 1 ? 's' : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        <Assessment fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                        {question.criteria?.length || 0} criteri{question.criteria?.length !== 1 ? 'a' : 'on'}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No questions created
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Configuration */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Info color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Configuration
            </Typography>
          </Box>
          <Box sx={{ pl: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AccessTime fontSize="small" />
              <Typography variant="body2">
                <strong>Deadline:</strong> {formatDeadline()}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <People fontSize="small" />
              <Typography variant="body2">
                <strong>Capacity:</strong> {data.participant_capacity || 'Not set'} participants
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Quiz fontSize="small" />
              <Typography variant="body2">
                <strong>Quizzes:</strong> {data.selectedQuizIds?.length || 0} assigned
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Button onClick={onBack} disabled={isActivating}>
          Back
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Save />}
            onClick={onSaveDraft}
            disabled={isActivating}
          >
            {editMode ? 'Save Changes' : 'Save as Draft'}
          </Button>
          <Button
            variant="contained"
            startIcon={isActivating ? <CircularProgress size={20} /> : <Rocket />}
            onClick={handleActivate}
            disabled={!validation.isValid || isActivating}
            color="success"
          >
            {isActivating ? 'Activating...' : 'Activate Study'}
          </Button>
        </Box>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <DialogTitle>Activate Study?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {editMode 
              ? 'Once activated, your study will be live and participants can start enrolling. Your changes will be saved.'
              : 'Once activated, your study will be live and participants can start enrolling.'
            }
          </Typography>
          <Alert severity="info">
            You can still cancel the study later if needed, but some settings cannot be changed after activation.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button onClick={confirmActivate} variant="contained" color="success">
            Confirm & Activate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReviewAndLaunchPanel;
