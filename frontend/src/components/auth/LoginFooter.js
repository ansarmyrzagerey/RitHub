import React from 'react';
import { 
  Box, 
  Typography
} from '@mui/material';

// Import constants
import { APP_CONFIG } from '../../constants';

const LoginFooter = () => {
  return (
    <Box textAlign="center" mt={3}>
      <Typography variant="body2" color="rgba(255, 255, 255, 0.8)">
        {APP_CONFIG.DESCRIPTION}
      </Typography>
    </Box>
  );
};

export default LoginFooter;