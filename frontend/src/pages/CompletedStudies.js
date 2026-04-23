import React, { useState, useEffect, useRef } from 'react';
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
  CheckCircle,
  Delete,
  Search,
  ArrowBack,
  Science,
  Schedule,
} from '@mui/icons-material';
import ParticipantService from '../services/participantService';
import toast from 'react-hot-toast';

const CompletedStudies = () => {
  const navigate = useNavigate();
  const [completedStudies, setCompletedStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Prevent double fetch in React Strict Mode
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchCompletedStudies();
  }, []);

  const fetchCompletedStudies = async () => {
    setLoading(true);
    try {
      const response = await ParticipantService.getCompletedStudies();
      setCompletedStudies(response.studies || []);
    } catch (error) {
      console.error('Error fetching completed studies:', error);
      toast.error('Failed to fetch completed studies');
      setCompletedStudies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (study) => {
    setSelectedStudy(study);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedStudy || actionLoading) return;
    
    setActionLoading(true);
    try {
      await ParticipantService.deleteCompletedStudy(selectedStudy.id);
      toast.success('Study moved to trash bin. You can restore it from the trash bin.', {
        duration: 5000,
        action: {
          label: 'View Trash',
          onClick: () => navigate('/participant/studies/completed/trash')
        }
      });
      setDeleteDialogOpen(false);
      setSelectedStudy(null);
      fetchCompletedStudies();
    } catch (error) {
      console.error('Error deleting study:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete study';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredStudies = completedStudies.filter(study =>
    study.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    study.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/participant/studies')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle color="success" />
            Completed Studies
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Delete />}
          onClick={() => navigate('/participant/studies/completed/trash')}
        >
          Trash Bin
        </Button>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        These are studies where you have completed all evaluation tasks. 
        When you delete a study, it will be moved to the trash bin first. You can restore it from the trash bin, or permanently delete it from there. 
        The evaluations will always remain in the database for researchers.
      </Alert>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search completed studies..."
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
            <CheckCircle sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
              {searchQuery ? 'No matching studies found' : 'No completed studies'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
              {searchQuery 
                ? 'Try adjusting your search query to find completed studies.'
                : 'Studies you have completed will appear here.'}
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
          {filteredStudies.map((study) => (
            <Grid item xs={12} md={6} lg={4} key={study.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      {study.title || 'Untitled Study'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <Chip 
                        label="COMPLETED" 
                        color="success"
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip 
                        label={`${study.completed_evaluations || study.total_tasks}/${study.total_tasks} tasks`}
                        color="info"
                        size="small"
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
                        <Schedule fontSize="small" color="action" />
                        <Typography variant="caption">
                          Completed: {formatDate(study.last_completed_at)}
                        </Typography>
                      </Box>
                    )}
                    {study.deadline && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Deadline: {formatDate(study.deadline)}
                      </Typography>
                    )}
                  </Box>

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="View study details">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Science />}
                        onClick={() => navigate(`/participant/studies/${study.id}`)}
                        sx={{ flex: 1 }}
                      >
                        View
                      </Button>
                    </Tooltip>
                    <Tooltip title="Move this study to trash bin (hidden from your view, preserved for researchers)">
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<Delete />}
                        onClick={() => handleDelete(study)}
                        disabled={actionLoading}
                      >
                        Move to Trash
                      </Button>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !actionLoading && setDeleteDialogOpen(false)}>
        <DialogTitle>Move Study to Trash</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to move "{selectedStudy?.title}" to trash? 
            This will hide the study from your view, but the evaluations will remain in the database for researchers.
            You can restore it from the trash bin later.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={actionLoading}>
            {actionLoading ? 'Moving...' : 'Move to Trash'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CompletedStudies;

