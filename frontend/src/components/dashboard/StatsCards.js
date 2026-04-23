import React, { useEffect, useState } from 'react';
import { 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Box,
  Avatar
} from '@mui/material';
import { 
  Science,
  Code,
  People,
  TrendingUp,
  Assessment,
  Schedule,
  CheckCircle,
  PlayArrow
} from '@mui/icons-material';
import researcherService from '../../services/researcherService';

const StatsCards = ({ studies = [] }) => {
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    researcherService.listArtifacts()
      .then(data => setArtifacts(data || []))
      .catch(() => setArtifacts([]))
      .finally(() => setLoading(false));
  }, []);

  // Calculate stats from real data
  const activeStudies = studies.filter(s => s.status === 'active' || s.status === 'in_progress').length;
  const totalArtifacts = artifacts.length;
  const totalParticipants = studies.reduce((sum, s) => sum + (s.participant_count || 0), 0);
  const avgCompletion = studies.length > 0 
    ? Math.round(studies.reduce((sum, s) => sum + (s.completion_pct || 0), 0) / studies.length)
    : 0;

  // Icon mapping
  const iconMap = {
    Science,
    Code,
    People,
    TrendingUp,
    Assessment,
    Schedule,
    CheckCircle,
    PlayArrow,
  };

  const stats = [
    {
      title: 'Active Studies',
      value: activeStudies,
      icon: 'Science',
      color: '#10a37f',
    },
    {
      title: 'Total Artifacts',
      value: loading ? '...' : totalArtifacts,
      icon: 'Code',
      color: '#6366f1',
    },
    {
      title: 'Participants',
      value: totalParticipants,
      icon: 'People',
      color: '#f59e0b',
    },
    {
      title: 'Avg Completion',
      value: `${avgCompletion}%`,
      icon: 'TrendingUp',
      color: '#ef4444',
    },
  ];

  return (
    <Grid container spacing={3} mb={4}>
      {stats.map((stat, index) => {
        const IconComponent = iconMap[stat.icon];
        
        return (
          <Grid item xs={12} sm={6} lg={3} key={index}>
            <Card
              sx={{
                height: '100%',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.15)',
                  backgroundColor: 'rgba(16, 163, 127, 0.02)',
                },
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Avatar
                    sx={{
                      backgroundColor: stat.color,
                      width: 48,
                      height: 48,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'scale(1.05)',
                      },
                    }}
                  >
                    <IconComponent />
                  </Avatar>
                </Box>
                <Typography variant="h4" component="div" sx={{ fontWeight: 700, mb: 1 }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};

export default StatsCards;