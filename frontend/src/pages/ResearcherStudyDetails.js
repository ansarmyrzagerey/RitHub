import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Avatar,
  Chip,
  Button,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  ArrowBack,
  Science,
  People,
  TrendingUp,
  Assessment,
  Analytics as AnalyticsIcon,
  GetApp,
  CalendarToday,
  CheckCircle,
  Schedule,
  PlayArrow,
  Quiz,
  Flag,
  FlagOutlined,
  Visibility
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import researcherService from '../services/researcherService';
import ReviewerService from '../services/reviewerService';
import { useAuth } from '../hooks/useAuth';
import ExportDialog from '../components/dashboard/ExportDialog';
import CompletedEvaluationsDialog from '../components/CompletedEvaluationsDialog';
import { getStatusColor } from '../utils';

export default function ResearcherStudyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isReviewer, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [study, setStudy] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [status, setStatus] = useState(null);
  const [taskAnalytics, setTaskAnalytics] = useState({ tasks: [] });
  const [evaluations, setEvaluations] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [reflaggedEvaluations, setReflaggedEvaluations] = useState(new Set());

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        // Fetch study info, analytics, participant status, evaluations, and quizzes
        // Reviewers now have read access to researcher endpoints
        const [studies, studyDetail, analyticsData, statusData, taskAnalyticsData, evaluationsData, quizzesData] = await Promise.all([
          researcherService.listStudies(),
          fetch(`/api/studies/${id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }).then(res => {
            if (!res.ok) {
              if (res.status === 404) {
                throw new Error('Study not found');
              }
              throw new Error(`Failed to fetch study: ${res.statusText}`);
            }
            return res.json();
          }).then(data => data.study || data),
          researcherService.getAnalytics(id).catch(() => ({ funnel: { zero: 0, lt50: 0, gte50lt100: 0, complete: 0 }, ratingCounts: {}, avgAnnotation: 0 })),
          researcherService.getParticipantsStatus(id).catch(() => ({ enrolled: 0, inProgress: 0, done: 0 })),
          researcherService.getTaskAnalytics(id).catch(() => ({ tasks: [] })),
          researcherService.getEvaluations(id).catch(() => ({ evaluations: [] })),
          fetch(`/api/studies/${id}/quizzes`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }).then(res => res.json()).catch(() => ({ success: false, quizzes: [] }))
        ]);
        
        if (!mounted) return;
        
        // Try to find study in list first, otherwise use the direct fetch
        const studyData = studies.find(s => s.id === parseInt(id, 10)) || studyDetail;
        
        if (!studyData) {
          throw new Error('Study not found');
        }
        
        setStudy(studyData);
        setAnalytics(analyticsData);
        setStatus(statusData);
        setTaskAnalytics(taskAnalyticsData || { tasks: [] });
        setEvaluations(evaluationsData.evaluations || []);
        setQuizzes(quizzesData.success ? quizzesData.quizzes : []);
      } catch (err) {
        console.error('Study details error:', err);
        if (mounted) {
          setError(err.message || 'Failed to load study details');
          setAnalytics({ funnel: { zero: 0, lt50: 0, gte50lt100: 0, complete: 0 }, ratingCounts: {}, avgAnnotation: 0 });
          setStatus({ enrolled: 0, inProgress: 0, done: 0 });
          setQuizzes([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchData();
    return () => { mounted = false; };
  }, [id]);

  const handleFlagToggle = async (evaluationId, currentFlagged) => {
    try {
      if (isReviewer) {
        // Reviewer flow: if currently flagged -> unflag; else reflag (notify admin)
        if (currentFlagged) {
          await ReviewerService.unflagEvaluation(evaluationId);
        } else {
          await ReviewerService.flagEvaluation(evaluationId);
          setReflaggedEvaluations(prev => new Set(prev).add(evaluationId));
        }
      } else {
        // Researcher toggle
        await researcherService.flagEvaluation(evaluationId, !currentFlagged);
      }
      // Refetch evaluations to get updated state
      const evaluationsData = await researcherService.getEvaluations(id);
      setEvaluations(evaluationsData.evaluations || []);
    } catch (err) {
      console.error('Failed to update flag status:', err);
    }
  };

  const handleViewEvaluation = (evaluation) => {
    // Transform researcher evaluation data to participant format for the dialog
    const transformedData = evaluation.tasks.map(task => ({
      task_id: task.taskId,
      task_type: task.taskType,
      instructions: task.instructions,
      answer_type: task.answerType,
      answer_options: task.answerOptions,
      artifact1: task.artifact1,
      artifact2: task.artifact2,
      artifact3: task.artifact3,
      evaluation: {
        ratings: task.ratings,
        choice: task.choice,
        text: task.text,
        annotations: task.annotations,
        comments: task.comments,
        completed_at: evaluation.completedAt
      }
    }));
    
    setSelectedEvaluation(transformedData);
  };

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

  if (!analytics || !status) {
    return (
      <Box p={3}>
        <Typography variant="h6" color="error">
          No analytics available for this study.
        </Typography>
      </Box>
    );
  }

  // Prepare rating distribution data

  const ratings = Object.keys(analytics.ratingCounts || {})
    .map(k => ({ rating: `Rating ${k}`, count: analytics.ratingCounts[k] }))
    .sort((a, b) => parseInt(a.rating.split(' ')[1]) - parseInt(b.rating.split(' ')[1]));

  // Derive waiting participants: enrolled minus those started or completed
  const waiting = Math.max(0, (status?.enrolled || 0) - ((status?.inProgress || 0) + (status?.done || 0)));

  // Participant status for pie chart: Waiting, In Progress, Completed
  const participantStatusData = [
    { name: 'Waiting', value: waiting, color: '#9e9e9e' },
    { name: 'In Progress', value: status.inProgress, color: '#f59e0b' },
    { name: 'Completed', value: status.done, color: '#10a37f' }
  ].filter(item => item.value > 0);

  // Total participants equals enrolled; completion rate = completed / enrolled
  const totalParticipants = status.enrolled;
  const completionRate = totalParticipants > 0 
    ? Math.round((status.done / totalParticipants) * 100) 
    : 0;

  // Prepare completion funnel data
  const funnelData = [
    { name: '0%', value: analytics?.funnel?.zero || 0, color: '#ef4444' },
    { name: '<50%', value: analytics?.funnel?.lt50 || 0, color: '#f59e0b' },
    { name: '50-100%', value: analytics?.funnel?.gte50lt100 || 0, color: '#3b82f6' },
    { name: '100%', value: analytics?.funnel?.complete || 0, color: '#10a37f' }
  ].filter(item => item.value > 0);

  const getStatusIcon = (status) => {
    const statusMap = {
      active: PlayArrow,
      completed: CheckCircle,
      draft: Schedule,
      pending: Schedule,
      in_progress: PlayArrow
    };
    return statusMap[status] || Science;
  };

  const StatusIcon = study ? getStatusIcon(study.status) : Science;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/dashboard')}
            sx={{ mb: 2 }}
          >
            Back to Dashboard
          </Button>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <Avatar sx={{ backgroundColor: '#10a37f', width: 56, height: 56 }}>
              <StatusIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                {study?.title || `Study #${id}`}
              </Typography>
              {study?.status && (
                <Chip
                  label={study.status}
                  size="small"
                  color={getStatusColor(study.status)}
                  variant="outlined"
                  sx={{ textTransform: 'capitalize' }}
                />
              )}
            </Box>
          </Box>
          {study?.description && (
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 800, mt: 1 }}>
              {study.description}
            </Typography>
          )}
          {(study?.start_date || study?.end_date) && (
            <Box display="flex" gap={3} mt={2}>
              {study.start_date && (
                <Box display="flex" alignItems="center" gap={1}>
                  <CalendarToday fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Start: {new Date(study.start_date).toLocaleDateString()}
                  </Typography>
                </Box>
              )}
              {study.end_date && (
                <Box display="flex" alignItems="center" gap={1}>
                  <CalendarToday fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    End: {new Date(study.end_date).toLocaleDateString()}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          {quizzes.length > 0 && (
            <Box mt={2}>
              <Card sx={{ 
                backgroundColor: 'primary.50', 
                border: '1px solid',
                borderColor: 'primary.200',
                boxShadow: 'none'
              }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Quiz color="primary" fontSize="small" />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        Assigned Quiz: {quizzes[0].title}
                      </Typography>
                      {quizzes[0].description && (
                        <Typography variant="caption" color="text.secondary">
                          {quizzes[0].description}
                        </Typography>
                      )}
                      <Box display="flex" gap={1} mt={0.5}>
                        {quizzes[0].is_published && (
                          <Chip label="Published" size="small" color="success" variant="outlined" sx={{ height: 20 }} />
                        )}
                        {quizzes[0].is_skippable && (
                          <Chip label="Skippable" size="small" variant="outlined" sx={{ height: 20 }} />
                        )}
                        {quizzes[0].passing_score && (
                          <Chip label={`Pass: ${quizzes[0].passing_score}%`} size="small" variant="outlined" sx={{ height: 20 }} />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<GetApp />}
          onClick={() => setExportOpen(true)}
          sx={{
            background: 'linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #0d7a5f 0%, #1a7f64 100%)',
            },
          }}
        >
          Export Data
        </Button>
      </Box>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'all 0.2s ease-in-out', '&:hover': { boxShadow: 4 } }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Avatar sx={{ backgroundColor: '#6366f1', width: 48, height: 48 }}>
                  <People />
                </Avatar>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                {totalParticipants}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Participants
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'all 0.2s ease-in-out', '&:hover': { boxShadow: 4 } }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Avatar sx={{ backgroundColor: '#f59e0b', width: 48, height: 48 }}>
                  <PlayArrow />
                </Avatar>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                {status.inProgress}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                In Progress
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'all 0.2s ease-in-out', '&:hover': { boxShadow: 4 } }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Avatar sx={{ backgroundColor: '#10a37f', width: 48, height: 48 }}>
                  <CheckCircle />
                </Avatar>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                {status.done}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'all 0.2s ease-in-out', '&:hover': { boxShadow: 4 } }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Avatar sx={{ backgroundColor: '#ef4444', width: 48, height: 48 }}>
                  <TrendingUp />
                </Avatar>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                {completionRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completion Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Completion Funnel removed per requirements */}

        {/* Participant Status Pie Chart */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <People color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Participant Status
                </Typography>
              </Box>
              {participantStatusData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={participantStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {participantStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
                  <Typography variant="body2" color="text.secondary">
                    No participant data available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Progress Overview */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <TrendingUp color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Progress Overview
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Box mb={2}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Enrolled Participants
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {status.enrolled}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                      value={totalParticipants > 0 ? (status.enrolled / totalParticipants) * 100 : 0}
                    sx={{ height: 8, borderRadius: 4, backgroundColor: 'grey.200' }}
                  />
                </Box>
                <Box mb={2}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      In Progress
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {status.inProgress}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                      value={totalParticipants > 0 ? (status.inProgress / totalParticipants) * 100 : 0}
                    sx={{ height: 8, borderRadius: 4, backgroundColor: 'grey.200' }}
                    color="warning"
                  />
                </Box>
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" color="text.secondary">
                        Waiting
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {waiting}
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={totalParticipants > 0 ? (waiting / totalParticipants) * 100 : 0}
                      sx={{ height: 8, borderRadius: 4, backgroundColor: 'grey.200' }}
                      color="inherit"
                    />
                  </Box>
                  <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {status.done}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                      value={totalParticipants > 0 ? (status.done / totalParticipants) * 100 : 0}
                    sx={{ height: 8, borderRadius: 4, backgroundColor: 'grey.200' }}
                    color="success"
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Rating Distribution */}
        {ratings.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <Assessment color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Rating Distribution
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratings}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="rating" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e0e0e0',
                        borderRadius: 4
                      }} 
                    />
                    <Bar dataKey="count" fill="#10a37f" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Task Analytics */}
      {taskAnalytics && taskAnalytics.tasks && taskAnalytics.tasks.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Task Analytics
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Detailed metrics for each evaluation task
              </Typography>
              <Grid container spacing={2}>
                {taskAnalytics.tasks.map((task, index) => (
                  <Grid item xs={12} md={6} key={task.taskId || index}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                          {task.taskName || `Task ${index + 1}`}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                          <Chip label={task.taskType} size="small" color="primary" variant="outlined" />
                          {task.answerType && (
                            <Chip label={task.answerType} size="small" color="default" variant="outlined" />
                          )}
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2" color="text.secondary">
                              Completed By
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {task.completedBy} {task.completedBy === 1 ? 'participant' : 'participants'}
                            </Typography>
                          </Box>
                        </Box>

                        {task.avgAnnotations !== null && (
                          <Box sx={{ mb: 2 }}>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                              <Typography variant="body2" color="text.secondary">
                                Avg Annotations
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {Number.isFinite(task.avgAnnotations) ? task.avgAnnotations.toFixed(1) : '0.0'}
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {/* Show avg rating only for rating-based questions */}
                        {(task.answerType === 'rating' || task.answerType === 'rating_required_comments') && task.avgRating !== null && (
                          <Box sx={{ mb: 2 }}>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                              <Typography variant="body2" color="text.secondary">
                                Avg Rating
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {Number.isFinite(task.avgRating) ? task.avgRating.toFixed(1) : 'N/A'}
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {task.choicePercentages && Object.keys(task.choicePercentages).length > 0 && (
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              Choice Distribution
                            </Typography>
                            {Object.entries(task.choicePercentages).map(([choice, percentage]) => (
                              <Box key={choice} sx={{ mb: 1 }}>
                                <Box display="flex" justifyContent="space-between" mb={0.5}>
                                  <Typography variant="body2">
                                    {choice}
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {Number.isFinite(percentage) ? percentage.toFixed(1) : '0.0'}%
                                  </Typography>
                                </Box>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={Number.isFinite(percentage) ? percentage : 0}
                                  sx={{ height: 6, borderRadius: 3, backgroundColor: 'grey.200' }}
                                />
                              </Box>
                            ))}
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Evaluation List */}
      {evaluations && evaluations.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Evaluation List
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Browse all participant evaluations
              </Typography>
              <Grid container spacing={2}>
                {evaluations.map((evaluation) => (
                  <Grid item xs={12} sm={6} md={4} key={evaluation.evaluationId}>
                    <Card 
                      variant="outlined"
                      sx={{ 
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { 
                          boxShadow: 3,
                          borderColor: 'primary.main'
                        }
                      }}
                    >
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Evaluation #{evaluation.evaluationNumber}
                          </Typography>
                          {!isAdmin && (
                            isReviewer ? (
                              // Reviewer: only show buttons for flagged evaluations
                              evaluation.flagged && (
                                <Box display="flex" gap={1}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFlagToggle(evaluation.evaluationId, true);
                                    }}
                                    startIcon={<Flag />}
                                  >
                                    Unflag
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="warning"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFlagToggle(evaluation.evaluationId, false);
                                    }}
                                    startIcon={reflaggedEvaluations.has(evaluation.evaluationId) ? <Flag style={{ color: '#ff9800' }} /> : <FlagOutlined style={{ color: '#ff9800' }} />}
                                  >
                                    Reflag
                                  </Button>
                                </Box>
                              )
                            ) : (
                              <Button
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFlagToggle(evaluation.evaluationId, evaluation.flagged);
                                }}
                                sx={{ minWidth: 'auto', p: 0.5 }}
                              >
                                {evaluation.flagged ? (
                                  <Flag color="error" />
                                ) : (
                                  <FlagOutlined color="action" />
                                )}
                              </Button>
                            )
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Completed: {new Date(evaluation.completedAt).toLocaleDateString()}
                        </Typography>
                        <Button
                          variant="contained"
                          fullWidth
                          startIcon={<Visibility />}
                          onClick={() => handleViewEvaluation(evaluation)}
                          sx={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                            },
                          }}
                        >
                          View Details
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Completed Evaluations Dialog */}
      <CompletedEvaluationsDialog
        open={Boolean(selectedEvaluation)}
        onClose={() => setSelectedEvaluation(null)}
        studyTitle={study?.title || 'Study'}
        evaluationData={selectedEvaluation}
      />

      {/* Export Dialog */}
      <ExportDialog 
        open={exportOpen} 
        onClose={() => setExportOpen(false)} 
        studies={study ? [study] : []}
      />
    </Box>
  );
}
