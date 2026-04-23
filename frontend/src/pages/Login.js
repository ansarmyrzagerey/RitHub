import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import { Block, Close } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

// Import atomic components
import { LoginHeader, LoginForm, LoginFooter } from '../components';
import AuthTransition from '../components/auth/AuthTransition';
import useAuthTransition from '../hooks/useAuthTransition';
import { useAuth } from '../hooks/useAuth';

// Import constants and utilities
import { ROUTES } from '../constants';
import { isValidEmail, validatePassword } from '../utils';

// Import styles
import '../styles/globals.css';
import '../styles/components.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [suspensionDialog, setSuspensionDialog] = useState({ open: false, suspendedUntil: null });
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isParticipant, isResearcher, isReviewer, loading, user } = useAuth();
  const { navigateToSignUp } = useAuthTransition();
  const hasRedirected = useRef(false);
  const locationRef = useRef(location);

  // Keep location ref updated
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // Redirect if already authenticated - only run when auth state changes
  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (loading) return;
    
    const currentPath = locationRef.current.pathname;
    

    // Only redirect if authenticated, we're on login/home page, and haven't redirected yet
    if (isAuthenticated && (currentPath === ROUTES.LOGIN || currentPath === ROUTES.HOME) && !hasRedirected.current) {
      hasRedirected.current = true;
      
      // Check if there's a saved location from a protected route
      const from = locationRef.current.state?.from?.pathname;
      
      // Determine target path
      let targetPath;
      if (from && from !== ROUTES.LOGIN && from !== ROUTES.SIGNUP && from !== ROUTES.HOME) {
        targetPath = from;
      } else if (isParticipant) {
        targetPath = ROUTES.PARTICIPANT_DASHBOARD;
      } else if (isResearcher) {
        targetPath = ROUTES.DASHBOARD;
      } else if (isReviewer) {
        targetPath = ROUTES.REVIEWER_DASHBOARD;
      } else if (user?.role === 'admin') {
        targetPath = '/admin';
      } else {
        targetPath = ROUTES.PROFILE; // Default fallback
      }
      
      // Navigate to target only if different from current path
      if (targetPath && targetPath !== currentPath) {
        navigate(targetPath, { replace: true });
      }
    }
    
    // Reset redirect flag if user becomes unauthenticated
    if (!isAuthenticated) {
      hasRedirected.current = false;
    }
  }, [isAuthenticated, isParticipant, isResearcher, isReviewer, user, loading, navigate]);

  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email or username is required';
    // Accept either a valid email or a username (alphanumeric + underscore, 3-20 chars)
    else if (!isValidEmail(formData.email) && !/^[a-zA-Z0-9_]{3,20}$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email or username (3-20 chars)';
    }
    if (!formData.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (valuesOrEvent) => {
    // If called as an event handler (LoginForm passes the event), prevent default and use local formData
    let payload = formData;
    if (valuesOrEvent && typeof valuesOrEvent.preventDefault === 'function') {
      valuesOrEvent.preventDefault();
    } else if (valuesOrEvent && typeof valuesOrEvent === 'object' && valuesOrEvent.email) {
      // Called with a values object
      payload = valuesOrEvent;
    }

    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const result = await login(payload.email, payload.password);
      if (result.success) {
        // Don't navigate here - let the useEffect handle it after state updates
        // This ensures the user state is properly set before navigation
        setIsLoading(false);
      } else {
        setErrors({ general: result.error || 'Invalid credentials' });
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Login error', err);
      
      // Check if this is a suspension error
      if (err?.response?.data?.code === 'ACCOUNT_SUSPENDED' || err?.response?.status === 403) {
        const suspendedUntil = err?.response?.data?.suspended_until;
        setSuspensionDialog({ open: true, suspendedUntil });
        setIsLoading(false);
        return;
      }
      
      const message = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Login failed. Please try again.';
      setErrors({ general: message });
      setIsLoading(false);
    }
  };

  const formatSuspensionDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  return (
    <AuthTransition isSignUp={false}>
      <Container maxWidth="sm">
        <Card
          sx={{
            maxWidth: 480,
            mx: 'auto',
            borderRadius: 3,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(255,255,255,0.95)'
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <LoginHeader />
            <LoginForm
              onSubmit={handleSubmit}
              isLoading={isLoading}
              errors={errors}
              onInputChange={handleInputChange}
              formData={formData}
              onNavigateToSignUp={navigateToSignUp}
            />
          </CardContent>
        </Card>

        <LoginFooter />
      </Container>

      {/* Suspension Dialog */}
      <Dialog
        open={suspensionDialog.open}
        onClose={() => setSuspensionDialog({ open: false, suspendedUntil: null })}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          pb: 2,
          borderBottom: '1px solid rgba(0,0,0,0.1)'
        }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'error.light',
              color: 'error.contrastText'
            }}
          >
            <Block sx={{ fontSize: 28 }} />
          </Box>
          <Typography variant="h6" component="div" sx={{ flex: 1 }}>
            Account Suspended
          </Typography>
          <Button
            onClick={() => setSuspensionDialog({ open: false, suspendedUntil: null })}
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <Close />
          </Button>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
            Your account has been temporarily suspended and you cannot sign in at this time.
          </Typography>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'grey.200'
            }}
          >
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
              Suspension expires on:
            </Typography>
            <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
              {formatSuspensionDate(suspensionDialog.suspendedUntil)}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary', fontStyle: 'italic' }}>
            If you believe this is an error, please contact the administrator.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => setSuspensionDialog({ open: false, suspendedUntil: null })}
            variant="contained"
            color="primary"
            fullWidth
          >
            Understood
          </Button>
        </DialogActions>
      </Dialog>
    </AuthTransition>
  );
};

export default Login;