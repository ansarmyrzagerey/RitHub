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
  Assignment,
} from '@mui/icons-material';
import ParticipantService from '../services/participantService';
import toast from 'react-hot-toast';

const EvaluationTrashBin = () => {
  const navigate = useNavigate();
  const [deletedEvaluations, setDeletedEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDeletedEvaluations();
  }, []);

  const fetchDeletedEvaluations = async () => {
    setLoading(true);
    try {
      const response = await ParticipantService.getDeletedEvaluations();
      setDeletedEvaluations(response.evaluations || []);
    } catch (error) {
      console.error('Error fetching deleted evaluations:', error);
      toast.error('Failed to fetch deleted evaluations');
      setDeletedEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (evaluation) => {
    setSelectedEvaluation(evaluation);
    setRestoreDialogOpen(true);
  };

  const handlePermanentDelete = (evaluation) => {
    setSelectedEvaluation(evaluation);
    setPermanentDeleteDialogOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedEvaluation) return;
    
    setActionLoading(true);
    try {
      await ParticipantService.restoreEvaluation(selectedEvaluation.id);
      toast.success('Evaluation restored successfully');
      setRestoreDialogOpen(false);
      setSelectedEvaluation(null);
      fetchDeletedEvaluations();
    } catch (error) {
      console.error('Error restoring evaluation:', error);
      toast.error('Failed to restore evaluation');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!selectedEvaluation) return;
    
    setActionLoading(true);
    try {
      await ParticipantService.permanentDeleteEvaluation(selectedEvaluation.id);
      toast.success('Evaluation permanently deleted');
      setPermanentDeleteDialogOpen(false);
      setSelectedEvaluation(null);
      fetchDeletedEvaluations();
    } catch (error) {
      console.error('Error permanently deleting evaluation:', error);
      toast.error('Failed to permanently delete evaluation');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredEvaluations = deletedEvaluations.filter(evaluation =>
    evaluation.study_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    evaluation.task_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    evaluation.instructions?.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <IconButton onClick={() => navigate('/participant/studies')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="primary" />
          Evaluation Trash Bin
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Evaluations in the trash bin will be automatically permanently deleted after 20 days. 
        You can restore them before then or permanently delete them manually.
      </Alert>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search deleted evaluations..."
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

      {/* Evaluation List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredEvaluations.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Delete sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
              {searchQuery ? 'No matching evaluations found' : 'Trash bin is empty'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
              {searchQuery 
                ? 'Try adjusting your search query to find deleted evaluations.'
                : 'Deleted evaluations will appear here and can be restored within 20 days.'}
            </Typography>
            <Button 
              variant="outlined" 
              onClick={() => navigate('/participant/studies')}
            >
              Back to Studies
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredEvaluations.map((evaluation) => {
            const daysInTrash = getDaysInTrash(evaluation.deleted_at);
            const daysRemaining = getDaysRemaining(evaluation.deleted_at);

            return (
              <Grid item xs={12} md={6} lg={4} key={evaluation.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {evaluation.study_title || 'Unknown Study'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Chip 
                          label="DELETED" 
                          color="error"
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                        <Chip 
                          label={`${daysRemaining} days left`}
                          color={getExpirationColor(evaluation.deleted_at)}
                          size="small"
                        />
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Assignment fontSize="small" color="action" />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {evaluation.task_type || 'Evaluation Task'}
                        </Typography>
                      </Box>
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
                        {evaluation.instructions || 'No description available'}
                      </Typography>
                    </Box>

                    {/* Deletion Info */}
                    <Box sx={{ mb: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Schedule fontSize="small" color="action" />
                        <Typography variant="caption">
                          Deleted {daysInTrash} day{daysInTrash !== 1 ? 's' : ''} ago
                        </Typography>
                      </Box>
                      {evaluation.completed_at && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Completed: {new Date(evaluation.completed_at).toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Restore evaluation">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Restore />}
                          onClick={() => handleRestore(evaluation)}
                          sx={{ flex: 1 }}
                        >
                          Restore
                        </Button>
                      </Tooltip>
                      <Tooltip title="Permanently delete evaluation (cannot be undone)">
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<DeleteForever />}
                          onClick={() => handlePermanentDelete(evaluation)}
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
        <DialogTitle>Restore Evaluation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to restore this evaluation? 
            It will be accessible again in your studies.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleRestoreConfirm} color="primary" disabled={actionLoading}>
            {actionLoading ? 'Restoring...' : 'Restore Evaluation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={permanentDeleteDialogOpen} onClose={() => !actionLoading && setPermanentDeleteDialogOpen(false)}>
        <DialogTitle>Permanently Delete Evaluation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete this evaluation? 
            This action cannot be undone and all evaluation data will be lost forever.
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

export default EvaluationTrashBin;


