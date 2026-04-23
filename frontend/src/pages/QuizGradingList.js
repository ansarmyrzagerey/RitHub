import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { ArrowBack, RateReview } from '@mui/icons-material';
import axios from 'axios';

const QuizGradingList = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const [quizResponse, attemptsResponse] = await Promise.all([
        axios.get(`/api/quizzes/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`/api/quizzes/${id}/pending-attempts`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setQuiz(quizResponse.data.quiz);
      setAttempts(attemptsResponse.data.attempts || []);
    } catch (error) {
      console.error('Failed to load grading data:', error);
      setError('Failed to load grading data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !quiz) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/quizzes')} sx={{ mb: 2 }}>
          Back to Quizzes
        </Button>
        <Alert severity="error">{error || 'Quiz not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/quizzes')} sx={{ mb: 3 }}>
        Back to Quizzes
      </Button>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Grade Quiz: {quiz.title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Review and grade participant submissions
        </Typography>
      </Box>

      {attempts.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <RateReview sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Pending Submissions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              All submissions have been graded or there are no submissions yet.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Participant</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Auto-graded Score</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell>{attempt.participant_name}</TableCell>
                  <TableCell>{attempt.participant_email}</TableCell>
                  <TableCell>{new Date(attempt.submitted_at).toLocaleString()}</TableCell>
                  <TableCell>{attempt.score ? `${Math.round(attempt.score)}%` : 'N/A'}</TableCell>
                  <TableCell>
                    <Chip label="Pending Grading" color="warning" size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<RateReview />}
                      onClick={() => navigate(`/quizzes/${id}/grade/${attempt.id}`)}
                    >
                      Grade
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default QuizGradingList;
