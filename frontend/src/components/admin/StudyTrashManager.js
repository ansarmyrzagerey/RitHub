import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Delete,
  Restore,
  Search,
  DeleteForever,
  Schedule,
  Person,
  CleaningServices,
  Analytics,
} from '@mui/icons-material';
import { studyService } from '../../services/studyService';
import toast from 'react-hot-toast';

const StudyTrashManager = () => {
  const [deletedStudies, setDeletedStudies] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studiesResponse, statsResponse] = await Promise.all([
        studyService.getAdminDeletedStudies(),
        studyService.getTrashStats()
      ]);
      setDeletedStudies(studiesResponse.studies || []);
      setStats(statsResponse.stats || {});
    } catch (error) {
      console.error('Error fetching trash data:', error);
      toast.error('Failed to fetch trash data');
      setDeletedStudies([]);
      setStats({});
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
      await studyService.adminRestoreStudy(selectedStudy.id);
      toast.success('Study restored successfully');
      setRestoreDialogOpen(false);
      setSelectedStudy(null);
      fetchData();
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
      await studyService.adminPermanentDeleteStudy(selectedStudy.id);
      toast.success('Study permanently deleted');
      setPermanentDeleteDialogOpen(false);
      setSelectedStudy(null);
      fetchData();
    } catch (error) {
      console.error('Error permanently deleting study:', error);
      toast.error('Failed to permanently delete study');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCleanup = () => {
    setCleanupDialogOpen(true);
  };

  const handleCleanupConfirm = async () => {
    setActionLoading(true);
    try {
      const response = await studyService.runManualCleanup();
      toast.success(`Cleanup completed: ${response.results.deleted} studies deleted`);
      setCleanupDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error running cleanup:', error);
      toast.error('Failed to run cleanup');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredStudies = deletedStudies.filter(study =>
    study.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    study.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    study.creator_first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    study.creator_last_name.toLowerCase().includes(searchQuery.toLowerCase())
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

  const formatCreatedBy = (study) => {
    if (study.creator_first_name && study.creator_last_name) {
      return `${study.creator_first_name} ${study.creator_last_name}`;
    }
    return 'Unknown';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Delete color="primary" />
        Study Trash Management
      </Typography>

      {/* Statistics */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {stats.total_in_trash || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total in Trash
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {stats.expiring_soon || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Expiring Soon
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="error.main">
                {stats.expired || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ready for Cleanup
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Button
                variant="contained"
                color="error"
                startIcon={<CleaningServices />}
                onClick={handleCleanup}
                disabled={!stats.expired || stats.expired === 0}
              >
                Run Cleanup
              </Button>
            </Paper>
          </Grid>
        </Grid>
      )}

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
      {filteredStudies.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Delete sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {searchQuery ? 'No matching studies found' : 'No deleted studies'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchQuery 
                ? 'Try adjusting your search query.'
                : 'Deleted studies will appear here.'
              }
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredStudies.map((study) => {
            const daysInTrash = getDaysInTrash(study.deleted_at);
            const daysRemaining = getDaysRemaining(study.deleted_at);

            return (
              <Grid item xs={12} key={study.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                      <Box sx={{ flexGrow: 1 }}>
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
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {study.description}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                        <Tooltip title="Restore study">
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Restore />}
                            onClick={() => handleRestore(study)}
                          >
                            Restore
                          </Button>
                        </Tooltip>
                        <Tooltip title="Permanently delete">
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
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Person fontSize="small" color="action" />
                          <Typography variant="body2">
                            Created by: {formatCreatedBy(study)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Schedule fontSize="small" color="action" />
                          <Typography variant="body2">
                            Deleted {daysInTrash} day{daysInTrash !== 1 ? 's' : ''} ago by {formatDeletedBy(study)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        {study.previous_status && (
                          <Typography variant="body2" color="text.secondary">
                            Previous status: <strong>{study.previous_status}</strong>
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          Participants: {study.enrolled_count || 0}
                        </Typography>
                      </Grid>
                    </Grid>
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

      {/* Cleanup Confirmation Dialog */}
      <Dialog open={cleanupDialogOpen} onClose={() => !actionLoading && setCleanupDialogOpen(false)}>
        <DialogTitle>Run Manual Cleanup</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete all studies that have been in the trash for more than 20 days. 
            This action cannot be undone. Are you sure you want to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCleanupDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleCleanupConfirm} color="error" disabled={actionLoading}>
            {actionLoading ? 'Running Cleanup...' : 'Run Cleanup'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudyTrashManager;