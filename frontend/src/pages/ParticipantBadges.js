import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip
} from '@mui/material';
import { EmojiEvents } from '@mui/icons-material';
import axios from 'axios';

const ParticipantBadges = () => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/badges/my-badges', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setBadges(response.data.badges);
      }
    } catch (error) {
      console.error('Failed to load badges:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiEvents color="primary" sx={{ fontSize: 32 }} />
          My Badges ({badges.length})
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Badges you've earned by completing quizzes
        </Typography>
      </Box>

      {badges.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <EmojiEvents sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Badges Yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Complete quizzes to earn badges and showcase your skills!
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {badges.map((badge) => (
            <Grid item xs={12} sm={6} md={4} key={badge.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <EmojiEvents sx={{ fontSize: 64, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      {badge.name}
                    </Typography>
                    {badge.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {badge.description}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Chip
                      label={`Earned: ${new Date(badge.earned_at).toLocaleDateString()}`}
                      size="small"
                      color="success"
                    />
                    {badge.quiz_title && (
                      <Chip
                        label={`From: ${badge.quiz_title}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
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

export default ParticipantBadges;
