import React from 'react';
import { 
  Typography, 
  Box, 
  Grid,
  Card,
  CardContent,
  Avatar
} from '@mui/material';
import { 
  Science,
  Code,
  Assessment,
  People,
  TrendingUp,
  Security,
  Speed,
  CheckCircle,
  ArrowForward,
  PlayArrow,
  School,
  Business
} from '@mui/icons-material';

// Import constants
import { MOCK_DATA } from '../../constants';

const FeaturesSection = () => {
  const { FEATURES } = MOCK_DATA;

  // Icon mapping
  const iconMap = {
    Science,
    Code,
    Assessment,
    People,
    TrendingUp,
    Security,
    Speed,
    CheckCircle,
    ArrowForward,
    PlayArrow,
    School,
    Business,
  };

  return (
    <Box mb={8}>
      <Box textAlign="center" mb={6}>
        <Typography variant="h3" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
          Powerful Features
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
          Everything you need to conduct comprehensive software engineering research studies
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {FEATURES.map((feature, index) => {
          const IconComponent = iconMap[feature.icon];
          
          return (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 24px -4px rgba(0, 0, 0, 0.1)',
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Avatar
                    sx={{
                      backgroundColor: feature.color,
                      width: 56,
                      height: 56,
                      mb: 2,
                    }}
                  >
                    <IconComponent />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default FeaturesSection;