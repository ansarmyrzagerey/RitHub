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
  Science,
  CheckCircle,
} from '@mui/icons-material';
import ParticipantService from '../services/participantService';
import toast from 'react-hot-toast';

const CompletedStudiesTrashBin = () => {
  const navigate = useNavigate();
  const [deletedStudies, setDeletedStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDeletedStudies();
  }, []);

  const fetchDeletedStudies = async () => {
    setLoading(true);
    try {
      const response = await ParticipantService.getDeletedCompletedStudies();
      setDeletedStudies(response.studies || []);
    } catch (error) {
      console.error('Error fetching deleted studies:', error);
      toast.error('Failed to fetch deleted studies');
      setDeletedStudies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (study) => {
    setSelectedStudy(study);
    setRestoreDialogOpen(true);
  };

  const handlePermanentDelete = (study) => {
    setSelectedStudy(study);
    setPermanentDeleteDialogOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedStudy) return;
    
    setActionLoading(true);
    try {
      await ParticipantService.restoreCompletedStudy(selectedStudy.id);
      toast.success('Study restored successfully');
      setRestoreDialogOpen(false);
      setSelectedStudy(null);
      fetchDeletedStudies();
    } catch (error) {
      console.error('Error restoring study:', error);
      toast.error('Failed to restore study');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!selectedStudy) return;
    
    setActionLoading(true);
    try {
      await ParticipantService.permanentDeleteCompletedStudy(selectedStudy.id);
      toast.success('Study permanently deleted');
      setPermanentDeleteDialogOpen(false);
      setSelectedStudy(null);
      fetchDeletedStudies();
    } catch (error) {
      console.error('Error permanently deleting study:', error);
      toast.error('Failed to permanently delete study');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredStudies = deletedStudies.filter(study =>
    study.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    study.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDaysInTrash = (deletedAt) => {
    if (!deletedAt) return 0;
    const deleted = new Date(deletedAt);
    const now = new Date();
    const diffTime = Math.abs(now - deleted);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <IconButton onClick={() => navigate('/participant/studies/completed')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="primary" />
          Completed Studies Trash Bin
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Studies in the trash bin are hidden from your view but remain in the database for researchers. 
        You can restore them or permanently delete them. Note: Permanently deleting only removes your view of the study; evaluations remain accessible to researchers.
      </Alert>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search deleted studies..."
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

      {/* Studies List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredStudies.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Delete sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
              {searchQuery ? 'No matching studies found' : 'Trash bin is empty'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
              {searchQuery 
                ? 'Try adjusting your search query to find deleted studies.'
                : 'Deleted completed studies will appear here.'}
            </Typography>
            <Button 
              variant="outlined" 
              onClick={() => navigate('/participant/studies/completed')}
            >
              Back to Completed Studies
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredStudies.map((study) => {
            const daysInTrash = getDaysInTrash(study.deleted_at);
            return (
              <Grid item xs={12} md={6} lg={4} key={study.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {study.title || 'Untitled Study'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <Chip 
                          label="DELETED" 
                          color="error"
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                        <Chip 
                          label={`${study.completed_evaluations || study.total_tasks}/${study.total_tasks} tasks`}
                          color="info"
                          size="small"
                        />
                        <Chip 
                          label={`Deleted ${daysInTrash} day${daysInTrash !== 1 ? 's' : ''} ago`}
                          color="default"
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {study.description || 'No description available'}
                      </Typography>
                    </Box>

                    {/* Study Info */}
                    <Box sx={{ mb: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                      {study.last_completed_at && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <CheckCircle fontSize="small" color="action" />
                          <Typography variant="caption">
                            Completed: {formatDate(study.last_completed_at)}
                          </Typography>
                        </Box>
                      )}
                      {study.deleted_at && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Schedule fontSize="small" color="action" />
                          <Typography variant="caption">
                            Deleted: {formatDate(study.deleted_at)}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Restore this study">
                        <Button
                          variant="outlined"
                          color="primary"
                          size="small"
                          startIcon={<Restore />}
                          onClick={() => handleRestore(study)}
                          disabled={actionLoading}
                          sx={{ flex: 1 }}
                        >
                          Restore
                        </Button>
                      </Tooltip>
                      <Tooltip title="Permanently delete (removes your view, evaluations remain for researchers)">
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<DeleteForever />}
                          onClick={() => handlePermanentDelete(study)}
                          disabled={actionLoading}
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
        <DialogTitle>Restore Study</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to restore "{selectedStudy?.title}"? 
            It will be accessible again in your completed studies.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleRestoreConfirm} color="primary" disabled={actionLoading}>
            {actionLoading ? 'Restoring...' : 'Restore Study'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={permanentDeleteDialogOpen} onClose={() => !actionLoading && setPermanentDeleteDialogOpen(false)}>
        <DialogTitle>Permanently Delete Study</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete "{selectedStudy?.title}"? 
            This will remove your view of the study. The evaluations will remain in the database and be accessible to researchers.
            This action cannot be undone.
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

export default CompletedStudiesTrashBin;


