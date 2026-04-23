import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Alert,
  Link
} from '@mui/material';
import {
  Email,
  ArrowBack,
  Send
} from '@mui/icons-material';

import { ROUTES } from '../constants';
import AuthTransition from '../components/auth/AuthTransition';
import { authService } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await authService.forgotPassword(email);
      
      if (response.success) {
        setMessage(response.message);
        setEmailSent(true);
      } else {
        setError(response.message || 'Failed to send reset email');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err?.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate(ROUTES.LOGIN);
  };

  return (
    <AuthTransition>
      <Container 
        component="main" 
        maxWidth="sm"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Card
          elevation={8}
          sx={{
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Header */}
            <Box textAlign="center" mb={3}>
              <Typography 
                variant="h4" 
                component="h1" 
                gutterBottom
                sx={{ 
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Reset Password
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {emailSent 
                  ? 'Check your email for reset instructions'
                  : 'Enter your email address and we\'ll send you a temporary password'
                }
              </Typography>
            </Box>

            {/* Success Message */}
            {message && (
              <Alert severity="success" sx={{ mb: 3 }}>
                {message}
              </Alert>
            )}

            {/* Error Message */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {!emailSent ? (
              /* Reset Form */
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  margin="normal"
                  required
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    },
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  endIcon={<Send />}
                  disabled={isLoading}
                  sx={{
                    mt: 3,
                    mb: 2,
                    py: 1.5,
                    background: 'linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #0d7a5f 0%, #1a7f64 100%)',
                      transform: 'translateY(-1px)',
                    },
                    '&:disabled': {
                      background: '#d1d5db',
                      transform: 'none',
                    },
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Email'}
                </Button>
              </Box>
            ) : (
              /* Success State */
              <Box textAlign="center">
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  If an account with that email exists, you should receive a temporary password shortly.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  The temporary password will expire in 24 hours and you'll be required to change it after logging in.
                </Typography>
              </Box>
            )}

            {/* Back to Login */}
            <Box textAlign="center" mt={3}>
              <Link
                component="button"
                variant="body2"
                onClick={handleBackToLogin}
                sx={{
                  color: 'primary.main',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                  cursor: 'pointer',
                }}
              >
                <ArrowBack fontSize="small" />
                Back to Login
              </Link>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </AuthTransition>
  );
};

export default ForgotPassword;