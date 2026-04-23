import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { ArrowBack, Quiz } from '@mui/icons-material';
import QuizResultsPanel from '../components/dashboard/QuizResultsPanel';
import { getStatusColor } from '../utils';

export default function ResearcherQuizResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudy = async () => {
      try {
        const response = await fetch(`/api/studies/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Study not found');
          }
          throw new Error(`Failed to fetch study: ${response.statusText}`);
        }
        
        const data = await response.json();
        setStudy(data.study || data);
      } catch (err) {
        console.error('Error fetching study:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudy();
  }, [id]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  if (!study) {
    return (
      <Box p={3}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Study not found.
        </Alert>
        <Button variant="contained" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box mb={4}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/researcher/studies/${id}`)}
          sx={{ mb: 2 }}
        >
          Back to Study Details
        </Button>
        
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Quiz color="primary" sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
              Quiz Results
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {study?.title || `Study #${id}`}
            </Typography>
            {study?.status && (
              <Chip
                label={study.status}
                size="small"
                color={getStatusColor(study.status)}
                variant="outlined"
                sx={{ textTransform: 'capitalize', mt: 0.5 }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Quiz Results Panel */}
      <QuizResultsPanel studyId={id} />
    </Box>
  );
}
