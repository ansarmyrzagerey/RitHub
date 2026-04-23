import React, { useState, useEffect } from 'react';
import { Backdrop, CircularProgress, LinearProgress, Box } from '@mui/material';

/**
 * Global loading indicator that listens to API loading events
 */
export const GlobalLoadingIndicator = () => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleLoading = (event) => {
      setLoading(event.detail.loading);
    };

    window.addEventListener('api-loading', handleLoading);

    return () => {
      window.removeEventListener('api-loading', handleLoading);
    };
  }, []);

  if (!loading) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999
      }}
    >
      <LinearProgress />
    </Box>
  );
};

/**
 * Loading overlay component
 */
export const LoadingOverlay = ({ open, message = 'Loading...' }) => {
  return (
    <Backdrop
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        flexDirection: 'column',
        gap: 2
      }}
      open={open}
    >
      <CircularProgress color="inherit" />
      {message && <Box sx={{ mt: 2 }}>{message}</Box>}
    </Backdrop>
  );
};

/**
 * Inline loading spinner
 */
export const LoadingSpinner = ({ size = 40, color = 'primary' }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 3
      }}
    >
      <CircularProgress size={size} color={color} />
    </Box>
  );
};

export default GlobalLoadingIndicator;
