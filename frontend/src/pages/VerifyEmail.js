import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Card, 
  CardContent, 
  Typography, 
  Alert, 
  CircularProgress, 
  Button,
  Box
} from '@mui/material';
import { CheckCircle, Error } from '@mui/icons-material';
import api from '../services/api';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        return;
      }

      try {
        console.log('Attempting to verify email with token:', token.substring(0, 8) + '...');
        const response = await api.get(`/auth/verify?token=${token}`);
        
        console.log('Verification response:', response.data);
        
        if (response.data.success) {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Email verification failed.');
        }
      } catch (error) {
        console.error('Email verification error:', error);
        console.error('Error response:', error.response?.data);
        
        const errorData = error.response?.data;
        const errorCode = errorData?.code;
        
        if (errorCode === 'ALREADY_USED') {
          // Special handling for already used tokens
          setStatus('success');
          setMessage('Your email has already been verified! You can now access all features.');
        } else {
          setStatus('error');
          setMessage(
            errorData?.message || 
            'Email verification failed. The link may be invalid or expired.'
          );
        }
      }
    };

    verifyEmail();
  }, [searchParams]);

  const handleGoToProfile = () => {
    navigate('/profile');
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ mb: 3 }}>
            Email Verification
          </Typography>

          {status === 'verifying' && (
            <Box>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography>Verifying your email...</Typography>
            </Box>
          )}

          {status === 'success' && (
            <Box>
              <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
              <Alert severity="success" sx={{ mb: 3 }}>
                {message}
              </Alert>
              <Button 
                variant="contained" 
                onClick={handleGoToProfile}
                sx={{ mr: 2 }}
              >
                Go to Profile
              </Button>
              <Button 
                variant="outlined" 
                onClick={handleGoToLogin}
              >
                Go to Login
              </Button>
            </Box>
          )}

          {status === 'error' && (
            <Box>
              <Error color="error" sx={{ fontSize: 64, mb: 2 }} />
              <Alert severity="error" sx={{ mb: 3 }}>
                {message}
              </Alert>
              <Button 
                variant="outlined" 
                onClick={handleGoToLogin}
              >
                Go to Login
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default VerifyEmail;