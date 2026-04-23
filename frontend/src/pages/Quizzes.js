import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { Quiz, Add, MoreVert, Delete, Publish, Visibility, RateReview, Link as LinkIcon, Edit } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import CreateQuizDialog from '../components/quiz/CreateQuizDialog';
import QuizDetailsDialog from '../components/quiz/QuizDetailsDialog';
import EditQuizDialog from '../components/quiz/EditQuizDialog';
import quizService from '../services/quizService';
import { useAuth } from '../hooks/useAuth';

const Quizzes = () => {
  const { isResearcher } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const data = await quizService.getQuizzes();
      const quizzesList = data.quizzes || data || [];

      // Fetch pending count for each quiz
      const token = localStorage.getItem('token');
      const quizzesWithPending = await Promise.all(
        quizzesList.map(async (quiz) => {
          try {
            const response = await fetch(`/api/quizzes/${quiz.id}/pending-attempts`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const pendingData = await response.json();
            return {
              ...quiz,
              pendingCount: pendingData.attempts?.length || 0
            };
          } catch {
            return { ...quiz, pendingCount: 0 };
          }
        })
      );

      setQuizzes(quizzesWithPending);
    } catch (error) {
      console.error('Error loading quizzes:', error);
      toast.error('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event, quiz) => {
    setAnchorEl(event.currentTarget);
    setSelectedQuiz(quiz);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    // Don't clear selectedQuiz here - it's needed for the details dialog
  };

  const handleViewDetails = () => {
    setDetailsDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDetailsClose = () => {
    setDetailsDialogOpen(false);
    setSelectedQuiz(null);
  };

  const handleEditClick = () => {
    setEditDialogOpen(true);
    setAnchorEl(null);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setSelectedQuiz(null);
  };

  const handleQuizUpdated = () => {
    loadQuizzes();
  };

  const handlePublish = async (quizId) => {
    try {
      await quizService.publishQuiz(quizId);
      toast.success('Quiz published successfully');
      loadQuizzes();
    } catch (error) {
      console.error('Error publishing quiz:', error);
      toast.error('Failed to publish quiz');
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedQuiz) return;
    
    try {
      setDeleting(true);
      await quizService.deleteQuiz(selectedQuiz.id);
      toast.success('Quiz deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedQuiz(null);
      loadQuizzes();
    } catch (error) {
      console.error('Error deleting quiz:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete quiz';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleQuizCreated = () => {
    setCreateDialogOpen(false);
    loadQuizzes();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Quiz color="primary" />
          Quizzes
        </Typography>
        {isResearcher && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Quiz
          </Button>
        )}
      </Box>

      {quizzes.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Quiz sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
              No Quizzes Yet
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Create your first quiz to assess participant competency.
            </Typography>
            {isResearcher && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Your First Quiz
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {quizzes.map((quiz) => (
            <Grid item xs={12} md={6} lg={4} key={quiz.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
                      {quiz.title}
                    </Typography>
                    {isResearcher && (
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, quiz)}
                      >
                        <MoreVert />
                      </IconButton>
                    )}
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {quiz.description || 'No description'}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                      label={quiz.is_published ? 'Published' : 'Draft'}
                      color={quiz.is_published ? 'success' : 'default'}
                      size="small"
                    />
                    {(quiz.study_id || quiz.assigned_studies_count > 0) && (
                      <Chip
                        icon={<LinkIcon />}
                        label={quiz.assigned_studies_count > 1 
                          ? `${quiz.assigned_studies_count} Studies` 
                          : 'Linked to Study'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                    {quiz.pendingCount > 0 && (
                      <Chip
                        label={`${quiz.pendingCount} Pending`}
                        color="warning"
                        size="small"
                      />
                    )}
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

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    Passing Score: {quiz.passing_score}%
                  </Typography>

                  {quiz.pendingCount > 0 && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RateReview />}
                      fullWidth
                      onClick={() => navigate(`/quizzes/${quiz.id}/grade`)}
                    >
                      Grade Submissions
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>
          <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        {/* Edit option - disabled if connected to any study or published */}
        {selectedQuiz && (
          <Tooltip 
            title={(selectedQuiz.study_id || selectedQuiz.assigned_studies_count > 0) ? "Cannot edit quiz connected to a study" : selectedQuiz.is_published ? "Cannot edit published quiz" : ""}
            placement="left"
          >
            <span>
              <MenuItem 
                onClick={handleEditClick}
                disabled={(selectedQuiz.study_id !== null || selectedQuiz.assigned_studies_count > 0) || selectedQuiz.is_published}
              >
                <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
                <ListItemText>Edit</ListItemText>
              </MenuItem>
            </span>
          </Tooltip>
        )}
        {selectedQuiz && !selectedQuiz.is_published && (
          <MenuItem onClick={() => handlePublish(selectedQuiz.id)}>
            <ListItemIcon><Publish fontSize="small" /></ListItemIcon>
            <ListItemText>Publish</ListItemText>
          </MenuItem>
        )}
        {/* Delete option - disabled if connected to any study */}
        {selectedQuiz && (
          <Tooltip 
            title={(selectedQuiz.study_id || selectedQuiz.assigned_studies_count > 0) ? "Cannot delete quiz that is connected to a study" : ""}
            placement="left"
          >
            <span>
              <MenuItem 
                onClick={handleDeleteClick}
                disabled={selectedQuiz.study_id !== null || selectedQuiz.assigned_studies_count > 0}
                sx={{ color: (selectedQuiz.study_id || selectedQuiz.assigned_studies_count > 0) ? 'text.disabled' : 'error.main' }}
              >
                <ListItemIcon><Delete fontSize="small" color={(selectedQuiz.study_id || selectedQuiz.assigned_studies_count > 0) ? 'disabled' : 'error'} /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </span>
          </Tooltip>
        )}
      </Menu>

      <QuizDetailsDialog
        open={detailsDialogOpen}
        onClose={handleDetailsClose}
        quiz={selectedQuiz}
        onDeleted={loadQuizzes}
      />

      <CreateQuizDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreateSuccess={handleQuizCreated}
        studyId={null}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Quiz</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the quiz "{selectedQuiz?.title}"? 
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
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Quiz Dialog */}
      <EditQuizDialog
        open={editDialogOpen}
        onClose={handleEditClose}
        quiz={selectedQuiz}
        onUpdated={handleQuizUpdated}
      />
    </Box>
  );
};

export default Quizzes;
