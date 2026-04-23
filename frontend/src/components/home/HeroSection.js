import React from 'react';
import { 
  Typography, 
  Box, 
  Container,
  Grid,
  Button
} from '@mui/material';
import { 
  ArrowForward,
  PlayArrow
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Import constants
import { ROUTES, MOCK_DATA, APP_CONFIG } from '../../constants';

const HeroSection = () => {
  const navigate = useNavigate();
  const { STATS_HERO } = MOCK_DATA;

  // Event handlers
  const handleGetStarted = () => {
    navigate(ROUTES.DASHBOARD);
  };

  const handleWatchDemo = () => {
    console.log('Watch demo clicked');
    // TODO: Implement demo functionality
  };

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        py: 8,
        mb: 6,
      }}
    >
      <Container maxWidth="lg">
        <Box textAlign="center" mb={6}>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 700,
              mb: 3,
              background: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {APP_CONFIG.NAME}
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 400,
              mb: 4,
              opacity: 0.9,
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.6,
            }}
          >
            {APP_CONFIG.DESCRIPTION}
          </Typography>
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              onClick={handleGetStarted}
              sx={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.3)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              Get Started
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<PlayArrow />}
              onClick={handleWatchDemo}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.5)',
                color: 'white',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              Future video
            </Button>
          </Box>
        </Box>

        {/* Stats */}
        <Grid container spacing={4} justifyContent="center">
          {STATS_HERO.map((stat, index) => (
            <Grid item xs={6} sm={3} key={index}>
              <Box textAlign="center">
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                  {stat.value}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.8 }}>
                  {stat.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default HeroSection;