import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Quiz,
  CheckCircle,
  PlayArrow,
  Science,
  Delete
} from '@mui/icons-material';
import axios from 'axios';

// Import services
import ParticipantService from '../services/participantService';
import studyService from '../services/studyService';

// Import styles
import '../styles/globals.css';
import '../styles/components.css';

const ParticipantQuizzes = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch all studies the participant is enrolled in
      const studies = await ParticipantService.getAssignedStudies();

      console.log('All enrolled studies:', studies.map(s => ({ id: s.id, title: s.title, status: s.status })));

      // Include all enrolled studies - participants should be able to see and retake quizzes
      // from completed studies as well
      const enrolledStudies = studies;

      console.log('Studies for quiz display:', enrolledStudies.map(s => ({ id: s.id, title: s.title, status: s.status })));

      // Fetch quizzes for each enrolled study
      const allQuizzes = [];

      for (const study of enrolledStudies) {
        try {
          const quizzesResponse = await studyService.getStudyQuizzes(study.id);
          const studyQuizzes = quizzesResponse.quizzes || [];

          console.log(`Study ${study.id} (${study.title}): Found ${studyQuizzes.length} quizzes, ${studyQuizzes.filter(q => q.is_published).length} published`);

          // For each quiz, check if it's published and get attempt status for THIS study
          for (const quiz of studyQuizzes) {
            if (quiz.is_published) {
              try {
                // Get quiz attempt status for this specific study
                const attemptResponse = await axios.get(`/api/quizzes/${quiz.id}/attempt?studyId=${study.id}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });

                const attempt = attemptResponse.data.attempt;

                allQuizzes.push({
                  ...quiz,
                  studyId: study.id,
                  studyTitle: study.title,
                  attempt: attempt,
                  status: attempt ? (attempt.passed ? 'completed' : attempt.grading_status === 'pending_grading' ? 'pending' : 'failed') : 'available',
                  score: attempt?.score || null,
                  completedAt: attempt?.submitted_at || null
                });
              } catch (error) {
                // If no attempt found, quiz is available
                allQuizzes.push({
                  ...quiz,
                  studyId: study.id,
                  studyTitle: study.title,
                  attempt: null,
                  status: 'available',
                  score: null,
                  completedAt: null
                });
              }
            }
          }
        } catch (error) {
          console.error(`Failed to load quizzes for study ${study.id}:`, error);
        }
      }

      setQuizzes(allQuizzes);
    } catch (error) {
      console.error('Failed to load quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = (quiz) => {
    // Navigate to the TakeQuiz page with studyId
    navigate(`/quiz/take/${quiz.id}?studyId=${quiz.studyId}`);
  };

  const handleViewResults = (quiz) => {
    // Navigate to the TakeQuiz page to view results with studyId
    navigate(`/quiz/take/${quiz.id}?studyId=${quiz.studyId}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Quizzes
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Take quizzes from the studies you are enrolled in to demonstrate your knowledge
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Delete />}
          onClick={() => navigate('/participant/quizzes/trash')}
          sx={{ ml: 2 }}
        >
          Quiz Trash Bin
        </Button>
      </Box>

      {/* Quizzes List */}
      {quizzes.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Quiz sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
              No Quizzes Available
            </Typography>
            <Typography variant="body1" color="text.secondary">
              There are no quizzes available from your enrolled studies at this time.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {quizzes.map((quiz) => (
            <Grid item xs={12} md={6} key={quiz.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Science fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {quiz.studyTitle}
                        </Typography>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {quiz.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {quiz.description || 'No description available'}
                      </Typography>
                    </Box>
                    <Chip
                      label={
                        quiz.status === 'completed'
                          ? 'Completed'
                          : quiz.status === 'pending'
                            ? 'Pending Grading'
                            : quiz.status === 'failed'
                              ? 'Failed'
                              : 'Available'
                      }
                      color={
                        quiz.status === 'completed'
                          ? 'success'
                          : quiz.status === 'pending'
                            ? 'warning'
                            : quiz.status === 'failed'
                              ? 'error'
                              : 'primary'
                      }
                      size="small"
                    />
                  </Box>

                  {quiz.status === 'completed' && quiz.score !== null && (
                    <Box sx={{ mb: 2 }}>
                      <Alert severity="success" icon={<CheckCircle />}>
                        <Typography variant="body2">
                          <strong>Score:</strong> {quiz.score}%
                        </Typography>
                        {quiz.completedAt && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            Completed on {new Date(quiz.completedAt).toLocaleDateString()}
                          </Typography>
                        )}
                      </Alert>
                    </Box>
                  )}

                  {quiz.status === 'pending' && (
                    <Box sx={{ mb: 2 }}>
                      <Alert severity="warning">
                        <Typography variant="body2">
                          Your quiz submission is pending manual grading.
                        </Typography>
                        {quiz.completedAt && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            Submitted on {new Date(quiz.completedAt).toLocaleDateString()}
                          </Typography>
                        )}
                      </Alert>
                    </Box>
                  )}

                  {quiz.status === 'failed' && quiz.score !== null && (
                    <Box sx={{ mb: 2 }}>
                      <Alert severity="error">
                        <Typography variant="body2">
                          <strong>Score:</strong> {quiz.score}%
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          You did not pass this quiz.
                        </Typography>
                      </Alert>
                    </Box>
                  )}

                  <Button
                    variant={quiz.status === 'completed' ? 'outlined' : 'contained'}
                    startIcon={quiz.status === 'completed' ? <CheckCircle /> : <PlayArrow />}
                    fullWidth
                    onClick={() => quiz.status === 'completed' ? handleViewResults(quiz) : handleStartQuiz(quiz)}
                  >
                    {quiz.status === 'completed'
                      ? 'View Results'
                      : quiz.status === 'pending'
                        ? 'View Status'
                        : quiz.status === 'failed'
                          ? 'View Details'
                          : 'Start Quiz'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default ParticipantQuizzes;

