import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  PlayArrow,
  Science,
  Edit,
  Quiz,
  History
} from '@mui/icons-material';

// Import services
import ParticipantService from '../services/participantService';
import axios from 'axios';
import api from '../services/api';

// Import components
import CompletedEvaluationsDialog from '../components/CompletedEvaluationsDialog';

// Import utilities
import { calculateCompletedTasks, isTaskComplete, hasTaskData } from '../utils/taskUtils';

// Import styles
import '../styles/globals.css';
import '../styles/components.css';

const ParticipantStudyDetails = () => {
  const { id } = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const participantId = searchParams.get('participantId');
  const navigate = useNavigate();
  const [study, setStudy] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksWithDetails, setTasksWithDetails] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draftEvaluation, setDraftEvaluation] = useState(null);
  const [completedEvaluationsDialogOpen, setCompletedEvaluationsDialogOpen] = useState(false);

  useEffect(() => {
    loadStudyDetails();
  }, [id]);

  useEffect(() => {
    // Load draft evaluation after tasks with details are loaded
    if (id && tasksWithDetails.length > 0) {
      loadDraftEvaluation();
    }
  }, [id, tasksWithDetails]);

  const loadDraftEvaluation = async () => {
    try {
      const draft = await ParticipantService.getDraftEvaluation(id);
      if (draft && draft.task_answers && Object.keys(draft.task_answers).length > 0) {
        setDraftEvaluation(draft);
        
        // Recalculate completed tasks based on draft data
        if (tasksWithDetails.length > 0) {
          const completedCount = calculateCompletedTasks(tasksWithDetails, draft.task_answers);
          setStudy(prev => prev ? { ...prev, completedTasks: completedCount } : prev);
        }
      } else {
        setDraftEvaluation(null);
      }
    } catch (error) {
      // No draft exists - that's okay
      setDraftEvaluation(null);
    }
  };

  const handleContinueDraft = () => {
    // Navigate to tasks page with draft data
    navigate(`/participant/studies/${id}/tasks`);
  };

  const loadStudyDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const now = new Date();

      // Fetch study details, tasks, and quizzes in parallel
      const apiParams = participantId ? { participantId } : {};
      console.log('[ParticipantStudyDetails] Loading study', id, 'with params:', apiParams);

      const [studyData, tasksResult, quizzesResponse] = await Promise.all([
        ParticipantService.getStudyDetails(id, apiParams),
        ParticipantService.getStudyTasks(id, apiParams).catch((err) => {
          // Handle 403 error gracefully - quiz access blocked
          if (err.response?.status === 403) {
            console.log('[ParticipantStudyDetails] Tasks blocked - quiz required:', err.response?.data);
            return { blocked: true, quiz_access: err.response?.data?.quiz_access };
          }
          throw err;
        }),
        axios.get(`/api/studies/${id}/quizzes`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { quizzes: [] } }))
      ]);

      // Check if deadline has passed - block access to evaluation
      const deadlineDate = studyData.deadline ? new Date(studyData.deadline) : null;
      const isPastDeadline = deadlineDate ? deadlineDate < now : false;
      
      if (isPastDeadline) {
        console.log('[ParticipantStudyDetails] Study deadline has passed - blocking access');
        setError('This study\'s deadline has passed. You can no longer evaluate it. Please check the completed studies section.');
        setLoading(false);
        return;
      }

      // Check if study is inactive (completed, cancelled, archived)
      const inactiveStatus = ['completed', 'cancelled', 'archived'].includes((studyData.status || '').toLowerCase());
      if (inactiveStatus) {
        console.log('[ParticipantStudyDetails] Study is inactive - blocking access');
        setError(`This study is ${studyData.status}. You can no longer evaluate it.`);
        setLoading(false);
        return;
      }

      // Handle blocked tasks (quiz required)
      const tasksData = tasksResult?.blocked ? [] : (Array.isArray(tasksResult) ? tasksResult : []);
      const tasksBlocked = tasksResult?.blocked || false;

      console.log('[ParticipantStudyDetails] Study data loaded:', studyData);
      console.log('[ParticipantStudyDetails] Tasks data loaded:', tasksData, 'blocked:', tasksBlocked);

      // Fetch user's badges and attempt status for each quiz
      const userBadgesResponse = await axios.get('/api/badges/my-badges', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => ({ data: { badges: [] } }));
      
      const userBadgeIds = (userBadgesResponse.data.badges || []).map(b => b.badge_id);

      const quizzesWithStatus = await Promise.all(
        (quizzesResponse.data.quizzes || []).map(async (quiz) => {
          try {
            const attemptResponse = await axios.get(`/api/quizzes/${quiz.id}/attempt`, {
              headers: { Authorization: `Bearer ${token}` },
              params: { studyId: id }
            });
            
            // Fetch badge details for this quiz
            const [requiredBadgesRes, awardedBadgesRes] = await Promise.all([
              axios.get(`/api/quizzes/${quiz.id}/required-badges`, {
                headers: { Authorization: `Bearer ${token}` }
              }).catch(() => ({ data: { badges: [] } })),
              axios.get(`/api/quizzes/${quiz.id}/awarded-badges`, {
                headers: { Authorization: `Bearer ${token}` }
              }).catch(() => ({ data: { badges: [] } }))
            ]);

            return {
              ...quiz,
              attempt: attemptResponse.data.attempt,
              requiredBadges: requiredBadgesRes.data.badges || [],
              awardedBadges: awardedBadgesRes.data.badges || [],
              userHasRequiredBadges: (requiredBadgesRes.data.badges || []).every(b => userBadgeIds.includes(b.id))
            };
          } catch {
            return { ...quiz, attempt: null, requiredBadges: [], awardedBadges: [], userHasRequiredBadges: false };
          }
        })
      );

      // Transform study data
      let status = studyData.status || 'upcoming';
      if (status === 'ongoing') status = 'active';
      if (status === 'past') status = 'completed';

      setStudy({
        id: studyData.id,
        title: studyData.title,
        description: studyData.description,
        status: status,
        deadline: studyData.deadline,
        start_date: studyData.start_date,
        end_date: studyData.end_date,
        completedTasks: studyData.completed_tasks || 0,
        totalTasks: studyData.total_tasks || 0,
        quiz_access: studyData.quiz_access,
        tasksBlocked: tasksBlocked
      });

      // Transform tasks
      const transformedTasks = tasksData.map(task => ({
        id: task.id,
        title: task.task_type ? task.task_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Evaluation Task',
        description: task.instructions || 'Complete this evaluation task',
        status: task.status || 'pending',
        time_spent_seconds: task.time_spent_seconds || 0,
        started_at: task.started_at
      }));

      setTasks(transformedTasks);

      // Fetch full task details for completion calculation
      const fullTaskDetails = await Promise.all(
        tasksData.map(async (task) => {
          try {
            const params = participantId ? { participantId } : {};
            const response = await api.get(`/participant/tasks/${task.id}`, { params });
            return { ...task, ...response.data };
          } catch {
            return task;
          }
        })
      );
      setTasksWithDetails(fullTaskDetails);

      // Set quizzes with attempt status
      setQuizzes(quizzesWithStatus);
    } catch (error) {
      console.error('Failed to load study details:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      setError('Failed to load study details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'warning';
      case 'pending':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/participant/studies')}
          sx={{ mb: 2 }}
        >
          Back to Studies
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!study) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/participant/studies')}
          sx={{ mb: 2 }}
        >
          Back to Studies
        </Button>
        <Alert severity="warning">Study not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Back Button */}
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/participant/studies')}
        sx={{ mb: 3 }}
      >
        Back to Studies
      </Button>

      {/* Study Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          {study.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {study.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <Chip
            label={study.status === 'active' ? 'Active' : study.status === 'completed' ? 'Completed' : study.status === 'upcoming' ? 'Upcoming' : study.status}
            color={study.status === 'active' ? 'success' : study.status === 'completed' ? 'default' : 'info'}
            size="small"
          />
          <Typography variant="body2" color="text.secondary">
            {study.completedTasks} / {study.totalTasks} tasks completed
          </Typography>
          {study.deadline && (
            <Typography variant="body2" color="text.secondary">
              Deadline: {new Date(study.deadline).toLocaleDateString()}
            </Typography>
          )}
        </Box>
        {study.totalTasks > 0 && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={(study.completedTasks / study.totalTasks) * 100}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        )}
      </Box>

      {/* Quiz Requirement Section */}
      {study.quiz_access && study.quiz_access.requiresQuiz && !study.quiz_access.canAccess && (
        <Card 
          sx={{ 
            mb: 4, 
            background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
            border: '2px solid #f44336',
            borderRadius: 3,
            boxShadow: '0 4px 12px rgba(244, 67, 54, 0.2)'
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box
                sx={{
                  bgcolor: 'error.main',
                  borderRadius: '50%',
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 48,
                  height: 48
                }}
              >
                <Quiz sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700,
                      color: 'error.dark',
                      mb: 0.5
                    }}
                  >
                    Quiz Required
                  </Typography>
                  <Chip 
                    label="Access Blocked" 
                    color="error"
                    size="small"
                    sx={{ 
                      fontWeight: 600
                    }}
                  />
                </Box>
                {study.quiz_access.quizzes && study.quiz_access.quizzes.length > 0 ? (
                  <>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'text.secondary',
                        mb: 2,
                        lineHeight: 1.6
                      }}
                    >
                      You must pass <strong>{study.quiz_access.totalQuizzes || study.quiz_access.quizzes.length} required quiz{study.quiz_access.totalQuizzes !== 1 ? 'zes' : ''}</strong> to access study questions.
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      {study.quiz_access.quizzes.map((quizStatus, index) => (
                        <Box key={quizStatus.quiz.id} sx={{ mb: 1.5, p: 1.5, bgcolor: 'rgba(255,255,255,0.5)', borderRadius: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {quizStatus.quiz.title}
                            </Typography>
                            <Chip 
                              label={
                                quizStatus.status === 'passed' || quizStatus.status === 'passed_badge' ? 'Passed ✓' :
                                quizStatus.status === 'pending_grading' ? 'Pending ⏳' :
                                quizStatus.status === 'failed' ? 'Failed ✗' :
                                'Not Taken'
                              }
                              color={
                                quizStatus.status === 'passed' || quizStatus.status === 'passed_badge' ? 'success' :
                                quizStatus.status === 'pending_grading' ? 'warning' :
                                quizStatus.status === 'failed' ? 'error' :
                                'default'
                              }
                              size="small"
                            />
                          </Box>
                          {quizStatus.attempt && (
                            <Typography variant="caption" color="text.secondary">
                              {quizStatus.attempt.grading_status === 'pending_grading' && (
                                <>Submitted: {new Date(quizStatus.attempt.submitted_at).toLocaleString()}</>
                              )}
                              {quizStatus.attempt.passed === false && (
                                <>Score: {quizStatus.attempt.score}% - Failed</>
                              )}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                    {study.quiz_access.quizzes.some(q => q.status === 'not_attempted') && (
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<Quiz />}
                        onClick={() => {
                          const notAttempted = study.quiz_access.quizzes.find(q => q.status === 'not_attempted');
                          if (notAttempted && notAttempted.quiz) {
                            navigate(`/quiz/take/${notAttempted.quiz.id}?studyId=${id}`);
                          }
                        }}
                        sx={{
                          fontWeight: 600,
                          px: 3,
                          py: 1,
                          borderRadius: 2,
                          textTransform: 'none',
                          boxShadow: '0 2px 8px rgba(244, 67, 54, 0.4)',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(244, 67, 54, 0.5)'
                          }
                        }}
                      >
                        Take Required Quiz{study.quiz_access.notAttemptedQuizzes > 1 ? 'zes' : ''} Now
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'text.secondary',
                        mb: 1,
                        lineHeight: 1.6
                      }}
                    >
                      {study.quiz_access.badge && (
                        <>You need the <strong>{study.quiz_access.badge.name}</strong> badge to access study questions. </>
                      )}
                      {study.quiz_access.reason === 'Quiz not attempted' && (
                        <>Take the <strong>{study.quiz_access.quiz?.title}</strong> quiz to earn the required badge.</>
                      )}
                      {study.quiz_access.reason === 'Quiz attempt is pending grading' && (
                        <>Your quiz attempt is pending manual grading. You'll be able to access the study once grading is complete.</>
                      )}
                      {study.quiz_access.reason === 'Quiz not passed - no retakes allowed' && (
                        <>You did not pass the required quiz. Please contact the study administrator for assistance.</>
                      )}
                    </Typography>
                    {study.quiz_access.attempt && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'text.secondary',
                          mb: 2.5,
                          fontStyle: 'italic'
                        }}
                      >
                        {study.quiz_access.attempt.grading_status === 'pending_grading' && (
                          <>Submitted: {new Date(study.quiz_access.attempt.submitted_at).toLocaleString()}</>
                        )}
                        {study.quiz_access.attempt.passed === false && (
                          <>Score: {study.quiz_access.attempt.score}% - Failed</>
                        )}
                      </Typography>
                    )}
                    {study.quiz_access.reason === 'Quiz not attempted' && study.quiz_access.quiz && (
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<Quiz />}
                        onClick={() => navigate(`/quiz/take/${study.quiz_access.quiz.id}?studyId=${id}`)}
                        sx={{
                          fontWeight: 600,
                          px: 3,
                          py: 1,
                          borderRadius: 2,
                          textTransform: 'none',
                          boxShadow: '0 2px 8px rgba(244, 67, 54, 0.4)',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(244, 67, 54, 0.5)'
                          }
                        }}
                      >
                        Take Quiz Now
                      </Button>
                    )}
                  </>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Badge Earned Section */}
      {study.quiz_access && study.quiz_access.hasBadge && (
        <Card 
          sx={{ 
            mb: 4, 
            background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
            border: '2px solid #4caf50',
            borderRadius: 3,
            boxShadow: '0 4px 12px rgba(76, 175, 80, 0.2)'
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CheckCircle sx={{ color: 'success.main', fontSize: 40 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.dark' }}>
                  Badge Earned: {study.quiz_access.badge.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You have access to all study questions
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Draft Evaluation Section */}
      {draftEvaluation && study.quiz_access && study.quiz_access.canAccess && (
        <Card 
          sx={{ 
            mb: 4, 
            background: 'linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%)',
            border: '2px solid #ffc107',
            borderRadius: 3,
            boxShadow: '0 4px 12px rgba(255, 193, 7, 0.2)'
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box
                sx={{
                  bgcolor: 'warning.main',
                  borderRadius: '50%',
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 48,
                  height: 48
                }}
              >
                <Edit sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700,
                      color: 'warning.dark',
                      mb: 0.5
                    }}
                  >
                    Draft Evaluation Available
                  </Typography>
                  <Chip 
                    label="In Progress" 
                    color="warning"
                    size="small"
                    sx={{ 
                      fontWeight: 600,
                      bgcolor: 'warning.main',
                      color: 'white'
                    }}
                  />
                </Box>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'text.secondary',
                    mb: 2.5,
                    lineHeight: 1.6
                  }}
                >
                  You have a draft evaluation with saved answers. Continue where you left off.
                </Typography>
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<Edit />}
                  onClick={handleContinueDraft}
                  sx={{
                    bgcolor: 'warning.main',
                    color: 'white',
                    fontWeight: 600,
                    px: 3,
                    py: 1,
                    borderRadius: 2,
                    textTransform: 'none',
                    boxShadow: '0 2px 8px rgba(255, 193, 7, 0.4)',
                    '&:hover': {
                      bgcolor: 'warning.dark',
                      boxShadow: '0 4px 12px rgba(255, 193, 7, 0.5)'
                    }
                  }}
                >
                  Continue Draft
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
      {/* Quizzes Section */}
      {quizzes.length > 0 && (
        <Box sx={{ mb: 5 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
            Competency Quizzes
          </Typography>
          <Grid container spacing={3}>
            {quizzes.map((quiz) => (
              <Grid item xs={12} md={6} key={quiz.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Quiz color="primary" />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {quiz.title}
                        </Typography>
                      </Box>
                      {quiz.attempt ? (
                        quiz.attempt.grading_status === 'pending_grading' ? (
                          <Chip label="Pending Grading ⏳" color="warning" size="small" />
                        ) : (
                          <Chip 
                            label={quiz.attempt.passed ? 'Passed ✓' : 'Failed ✗'} 
                            color={quiz.attempt.passed ? 'success' : 'error'} 
                            size="small" 
                          />
                        )
                      ) : (
                        <Chip label="Not Taken" color="default" size="small" />
                      )}
                    </Box>
                    {quiz.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {quiz.description}
                      </Typography>
                    )}
                    {quiz.passing_score && (
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Passing score: {quiz.passing_score}%
                      </Typography>
                    )}
                    {quiz.attempt && (
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                        {quiz.attempt.grading_status === 'pending_grading' 
                          ? `Submitted: ${new Date(quiz.attempt.submitted_at).toLocaleDateString()} • Waiting for manual grading`
                          : `Your score: ${quiz.attempt.score}% • Submitted: ${new Date(quiz.attempt.submitted_at).toLocaleDateString()}`
                        }
                      </Typography>
                    )}

                    {/* Badge Requirements */}
                    {quiz.requiredBadges && quiz.requiredBadges.length > 0 && (
                      <Box sx={{ mb: 2, p: 1, bgcolor: 'info.light', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                          🔒 Required Badges:
                        </Typography>
                        {quiz.requiredBadges.map((badge) => (
                          <Chip
                            key={badge.id}
                            label={badge.name}
                            size="small"
                            color={quiz.userHasRequiredBadges ? 'success' : 'default'}
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                        {quiz.userHasRequiredBadges && (
                          <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                            ✓ You can skip this quiz
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Badge Awards */}
                    {quiz.awardedBadges && quiz.awardedBadges.length > 0 && (
                      <Box sx={{ mb: 2, p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                          🏆 Awards:
                        </Typography>
                        {quiz.awardedBadges.map((badge) => (
                          <Chip
                            key={badge.id}
                            label={badge.name}
                            size="small"
                            color="warning"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    )}

                    <Button
                      variant={quiz.attempt ? 'outlined' : 'contained'}
                      startIcon={quiz.attempt ? <CheckCircle /> : <PlayArrow />}
                      fullWidth
                      onClick={() => navigate(`/quiz/take/${quiz.id}?studyId=${id}`)}
                      disabled={!!quiz.attempt}
                    >
                      {quiz.attempt ? 'Already Completed' : 'Take Quiz'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Tasks Section */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Evaluation Tasks
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {study.completedTasks > 0 && (
              <Button
                variant="outlined"
                startIcon={<History />}
                onClick={() => setCompletedEvaluationsDialogOpen(true)}
                color="success"
              >
                Completed Evaluations
              </Button>
            )}
            {tasks.length > 0 && (
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={() => navigate(`/participant/studies/${id}/tasks`)}
                disabled={study.quiz_access && !study.quiz_access.canAccess}
              >
                {study.quiz_access && !study.quiz_access.canAccess ? 'Quiz Required' : 'View All Tasks'}
              </Button>
            )}
          </Box>
        </Box>

        {tasks.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              {study.tasksBlocked || (study.quiz_access && !study.quiz_access.canAccess) ? (
                <>
                  <Quiz sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Quiz Required
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Please complete the competency quiz above before accessing the evaluation tasks.
                  </Typography>
                  {quizzes.length > 0 && !quizzes[0].attempt && (
                    <Button
                      variant="contained"
                      color="warning"
                      startIcon={<PlayArrow />}
                      onClick={() => navigate(`/quiz/take/${quizzes[0].id}?studyId=${id}`)}
                    >
                      Take Quiz Now
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Science sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Tasks Available
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This study doesn't have any evaluation tasks yet.
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {tasks.map((task) => {
              // Get full task details (with answer_type, answer_options) for status calculation
              const fullTask = tasksWithDetails.find(t => t.id === task.id) || task;
              
              // Use same logic as ParticipantStudyTasks.js
              const isFinalCompleted = task.status === 'completed'; // Task completed after final submission
              const taskData = draftEvaluation?.task_answers?.[task.id] || draftEvaluation?.task_answers?.[task.id.toString()] || {};
              const isComplete = isTaskComplete(fullTask, taskData); // Check if all required fields are filled
              const hasData = hasTaskData(taskData); // Check if task has any data (highlights, screenshots, comments, etc.)

              // Determine status label and color
              // Pending: no data at all
              // In Progress: has data (highlights, screenshots, comments, ratings, etc.) but not fully completed
              // Completed: task is fully submitted (final submission) OR has all required fields filled
              let statusLabel = 'Pending';
              let statusColor = 'default';
              let actualStatus = 'pending';
              if (isFinalCompleted) {
                statusLabel = 'Completed';
                statusColor = 'success';
                actualStatus = 'completed';
              } else if (isComplete) {
                statusLabel = 'Completed';
                statusColor = 'success';
                actualStatus = 'completed';
              } else if (hasData || task.status === 'in_progress') {
                statusLabel = 'In Progress';
                statusColor = 'warning';
                actualStatus = 'in_progress';
              } else {
                statusLabel = 'Pending';
                statusColor = 'default';
                actualStatus = 'pending';
              }

              return (
                <Grid item xs={12} md={6} key={task.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {task.title}
                        </Typography>
                        <Chip
                          label={statusLabel}
                          color={statusColor}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {task.description}
                      </Typography>
                      {actualStatus === 'in_progress' && task.time_spent_seconds > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                          Time spent: {Math.floor(task.time_spent_seconds / 60)} minutes
                        </Typography>
                      )}
                      <Button
                        variant={actualStatus === 'completed' ? 'outlined' : 'contained'}
                        startIcon={actualStatus === 'completed' ? <CheckCircle /> : <PlayArrow />}
                        fullWidth
                        onClick={() => navigate(`/participant/studies/${id}/tasks`)}
                        disabled={actualStatus === 'completed' || (study.quiz_access && !study.quiz_access.canAccess)}
                      >
                        {actualStatus === 'completed' ? 'Completed' : (study.quiz_access && !study.quiz_access.canAccess ? 'Quiz Required' : actualStatus === 'in_progress' ? 'Continue Task' : 'View All Tasks')}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* Completed Evaluations Dialog */}
      <CompletedEvaluationsDialog
        open={completedEvaluationsDialogOpen}
        onClose={() => setCompletedEvaluationsDialogOpen(false)}
        studyId={id}
        studyTitle={study?.title}
      />
    </Box>
  );
};

export default ParticipantStudyDetails;


