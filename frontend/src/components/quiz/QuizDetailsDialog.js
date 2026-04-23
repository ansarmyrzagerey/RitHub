import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import { Quiz, Delete, Close, Warning, Edit } from '@mui/icons-material';
import EditQuizDialog from './EditQuizDialog';
import toast from 'react-hot-toast';
import quizService from '../../services/quizService';

const QuizDetailsDialog = ({ open, onClose, quiz, onDeleted }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [studyInfo, setStudyInfo] = useState(null);
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (open && quiz) {
      loadQuizDetails();
    }
  }, [open, quiz]);

  const loadQuizDetails = async () => {
    setLoading(true);
    try {
      // Load questions
      const questionsData = await quizService.getQuestions(quiz.id);
      setQuestions(questionsData.questions || []);

      // Check if quiz is connected to a study
      if (quiz.study_id) {
        setLoadingStudy(true);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/studies/${quiz.study_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setStudyInfo(data.study || data);
          }
        } catch (err) {
          console.error('Error loading study info:', err);
        } finally {
          setLoadingStudy(false);
        }
      } else {
        setStudyInfo(null);
      }
    } catch (error) {
      console.error('Error loading quiz details:', error);
      toast.error('Failed to load quiz details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    // Only check if connected to a study - published status doesn't matter
    if (quiz.study_id !== null) {
      toast.error('Cannot delete a quiz that is connected to a study');
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await quizService.deleteQuiz(quiz.id);
      toast.success('Quiz deleted successfully');
      setDeleteConfirmOpen(false);
      onDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting quiz:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete quiz';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
  };

  // Check if quiz has a study - use strict null checking
  const hasStudy = quiz?.study_id !== null;
  const isPublished = quiz?.is_published;
  // Only restriction: quiz cannot be deleted if connected to a study
  const canDelete = quiz && !hasStudy;
  // Edit restriction: cannot edit if connected to study OR published
  const canEdit = quiz && !hasStudy && !isPublished;

  const getDeleteDisabledReason = () => {
    if (!quiz) return '';
    if (hasStudy) return 'Quizzes connected to a study cannot be deleted';
    return '';
  };

  const getEditDisabledReason = () => {
    if (!quiz) return '';
    if (hasStudy) return 'Quizzes connected to a study cannot be edited';
    if (isPublished) return 'Published quizzes cannot be edited';
    return '';
  };

  const handleEditClick = () => {
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
  };

  const handleQuizUpdated = () => {
    loadQuizDetails();
    onDeleted(); // Refresh the parent list
  };

  if (!quiz) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Quiz color="primary" />
            <Typography variant="h6">Quiz Details</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Basic Info */}
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                {quiz.title}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {quiz.description || 'No description provided'}
              </Typography>
            </Box>

            {/* Status Chips */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={quiz.is_published ? 'Published' : 'Draft'}
                color={quiz.is_published ? 'success' : 'default'}
                size="small"
              />
              {quiz.is_ai_generated && (
                <Chip label="AI Generated" size="small" color="info" />
              )}
              {quiz.is_skippable && (
                <Chip label="Skippable" size="small" />
              )}
              {quiz.is_giving_badges && (
                <Chip label="Awards Badges" size="small" color="secondary" />
              )}
            </Box>

            {/* Study Connection */}
            {loadingStudy ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2">Loading study info...</Typography>
              </Box>
            ) : studyInfo ? (
              <Alert severity="info" icon={<Warning />}>
                This quiz is connected to study: <strong>{studyInfo.title}</strong>
                <br />
                <Typography variant="caption">
                  Quizzes connected to studies cannot be deleted from here.
                </Typography>
              </Alert>
            ) : (
              <Alert severity="success">
                This quiz is not connected to any study.
              </Alert>
            )}

            <Divider />

            {/* Quiz Settings */}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Settings
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Passing Score</Typography>
                  <Typography variant="body1">{quiz.passing_score || 0}%</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Created</Typography>
                  <Typography variant="body1">
                    {new Date(quiz.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider />

            {/* Questions */}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Questions ({questions.length})
              </Typography>

              {questions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No questions added yet.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {questions.map((q, index) => (
                    <Paper key={q.id} variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          Q{index + 1}
                        </Typography>
                        <Chip
                          label={q.type === 'multiple' ? 'Multiple Choice' : q.type === 'open' ? 'Open-Ended' : 'Code'}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {q.point_weight || 1} {(q.point_weight || 1) === 1 ? 'point' : 'points'}
                        </Typography>
                        {q.is_absolute && (
                          <Chip label="Required" size="small" color="error" variant="outlined" />
                        )}
                      </Box>
                      <Typography variant="body2">{q.title}</Typography>

                      {q.type === 'multiple' && q.options && (
                        <Box sx={{ mt: 1, ml: 2 }}>
                          {q.options.map((opt, optIdx) => (
                            <Typography
                              key={optIdx}
                              variant="caption"
                              sx={{
                                display: 'block',
                                color: opt === q.correct_answer ? 'success.main' : 'text.secondary',
                                fontWeight: opt === q.correct_answer ? 600 : 400
                              }}
                            >
                              {String.fromCharCode(65 + optIdx)}. {opt}
                              {opt === q.correct_answer && ' ✓'}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Tooltip title={getDeleteDisabledReason()} arrow>
          <span>
            <Button
              color="error"
              variant="outlined"
              startIcon={<Delete />}
              onClick={handleDeleteClick}
              disabled={!canDelete || deleting}
            >
              Delete Quiz
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={getEditDisabledReason()} arrow>
          <span>
            <Button
              color="primary"
              variant="outlined"
              startIcon={<Edit />}
              onClick={handleEditClick}
              disabled={!canEdit}
            >
              Edit Quiz
            </Button>
          </span>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
      >
        <DialogTitle>Delete Quiz</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the quiz "{quiz?.title}"? 
            This action cannot be undone and will permanently remove the quiz and all its questions.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : null}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Quiz Dialog */}
      <EditQuizDialog
        open={editDialogOpen}
        onClose={handleEditClose}
        quiz={quiz}
        onUpdated={handleQuizUpdated}
      />
    </Dialog>
  );
};

export default QuizDetailsDialog;
