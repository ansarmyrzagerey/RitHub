import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Paper,
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
  Person,
  ArrowBack,
} from '@mui/icons-material';
import { studyService } from '../services/studyService';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const StudyTrashBin = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
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
      const response = await studyService.getDeletedStudies();
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
      await studyService.restoreStudy(selectedStudy.id);
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
      await studyService.permanentDeleteStudy(selectedStudy.id);
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
    study.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    study.description.toLowerCase().includes(searchQuery.toLowerCase())
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

  const formatDeletedBy = (study) => {
    if (study.deleted_by_first_name && study.deleted_by_last_name) {
      return `${study.deleted_by_first_name} ${study.deleted_by_last_name}`;
    }
    return 'Unknown';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <IconButton onClick={() => navigate('/studies')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="primary" />
          Trash Bin
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Studies in the trash bin will be automatically permanently deleted after 20 days. 
        You can restore them before then or permanently delete them manually.
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

      {/* Study List */}
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
                : 'Deleted studies will appear here and can be restored within 20 days.'
              }
            </Typography>
            <Button 
              variant="outlined" 
              onClick={() => navigate('/studies')}
            >
              Back to Studies
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredStudies.map((study) => {
            const daysInTrash = getDaysInTrash(study.deleted_at);
            const daysRemaining = getDaysRemaining(study.deleted_at);
            const isOwner = user && study.created_by === user.id;
            const canManage = isOwner || isAdmin;

            return (
              <Grid item xs={12} md={6} lg={4} key={study.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {study.title}
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
                          color={getExpirationColor(study.deleted_at)}
                          size="small"
                        />
                      </Box>
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
                      {study.description}
                    </Typography>

                    {/* Deletion Info */}
                    <Box sx={{ mb: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Schedule fontSize="small" color="action" />
                        <Typography variant="caption">
                          Deleted {daysInTrash} day{daysInTrash !== 1 ? 's' : ''} ago
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person fontSize="small" color="action" />
                        <Typography variant="caption">
                          By {formatDeletedBy(study)}
                        </Typography>
                      </Box>
                      {study.previous_status && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Previous status: {study.previous_status}
                        </Typography>
                      )}
                    </Box>

                    {/* Action Buttons */}
                    {canManage && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Restore study to its previous status">
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Restore />}
                            onClick={() => handleRestore(study)}
                            sx={{ flex: 1 }}
                          >
                            Restore
                          </Button>
                        </Tooltip>
                        <Tooltip title="Permanently delete study (cannot be undone)">
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<DeleteForever />}
                            onClick={() => handlePermanentDelete(study)}
                          >
                            Delete
                          </Button>
                        </Tooltip>
                      </Box>
                    )}

                    {!canManage && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        Only the study owner or admin can manage this study
                      </Typography>
                    )}
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
            The study will be returned to its previous status ({selectedStudy?.previous_status}) 
            and will be accessible again.
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
            This action cannot be undone and all study data will be lost forever.
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

export default StudyTrashBin;