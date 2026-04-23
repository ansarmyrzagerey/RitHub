import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Science,
  Schedule,
  People,
  CheckCircle,
  Error as ErrorIcon,
  Login as LoginIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

const EnrollmentPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    setLoading(true);
    setError(null);
    try {
      // Call public endpoint to validate token and get study info
      const response = await axios.get(`/api/studies/enrollment/${token}`);
      
      if (response.data.success) {
        setStudy(response.data.study);
      } else {
        setError(response.data.message || 'Invalid enrollment link');
      }
    } catch (err) {
      console.error('Error validating enrollment token:', err);
      setError(
        err.response?.data?.message || 
        'This enrollment link is invalid, expired, or the study is no longer active.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/enroll/${token}`);
      return;
    }

    setEnrolling(true);
    setError(null);
    try {
      const response = await axios.post(
        `/api/studies/enrollment/${token}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        setEnrollmentSuccess(true);
      }
    } catch (err) {
      console.error('Error enrolling in study:', err);
      setError(
        err.response?.data?.message || 
        'Failed to enroll in study. Please try again.'
      );
    } finally {
      setEnrolling(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeadlineText = () => {
    if (!study?.deadline) return null;
    
    const deadline = new Date(study.deadline);
    const now = new Date();
    const diff = deadline - now;
    
    if (diff < 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days ${hours} hours remaining`;
    if (hours > 0) return `${hours} hours remaining`;
    return 'Less than 1 hour remaining';
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 8 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary">
            Validating enrollment link...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error && !study) {
    return (
      <Container maxWidth="md" sx={{ mt: 8 }}>
        <Paper sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <ErrorIcon color="error" sx={{ fontSize: 64 }} />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Invalid Enrollment Link
            </Typography>
            <Alert severity="error" sx={{ width: '100%' }}>
              {error}
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
              This link may have expired, the study may no longer be active, or the link may be invalid.
              Please contact the study administrator for assistance.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/participant/dashboard')}
              sx={{ mt: 2 }}
            >
              Go to Dashboard
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  if (enrollmentSuccess) {
    return (
      <Container maxWidth="md" sx={{ mt: 8 }}>
        <Paper sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CheckCircle color="success" sx={{ fontSize: 64 }} />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Successfully Enrolled!
            </Typography>
            <Alert severity="success" sx={{ width: '100%' }}>
              You have been successfully enrolled in "{study.title}".
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
              You will receive notifications about this study and can begin participating once the study is active.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                onClick={() => navigate('/participant/dashboard')}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/participant/studies')}
              >
                View My Studies
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Science sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Study Enrollment
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You've been invited to participate in a research study
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Study Information */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
            {study.title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {study.description}
          </Typography>

          {/* Study Details */}
          <List>
            {study.deadline && (
              <ListItem>
                <ListItemIcon>
                  <Schedule color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Study Deadline"
                  secondary={
                    <>
                      {formatDate(study.deadline)}
                      <Chip 
                        label={getDeadlineText()} 
                        size="small" 
                        color="primary" 
                        sx={{ ml: 1 }}
                      />
                    </>
                  }
                />
              </ListItem>
            )}

            {study.participant_capacity && (
              <ListItem>
                <ListItemIcon>
                  <People color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Participant Capacity"
                  secondary={
                    <>
                      {study.enrolled_count || 0} / {study.participant_capacity} enrolled
                      {!study.has_capacity && (
                        <Chip 
                          label="Full" 
                          size="small" 
                          color="error" 
                          sx={{ ml: 1 }}
                        />
                      )}
                    </>
                  }
                />
              </ListItem>
            )}
          </List>
        </Box>

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Enrollment Actions */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!isAuthenticated ? (
            <>
              <Alert severity="info">
                You must be logged in to enroll in this study.
              </Alert>
              <Button
                variant="contained"
                size="large"
                startIcon={<LoginIcon />}
                onClick={handleEnroll}
                fullWidth
              >
                Login to Enroll
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Don't have an account?{' '}
                <Button
                  variant="text"
                  size="small"
                  onClick={() => navigate(`/signup?redirect=/enroll/${token}`)}
                >
                  Sign up here
                </Button>
              </Typography>
            </>
          ) : !study.has_capacity ? (
            <>
              <Alert severity="warning">
                This study has reached its maximum participant capacity and is no longer accepting enrollments.
              </Alert>
              <Button
                variant="outlined"
                onClick={() => navigate('/participant/dashboard')}
                fullWidth
              >
                Go to Dashboard
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                size="large"
                startIcon={enrolling ? <CircularProgress size={20} /> : <CheckCircle />}
                onClick={handleEnroll}
                disabled={enrolling}
                fullWidth
              >
                {enrolling ? 'Enrolling...' : 'Enroll in Study'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/participant/dashboard')}
                fullWidth
              >
                Cancel
              </Button>
            </>
          )}
        </Box>

        {/* Additional Information */}
        <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            By enrolling in this study, you agree to participate in the research activities as described.
            You can withdraw from the study at any time. Your participation is voluntary and confidential.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default EnrollmentPage;
