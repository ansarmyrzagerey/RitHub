import React from 'react';
import { 
  Typography, 
  Box
} from '@mui/material';

// Import constants
import { APP_CONFIG } from '../../constants';

const SignUpHeader = () => {
  return (
    <Box textAlign="center" mb={4}>
      <Typography
        variant="h3"
        component="h1"
        sx={{
          fontWeight: 700,
          background: 'linear-gradient(135deg, #10a37f 0%, #6366f1 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 1,
        }}
      >
        {APP_CONFIG.NAME}
      </Typography>
      <Typography
        variant="h6"
        color="text.secondary"
        sx={{ fontWeight: 400 }}
      >
        Create your account
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 1, opacity: 0.8 }}
      >
        Join our research platform and start your journey
      </Typography>
    </Box>
  );
};

export default SignUpHeader;
