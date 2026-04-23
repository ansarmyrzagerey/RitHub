import React from 'react';
import { 
  Typography, 
  Box, 
  Button
} from '@mui/material';
import { 
  ArrowForward
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Import constants
import { ROUTES, APP_CONFIG } from '../../constants';

const CTASection = () => {
  const navigate = useNavigate();

  // Event handlers
  const handleGetStarted = () => {
    navigate(ROUTES.DASHBOARD);
  };

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)',
        borderRadius: 3,
        p: 6,
        textAlign: 'center',
        color: 'white',
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
        Ready to Start Your Research?
      </Typography>
      <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
        Join hundreds of researchers who trust {APP_CONFIG.NAME} for their studies
      </Typography>
      <Button
        variant="contained"
        size="large"
        endIcon={<ArrowForward />}
        onClick={handleGetStarted}
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            transform: 'translateY(-2px)',
          },
          transition: 'all 0.2s ease-in-out',
        }}
      >
        Get Started Now
      </Button>
    </Box>
  );
};

export default CTASection;