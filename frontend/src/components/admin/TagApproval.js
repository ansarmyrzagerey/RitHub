import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
  LinearProgress,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  CheckCircle, 
  Cancel, 
  LocalOffer,
  Person,
  Schedule
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const TagApproval = () => {
  const [pendingTags, setPendingTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadPendingTags();
  }, []);

  const loadPendingTags = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tags/pending', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setPendingTags(result.tags);
      } else {
        toast.error('Failed to load pending tags');
      }
    } catch (error) {
      console.error('Error loading pending tags:', error);
      toast.error('Failed to load pending tags');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (tagId) => {
    try {
      setProcessing(tagId);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tags/${tagId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Tag approved successfully');
        setPendingTags(prev => prev.filter(tag => tag.id !== tagId));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error approving tag:', error);
      toast.error('Failed to approve tag');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (tagId) => {
    try {
      setProcessing(tagId);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tags/${tagId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Tag rejected successfully');
        setPendingTags(prev => prev.filter(tag => tag.id !== tagId));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error rejecting tag:', error);
      toast.error('Failed to reject tag');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalOffer />
          Tag Approval
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocalOffer />
        Tag Approval ({pendingTags.length} pending)
      </Typography>

      {pendingTags.length === 0 ? (
        <Alert severity="info">
          No pending tags to review.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {pendingTags.map((tag) => (
            <Grid item xs={12} md={6} lg={4} key={tag.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Chip 
                      label={tag.name} 
                      color="warning" 
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                    <Chip 
                      label="PENDING" 
                      color="warning" 
                      size="small"
                    />
                  </Box>

                  {tag.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {tag.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Person fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      Requested by: {tag.first_name} {tag.last_name}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <Schedule fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {new Date(tag.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircle />}
                      onClick={() => handleApprove(tag.id)}
                      disabled={processing === tag.id}
                      size="small"
                      fullWidth
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Cancel />}
                      onClick={() => handleReject(tag.id)}
                      disabled={processing === tag.id}
                      size="small"
                      fullWidth
                    >
                      Reject
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default TagApproval;