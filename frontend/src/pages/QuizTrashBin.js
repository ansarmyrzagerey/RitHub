import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  InputAdornment,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Delete,
  Restore,
  Search,
  DeleteForever,
  Schedule,
  ArrowBack,
  Quiz,
} from '@mui/icons-material';
import ParticipantService from '../services/participantService';
import toast from 'react-hot-toast';

const QuizTrashBin = () => {
  const navigate = useNavigate();
  const [deletedQuizAttempts, setDeletedQuizAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [selectedQuizAttempt, setSelectedQuizAttempt] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDeletedQuizAttempts();
  }, []);

  const fetchDeletedQuizAttempts = async () => {
    setLoading(true);
    try {
      const response = await ParticipantService.getDeletedQuizAttempts();
      setDeletedQuizAttempts(response.quizAttempts || []);
    } catch (error) {
      console.error('Error fetching deleted quiz attempts:', error);
      toast.error('Failed to fetch deleted quiz attempts');
      setDeletedQuizAttempts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (quizAttempt) => {
    setSelectedQuizAttempt(quizAttempt);
    setRestoreDialogOpen(true);
  };

  const handlePermanentDelete = (quizAttempt) => {
    setSelectedQuizAttempt(quizAttempt);
    setPermanentDeleteDialogOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedQuizAttempt) return;
    
    setActionLoading(true);
    try {
      await ParticipantService.restoreQuizAttempt(selectedQuizAttempt.id);
      toast.success('Quiz attempt restored successfully');
      setRestoreDialogOpen(false);
      setSelectedQuizAttempt(null);
      fetchDeletedQuizAttempts();
    } catch (error) {
      console.error('Error restoring quiz attempt:', error);
      toast.error('Failed to restore quiz attempt');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!selectedQuizAttempt) return;
    
    setActionLoading(true);
    try {
      await ParticipantService.permanentDeleteQuizAttempt(selectedQuizAttempt.id);
      toast.success('Quiz attempt permanently deleted');
      setPermanentDeleteDialogOpen(false);
      setSelectedQuizAttempt(null);
      fetchDeletedQuizAttempts();
    } catch (error) {
      console.error('Error permanently deleting quiz attempt:', error);
      toast.error('Failed to permanently delete quiz attempt');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredQuizAttempts = deletedQuizAttempts.filter(attempt =>
    attempt.quiz_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    attempt.study_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    attempt.quiz_description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDaysInTrash = (deletedAt) => {
    const deleted = new Date(deletedAt);
    const now = new Date();
    const diffTime = Math.abs(now - deleted);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysRemaining = (deletedAt) => {
    const daysInTrash = getDaysInTrash(deletedAt);
    return Math.max(0, 20 - daysInTrash);
  };

  const getExpirationColor = (deletedAt) => {
    const daysRemaining = getDaysRemaining(deletedAt);
    if (daysRemaining <= 3) return 'error';
    if (daysRemaining <= 7) return 'warning';
    return 'info';
  };

  const getStatusLabel = (attempt) => {
    if (attempt.passed) return 'Passed';
    if (attempt.grading_status === 'pending_grading') return 'Pending Grading';
    return 'Failed';
  };

  const getStatusColor = (attempt) => {
    if (attempt.passed) return 'success';
    if (attempt.grading_status === 'pending_grading') return 'warning';
    return 'error';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <IconButton onClick={() => navigate('/participant/quizzes')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="primary" />
          Quiz Trash Bin
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Quiz attempts in the trash bin will be automatically permanently deleted after 20 days. 
        You can restore them before then or permanently delete them manually.
      </Alert>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search deleted quiz attempts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Quiz Attempt List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredQuizAttempts.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Delete sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
              {searchQuery ? 'No matching quiz attempts found' : 'Trash bin is empty'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
              {searchQuery 
                ? 'Try adjusting your search query to find deleted quiz attempts.'
                : 'Deleted quiz attempts will appear here and can be restored within 20 days.'}
            </Typography>
            <Button 
              variant="outlined" 
              onClick={() => navigate('/participant/quizzes')}
            >
              Back to Quizzes
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredQuizAttempts.map((attempt) => {
            const daysInTrash = getDaysInTrash(attempt.deleted_at);
            const daysRemaining = getDaysRemaining(attempt.deleted_at);

            return (
              <Grid item xs={12} md={6} lg={4} key={attempt.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {attempt.quiz_title || 'Unknown Quiz'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <Chip 
                          label="DELETED" 
                          color="error"
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                        <Chip 
                          label={`${daysRemaining} days left`}
                          color={getExpirationColor(attempt.deleted_at)}
                          size="small"
                        />
                        <Chip 
                          label={getStatusLabel(attempt)}
                          color={getStatusColor(attempt)}
                          size="small"
                        />
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      {attempt.study_title && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Study: {attempt.study_title}
                        </Typography>
                      )}
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {attempt.quiz_description || 'No description available'}
                      </Typography>
                      {attempt.score !== null && (
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                          Score: {attempt.score}%
                        </Typography>
                      )}
                    </Box>

                    {/* Deletion Info */}
                    <Box sx={{ mb: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Schedule fontSize="small" color="action" />
                        <Typography variant="caption">
                          Deleted {daysInTrash} day{daysInTrash !== 1 ? 's' : ''} ago
                        </Typography>
                      </Box>
                      {attempt.submitted_at && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Submitted: {new Date(attempt.submitted_at).toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Restore quiz attempt">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Restore />}
                          onClick={() => handleRestore(attempt)}
                          sx={{ flex: 1 }}
                        >
                          Restore
                        </Button>
                      </Tooltip>
                      <Tooltip title="Permanently delete quiz attempt (cannot be undone)">
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<DeleteForever />}
                          onClick={() => handlePermanentDelete(attempt)}
                        >
                          Delete
                        </Button>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => !actionLoading && setRestoreDialogOpen(false)}>
        <DialogTitle>Restore Quiz Attempt</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to restore this quiz attempt? 
            It will be accessible again in your quizzes.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleRestoreConfirm} color="primary" disabled={actionLoading}>
            {actionLoading ? 'Restoring...' : 'Restore Quiz Attempt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={permanentDeleteDialogOpen} onClose={() => !actionLoading && setPermanentDeleteDialogOpen(false)}>
        <DialogTitle>Permanently Delete Quiz Attempt</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete this quiz attempt? 
            This action cannot be undone and all quiz attempt data will be lost forever.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermanentDeleteDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handlePermanentDeleteConfirm} color="error" disabled={actionLoading}>
            {actionLoading ? 'Deleting...' : 'Permanently Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuizTrashBin;


