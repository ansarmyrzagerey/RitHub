import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  MoreVert,
  Edit,
  Cancel,
  Share,
  Analytics,
  Archive,
  People,
  Schedule,
  Delete,
} from '@mui/icons-material';
import { studyService } from '../../services/studyService';
import { ROUTES } from '../../constants';
import { useAuth } from '../../hooks/useAuth';

const StudyCard = ({ study, onUpdate }) => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if current user is the study owner
  const isOwner = user && study.created_by === user.id;
  const canEdit = isOwner && study.status === 'draft';
  const canCancel = isOwner && (study.status === 'draft' || study.status === 'active');
  const canArchive = (isOwner || isAdmin) && (study.status === 'completed' || study.status === 'cancelled');
  const canDelete = (isOwner || isAdmin) && study.status !== 'deleted';

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    navigate(ROUTES.STUDIES_EDIT.replace(':id', study.id));
  };

  const handleCancel = () => {
    handleMenuClose();
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    setLoading(true);
    try {
      await studyService.cancelStudy(study.id, cancelReason);
      setCancelDialogOpen(false);
      setCancelReason('');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error cancelling study:', error);
      alert('Failed to cancel study. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    handleMenuClose();
    try {
      const linkData = await studyService.getEnrollmentLink(study.id);
      const enrollmentUrl = `${window.location.origin}/enroll/${linkData.token}`;
      await navigator.clipboard.writeText(enrollmentUrl);
      alert('Enrollment link copied to clipboard!');
    } catch (error) {
      console.error('Error getting enrollment link:', error);
      alert('Failed to get enrollment link. Please try again.');
    }
  };

  const handleViewAnalytics = () => {
    handleMenuClose();
    navigate(`/studies/${study.id}/analytics`);
  };

  const handleArchive = async () => {
    handleMenuClose();
    setLoading(true);
    try {
      await studyService.archiveStudy(study.id);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error archiving study:', error);
      alert('Failed to archive study. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setLoading(true);
    try {
      await studyService.deleteStudy(study.id);
      setDeleteDialogOpen(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting study:', error);
      alert('Failed to delete study. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = () => {
    navigate(ROUTES.STUDIES_DETAIL.replace(':id', study.id));
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      active: 'success',
      completed: 'info',
      // Treat cancelled visually same as archived
      cancelled: 'default',
      archived: 'default',
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    if (status === 'cancelled') return 'ARCHIVED';
    return status.toUpperCase();
  };

  const getDeadlineText = () => {
    if (!study.deadline) return 'No deadline';
    
    const deadline = new Date(study.deadline);
    const now = new Date();
    const diff = deadline - now;
    
    if (diff < 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return 'Less than 1h remaining';
  };

  const getDeadlineColor = () => {
    if (!study.deadline) return 'text.secondary';
    
    const deadline = new Date(study.deadline);
    const now = new Date();
    const diff = deadline - now;
    const hours = diff / (1000 * 60 * 60);
    
    if (hours < 0) return 'error.main';
    if (hours < 24) return 'error.main';
    if (hours < 72) return 'warning.main';
    return 'text.secondary';
  };

  const capacityPercentage = study.participant_capacity 
    ? (study.enrolled_count / study.participant_capacity) * 100 
    : 0;

  const getCapacityColor = () => {
    if (capacityPercentage >= 90) return 'error';
    if (capacityPercentage >= 70) return 'warning';
    return 'success';
  };

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
            <Box sx={{ flexGrow: 1, mr: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                {study.title}
              </Typography>
              <Chip 
                label={getStatusLabel(study.status)} 
                color={getStatusColor(study.status)}
                size="small"
                sx={study.status === 'cancelled' ? { fontWeight: 600 } : {}}
              />
            </Box>
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVert />
            </IconButton>
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

          {/* Cancellation Notice */}
          {study.status === 'cancelled' && study.cancellation_reason && (
            <Box 
              sx={{ 
                mb: 2, 
                p: 1, 
                bgcolor: 'error.light', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'error.main'
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'error.dark', display: 'block' }}>
                Study Cancelled
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'error.dark',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {study.cancellation_reason}
              </Typography>
            </Box>
          )}

          {/* Metrics */}
          <Box sx={{ mb: 2 }}>
            {/* Participants */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <People fontSize="small" color="action" />
              <Typography variant="body2">
                {study.enrolled_count || 0}/{study.participant_capacity || 'Unlimited'} participants
              </Typography>
            </Box>

            {/* Capacity Progress Bar */}
            {study.participant_capacity && (
              <Box sx={{ mb: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(capacityPercentage, 100)} 
                  color={getCapacityColor()}
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>
            )}

            {/* Deadline */}
            {study.deadline && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Schedule fontSize="small" color="action" />
                <Typography variant="body2" color={getDeadlineColor()}>
                  {getDeadlineText()}
                </Typography>
              </Box>
            )}


          </Box>

          <Button 
            variant="outlined" 
            fullWidth
            onClick={handleViewDetails}
          >
            View Details
          </Button>
        </CardContent>
      </Card>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {/* Only show Edit for study owner and draft studies */}
        {canEdit && (
          <MenuItem onClick={handleEdit}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {/* Only show Cancel for study owner */}
        {canCancel && (
          <MenuItem onClick={handleCancel}>
            <Cancel fontSize="small" sx={{ mr: 1 }} />
            Cancel Study
          </MenuItem>
        )}
        {/* Only show Share Link for owner/admin and active studies */}
        {(isOwner || isAdmin) && study.status === 'active' && (
          <MenuItem onClick={handleShare}>
            <Share fontSize="small" sx={{ mr: 1 }} />
            Share Link
          </MenuItem>
        )}
        <MenuItem onClick={handleViewAnalytics}>
          <Analytics fontSize="small" sx={{ mr: 1 }} />
          View Analytics
        </MenuItem>
        {/* Only show Archive for owner/admin */}
        {canArchive && (
          <MenuItem onClick={handleArchive}>
            <Archive fontSize="small" sx={{ mr: 1 }} />
            Archive
          </MenuItem>
        )}
        {/* Only show Delete for owner/admin */}
        {canDelete && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => !loading && setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Study</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to cancel this study? This action cannot be undone.
            Enrolled participants will be notified.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for cancellation (optional)"
            fullWidth
            multiline
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={loading}>
            Keep Study
          </Button>
          <Button onClick={handleCancelConfirm} color="error" disabled={loading}>
            {loading ? 'Cancelling...' : 'Cancel Study'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !loading && setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Study</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this study? The study will be moved to the trash bin 
            and can be restored within 20 days. After 20 days, it will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={loading}>
            {loading ? 'Deleting...' : 'Delete Study'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default StudyCard;
