import React from 'react';
import { 
  Box, 
  Typography, 
  Button,
  Divider
} from '@mui/material';

const DemoAccess = ({ onDemoAccess, isLoading }) => {
  return (
    <Box>
      <Divider sx={{ my: 3 }}>
        <Typography variant="body2" color="text.secondary">
          or
        </Typography>
      </Divider>

      {/* Demo Access */}
      <Box textAlign="center">
        <Typography variant="body2" color="text.secondary" mb={2}>
          View webside without loggin in (Testing)
        </Typography>
        <Button
          variant="outlined"
          fullWidth
          onClick={onDemoAccess}
          disabled={isLoading}
          sx={{
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              borderColor: 'primary.dark',
              backgroundColor: 'primary.50',
            },
          }}
        >
          Tempororary viewing
        </Button>
      </Box>
    </Box>
  );
};

export default DemoAccess;