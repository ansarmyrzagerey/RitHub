import React from 'react';
import { 
  Typography, 
  Box
} from '@mui/material';

// Import constants
import { APP_CONFIG } from '../../constants';

const LoginHeader = () => {
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
        Sign in to your account
      </Typography>
    </Box>
  );
};

export default LoginHeader;