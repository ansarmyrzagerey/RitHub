import React, { useState, useEffect } from 'react';
import { Box, Fade, Slide } from '@mui/material';

const AuthTransition = ({ children, isSignUp, onTransitionComplete }) => {
  const [showContent, setShowContent] = useState(false);
  const [backgroundTransition, setBackgroundTransition] = useState(false);

  useEffect(() => {
    if (isSignUp) {
      // Start background transition immediately
      setBackgroundTransition(true);
      
      // Show content after a short delay for smooth effect
      const timer = setTimeout(() => {
        setShowContent(true);
        if (onTransitionComplete) {
          onTransitionComplete();
        }
      }, 300);

      return () => clearTimeout(timer);
    } else {
      // Reset for login page
      setBackgroundTransition(false);
      setShowContent(true);
    }
  }, [isSignUp, onTransitionComplete]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: backgroundTransition 
          ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        transition: 'background 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isSignUp 
            ? 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)'
            : 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)',
          opacity: backgroundTransition ? 1 : 0,
          transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1,
        }}
      />

      {/* Content with smooth slide and fade */}
      <Fade in={showContent} timeout={800}>
        <Slide 
          direction="up" 
          in={showContent} 
          timeout={600}
          style={{ zIndex: 2, position: 'relative' }}
        >
          <Box sx={{ width: '100%', maxWidth: isSignUp ? 600 : 480 }}>
            {children}
          </Box>
        </Slide>
      </Fade>
    </Box>
  );
};

export default AuthTransition;
