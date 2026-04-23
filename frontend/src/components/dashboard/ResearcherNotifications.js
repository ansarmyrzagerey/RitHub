import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Button, Box, IconButton, Chip } from '@mui/material';
import { Visibility, CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import researcherService from '../../services/researcherService';

export default function ResearcherNotifications() {
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    researcherService.getNotifications({ limit }).then(data => { 
      if (mounted) {
        setNotes(data.notifications || data); // Handle both old and new format
        setTotal(data.total || (data.notifications || data).length);
      }
    }).catch(() => { 
      if (mounted) setNotes([]); 
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [limit]);

  const handleView = async (notification) => {
    try {
      // Delete the notification when viewed
      await researcherService.deleteNotification(notification.id);
      // Remove from state
      setNotes(prev => prev.filter(x => x.id !== notification.id));
      // Navigate to the link
      if (notification.link) {
        navigate(notification.link);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getNotificationIcon = (title) => {
    if (title.includes('50%')) return '📊';
    if (title.includes('complete!')) return '🎉';
    return '📬';
  };

  if (loading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">Loading notifications...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!notes || notes.length === 0) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Notifications</Typography>
          <Typography variant="body2" color="text.secondary">No new notifications</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Notifications
          <Chip label={notes.length} size="small" color="primary" />
          {total > limit && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (showing {notes.length} of {total})
            </Typography>
          )}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
          {notes.map(n => (
            <Card 
              key={n.id} 
              variant="outlined" 
              sx={{ 
                borderLeft: '4px solid #1976d2',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: 2,
                  transform: 'translateX(4px)'
                }
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, mr: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{getNotificationIcon(n.title)}</span>
                      {n.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {n.body}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(n.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Visibility />}
                    onClick={() => handleView(n)}
                    sx={{ 
                      minWidth: 100,
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    View
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
