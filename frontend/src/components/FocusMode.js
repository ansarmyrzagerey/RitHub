import React, { useState, useEffect } from 'react';
import {
  Box,
  Fab,
  Tooltip,
  Paper,
  Typography,
  IconButton,
  Divider,
  Switch,
  FormControlLabel,
  Button
} from '@mui/material';
import {
  CenterFocusStrong,
  Visibility,
  VisibilityOff,
  Keyboard,
  Timer,
  Palette,
  Fullscreen,
  FullscreenExit
} from '@mui/icons-material';

const FocusMode = ({ children, onToggle }) => {
  const [isActive, setIsActive] = useState(false);
  const [preferences, setPreferences] = useState({
    dimBackground: true,
    hideNonEssential: true,
    showKeyboardHints: false,
    focusTimer: false,
    highContrast: false,
    fullscreen: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);

  // Timer for focus sessions
  useEffect(() => {
    let interval;
    if (isActive && preferences.focusTimer) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, preferences.focusTimer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            toggleFocusMode();
            break;
          case 'h':
            e.preventDefault();
            setShowSettings(!showSettings);
            break;
          case 'k':
            e.preventDefault();
            setPreferences(prev => ({...prev, showKeyboardHints: !prev.showKeyboardHints}));
            break;
        }
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isActive, showSettings]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setPreferences(prev => ({
        ...prev,
        fullscreen: !!document.fullscreenElement
      }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFocusMode = () => {
    setIsActive(!isActive);
    onToggle?.(!isActive);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn('Fullscreen not supported:', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Focus Mode Toggle Button */}
      <Tooltip title={isActive ? "Exit Focus Mode (Ctrl+F)" : "Enter Focus Mode (Ctrl+F)"}>
        <Fab
          color={isActive ? "secondary" : "primary"}
          size="medium"
          onClick={toggleFocusMode}
          sx={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            zIndex: 1300,
            boxShadow: 3
          }}
        >
          <CenterFocusStrong />
        </Fab>
      </Tooltip>

      {/* Focus Mode Settings Panel */}
      {isActive && (
        <Tooltip title="Focus Settings (Ctrl+H)">
          <Fab
            color="secondary"
            size="small"
            onClick={() => setShowSettings(!showSettings)}
            sx={{
              position: 'fixed',
              bottom: 90,
              left: 20,
              zIndex: 1300,
              boxShadow: 3
            }}
          >
            <Palette />
          </Fab>
        </Tooltip>
      )}

      {/* Settings Panel */}
      {showSettings && isActive && (
        <Paper
          sx={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 1300,
            p: 2,
            minWidth: 300,
            maxWidth: 400,
            boxShadow: 4
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Focus Mode Settings</Typography>
            <IconButton size="small" onClick={() => setShowSettings(false)}>
              ×
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.dimBackground}
                  onChange={(e) => setPreferences(prev => ({...prev, dimBackground: e.target.checked}))}
                  size="small"
                />
              }
              label="Dim background"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.hideNonEssential}
                  onChange={(e) => setPreferences(prev => ({...prev, hideNonEssential: e.target.checked}))}
                  size="small"
                />
              }
              label="Hide non-essential elements"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.showKeyboardHints}
                  onChange={(e) => setPreferences(prev => ({...prev, showKeyboardHints: e.target.checked}))}
                  size="small"
                />
              }
              label="Show keyboard hints"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.focusTimer}
                  onChange={(e) => setPreferences(prev => ({...prev, focusTimer: e.target.checked}))}
                  size="small"
                />
              }
              label="Focus timer"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.highContrast}
                  onChange={(e) => setPreferences(prev => ({...prev, highContrast: e.target.checked}))}
                  size="small"
                />
              }
              label="High contrast mode"
            />

            <Divider sx={{ my: 1 }} />

            <Button
              variant="outlined"
              size="small"
              startIcon={preferences.fullscreen ? <FullscreenExit /> : <Fullscreen />}
              onClick={toggleFullscreen}
            >
              {preferences.fullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            </Button>

            {preferences.focusTimer && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Timer sx={{ fontSize: '1rem' }} />
                <Typography variant="body2">
                  Session: {formatTime(sessionTime)}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Keyboard Shortcuts Panel */}
      {isActive && preferences.showKeyboardHints && (
        <Paper
          sx={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            p: 2,
            boxShadow: 4
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Keyboard Shortcuts
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, fontSize: '0.875rem' }}>
            <Box>
              <strong>Ctrl+F:</strong> Toggle Focus Mode
            </Box>
            <Box>
              <strong>Ctrl+H:</strong> Settings
            </Box>
            <Box>
              <strong>Ctrl+K:</strong> Keyboard Hints
            </Box>
          </Box>
        </Paper>
      )}

      {/* Focus Mode Overlay */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          bgcolor: isActive && preferences.dimBackground
            ? 'rgba(0, 0, 0, 0.7)'
            : 'transparent',
          zIndex: isActive ? 1200 : -1,
          pointerEvents: 'none',
          transition: 'all 0.3s ease'
        }}
      />

      {/* Content Wrapper */}
      <Box
        sx={{
          filter: isActive && preferences.highContrast
            ? 'contrast(1.5) brightness(1.1)'
            : 'none',
          transition: 'filter 0.3s ease'
        }}
      >
        {children}
      </Box>
    </>
  );
};

export default FocusMode;

