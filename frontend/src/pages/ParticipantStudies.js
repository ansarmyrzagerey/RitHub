import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Rating,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  InputAdornment
} from '@mui/material';
import {
  Science,
  Assignment,
  CheckCircle,
  PlayArrow,
  Search,
  Visibility,
  Edit,
  History,
  Quiz,
  Delete,
  FolderSpecial
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Import services
import ParticipantService from '../services/participantService';
import api from '../services/api';

// Import components
import CompletedEvaluationsDialog from '../components/CompletedEvaluationsDialog';

// Import utilities
import { calculateCompletedTasks, isTaskComplete, hasTaskData } from '../utils/taskUtils';

// Import styles
import '../styles/globals.css';
import '../styles/components.css';

const ParticipantStudies = () => {
  const navigate = useNavigate();
  const [studies, setStudies] = useState([]);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [evaluationDialogOpen, setEvaluationDialogOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [evaluationData, setEvaluationData] = useState({
    rating: 0,
    comparison: '',
    comments: '',
    annotations: {}
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStudies, setFilteredStudies] = useState([]);
  const [draftEvaluations, setDraftEvaluations] = useState({});
  const [completedEvaluationsDialogOpen, setCompletedEvaluationsDialogOpen] = useState(false);
  const [selectedStudyForEvaluations, setSelectedStudyForEvaluations] = useState(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const processedStudyIdsRef = useRef(new Set());

  useEffect(() => {
    loadStudies();
  }, []);

  useEffect(() => {
    // Load draft evaluations for all studies
    // Only load if we have studies and haven't processed them yet
    if (studies.length > 0 && !loadingDrafts) {
      const currentStudyIds = new Set(studies.map(s => s.id));
      const processedIds = processedStudyIdsRef.current;
      
      // Check if we have new studies that haven't been processed
      const hasNewStudies = Array.from(currentStudyIds).some(id => !processedIds.has(id));
      
      if (hasNewStudies) {
        loadDraftEvaluations();
      }
    }
  }, [studies, loadingDrafts]);

  useEffect(() => {
    // Filter studies based on search query
    if (!searchQuery.trim()) {
      setFilteredStudies(studies);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = studies.filter(study => 
        (study.title || '').toLowerCase().includes(query) ||
        (study.description || '').toLowerCase().includes(query) ||
        (study.status || '').toLowerCase().includes(query)
      );
      setFilteredStudies(filtered);
    }
  }, [searchQuery, studies]);

  const loadDraftEvaluations = async () => {
    if (loadingDrafts) return; // Prevent concurrent calls
    
    try {
      setLoadingDrafts(true);
      const drafts = {};
      const updatedStudies = [...studies];
      let hasChanges = false;
      
      await Promise.all(
        studies.map(async (study, index) => {
          try {
            const draft = await ParticipantService.getDraftEvaluation(study.id);
            if (draft && draft.task_answers && Object.keys(draft.task_answers).length > 0) {
              drafts[study.id] = draft;
              
              // Fetch full task details to calculate completion properly
              try {
                const tasksWithDetails = await Promise.all(
                  study.tasks.map(async (task) => {
                    try {
                      const response = await api.get(`/participant/tasks/${task.id}`);
                      return { ...task, ...response.data };
                    } catch {
                      return task;
                    }
                  })
                );
                
                // Calculate completed tasks based on draft data
                const completedCount = calculateCompletedTasks(tasksWithDetails, draft.task_answers);
                
                // Only update if completedTasks actually changed
                if (updatedStudies[index].completedTasks !== completedCount) {
                  updatedStudies[index] = {
                    ...updatedStudies[index],
                    completedTasks: completedCount,
                    tasksWithDetails // Store for later use
                  };
                  hasChanges = true;
                } else if (!updatedStudies[index].tasksWithDetails) {
                  // Store tasksWithDetails even if completedTasks didn't change
                  updatedStudies[index] = {
                    ...updatedStudies[index],
                    tasksWithDetails
                  };
                  hasChanges = true;
                }
              } catch (err) {
                console.log(`Could not fetch task details for study ${study.id}`);
              }
            } else if (study.tasks && study.tasks.length > 0 && !updatedStudies[index].tasksWithDetails) {
              // Fetch task details for studies without drafts to ensure proper status display
              try {
                const tasksWithDetails = await Promise.all(
                  study.tasks.map(async (task) => {
                    try {
                      const response = await api.get(`/participant/tasks/${task.id}`);
                      return { ...task, ...response.data };
                    } catch {
                      return task;
                    }
                  })
                );
                
                updatedStudies[index] = {
                  ...updatedStudies[index],
                  tasksWithDetails
                };
                hasChanges = true;
              } catch (err) {
                console.log(`Could not fetch task details for study ${study.id}`);
              }
            }
            
            // Mark this study as processed
            processedStudyIdsRef.current.add(study.id);
          } catch (error) {
            // Draft doesn't exist or error - that's okay
            console.log(`No draft for study ${study.id}`);
            // Still mark as processed to avoid retrying
            processedStudyIdsRef.current.add(study.id);
          }
        })
      );
      
      setDraftEvaluations(drafts);
      
      // Only update studies if there were actual changes to prevent infinite loop
      if (hasChanges) {
        setStudies(updatedStudies);
      }
    } catch (error) {
      console.error('Failed to load draft evaluations:', error);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const loadStudies = async () => {
    try {
      setLoading(true);
      setError(null);
      const now = new Date();
      
      // Fetch studies from backend
      const studiesData = await ParticipantService.getAssignedStudies();
      
      // Ensure we have an array
      const studiesArray = Array.isArray(studiesData) ? studiesData : [];
      
      console.log('ParticipantStudies - Raw API response:', studiesData);
      console.log('ParticipantStudies - Fetched studies data:', studiesArray);
      console.log('ParticipantStudies - Number of studies:', studiesArray.length);
      
      // Fetch tasks and quiz access for each study
      const studiesWithTasks = await Promise.all(
        studiesArray.map(async (study) => {
          try {
            console.log(`[ParticipantStudies] Loading tasks for study ${study.id}: ${study.title}`);
            const [tasksData, studyDetails] = await Promise.all([
              ParticipantService.getStudyTasks(study.id),
              ParticipantService.getStudyDetails(study.id).catch(() => null)
            ]);
            console.log(`[ParticipantStudies] Study ${study.id} - Tasks loaded:`, tasksData?.length || 0, 'quiz_access:', studyDetails?.quiz_access);
            
            // Transform backend data to match component expectations
            let status = study.status || 'upcoming';
            if (status === 'ongoing') status = 'active';
            if (status === 'past') status = 'completed';
            
            // Transform tasks
            const tasks = tasksData.map(task => ({
              id: task.id,
              title: task.task_type ? task.task_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Evaluation Task',
              description: task.instructions || 'Complete this evaluation task',
              status: task.status || 'pending'
            }));
            
            // Override status to completed if all tasks are done
            const completedTasks = study.completed_tasks || 0;
            const totalTasks = study.total_tasks || 0;
            if (totalTasks > 0 && completedTasks >= totalTasks) {
              status = 'completed';
            }
            
            const deadlineDate = study.deadline ? new Date(study.deadline) : null;
            const isPastDeadline = deadlineDate ? deadlineDate < now : false;
            
            return {
              id: study.id,
              title: study.title,
              description: study.description,
              status: status,
              deadline: study.deadline,
              deadlineDate,
              isPastDeadline,
              completedTasks: completedTasks,
              totalTasks: totalTasks,
              tasks: tasks,
              quiz_access: studyDetails?.quiz_access || null
            };
          } catch (taskError) {
            console.error(`Failed to load tasks for study ${study.id}:`, taskError);
            // Return study without tasks if task fetch fails
            let status = study.status || 'upcoming';
            if (status === 'ongoing') status = 'active';
            if (status === 'past') status = 'completed';
            
            // Try to get quiz access even if tasks fail (403 error means quiz required)
            let quizAccess = null;
            
            // Check if the error response contains quiz_access info
            if (taskError.response?.status === 403 && taskError.response?.data?.quiz_access) {
              quizAccess = taskError.response.data.quiz_access;
              console.log(`Study ${study.id} - Quiz access from 403 error:`, quizAccess);
            } else {
              // Try to get quiz access from study details
              try {
                const studyDetails = await ParticipantService.getStudyDetails(study.id);
                quizAccess = studyDetails?.quiz_access || null;
                console.log(`Study ${study.id} - Quiz access from study details:`, quizAccess);
              } catch (e) {
                console.log(`Study ${study.id} - Could not get quiz access:`, e.message);
              }
            }
            
            // Override status to completed if all tasks are done
            const completedTasks = study.completed_tasks || 0;
            const totalTasks = study.total_tasks || 0;
            if (totalTasks > 0 && completedTasks >= totalTasks) {
              status = 'completed';
            }
            
            const deadlineDate = study.end_date ? new Date(study.end_date) : null;
            const isPastDeadline = deadlineDate ? deadlineDate < now : false;
            
            return {
              id: study.id,
              title: study.title,
              description: study.description,
              status: status,
              deadline: study.end_date,
              deadlineDate,
              isPastDeadline,
              completedTasks: study.completed_tasks || 0,
              totalTasks: study.total_tasks || 0,
              tasks: [],
              quiz_access: quizAccess
            };
          }
        })
      );
      
      // Filter to only show active studies (exclude past-deadline, completed, cancelled, archived)
      const activeStudies = studiesWithTasks.filter(s => {
        const isCompleted = s.totalTasks > 0 && s.completedTasks >= s.totalTasks;
        const inactiveStatus = ['completed', 'cancelled', 'archived'].includes((s.status || '').toLowerCase());
        const pastDeadline = s.isPastDeadline || false;
        return !isCompleted && !inactiveStatus && !pastDeadline;
      });
      
      setStudies(activeStudies);
      // Reset processed study IDs when loading new studies
      processedStudyIdsRef.current.clear();
    } catch (error) {
      console.error('Failed to load studies:', error);
      setError('Failed to load studies. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAll = (study) => {
    // Navigate to study detail page
    navigate(`/participant/studies/${study.id}`);
  };

  const handleStartEvaluation = async (study, task) => {
    // Check quiz access first
    if (study.quiz_access && study.quiz_access.requiresQuiz && !study.quiz_access.canAccess) {
      // Handle multiple quizzes
      if (study.quiz_access.quizzes && study.quiz_access.quizzes.length > 0) {
        const notAttempted = study.quiz_access.quizzes.find(q => q.status === 'not_attempted');
        const pending = study.quiz_access.quizzes.find(q => q.status === 'pending_grading');
        const failed = study.quiz_access.quizzes.find(q => q.status === 'failed');
        
        const quizToTake = notAttempted || pending || failed;
        
        if (notAttempted && quizToTake.quiz) {
          navigate(`/quiz/take/${quizToTake.quiz.id}?studyId=${study.id}`);
          return;
        }
        
        if (pending) {
          setError(`You have ${study.quiz_access.pendingQuizzes || 1} quiz attempt(s) pending manual grading. You will be able to access the study once grading is complete.`);
          return;
        }
        
        if (failed) {
          const failedCount = study.quiz_access.failedQuizzes || 1;
          const totalCount = study.quiz_access.totalQuizzes || 1;
          setError(`You must pass all required quizzes to access study tasks. ${failedCount} of ${totalCount} quiz(zes) failed. Please contact the study administrator for assistance.`);
          return;
        }
      } else if (study.quiz_access.quiz) {
        // Single quiz (backward compatibility)
        if (study.quiz_access.reason === 'Quiz not attempted' && study.quiz_access.quiz) {
          navigate(`/quiz/take/${study.quiz_access.quiz.id}?studyId=${study.id}`);
          return;
        }
        if (study.quiz_access.reason === 'Quiz not passed - no retakes allowed') {
          setError('You must pass the required quiz to access study tasks. Please contact the study administrator for assistance.');
          return;
        }
        if (study.quiz_access.reason === 'Quiz attempt is pending grading') {
          setError('Your quiz attempt is pending manual grading. You will be able to access the study once grading is complete.');
          return;
        }
      }
    }
    
    try {
      // Start the task via backend API
      await ParticipantService.startTask(task.id);
      
      // Navigate to the tasks page (all tasks on one page)
      navigate(`/participant/studies/${study.id}/tasks`);
    } catch (error) {
      console.error('Failed to start task:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to start task';
      setError(`Failed to start evaluation: ${errorMessage}. Please try again.`);
      // Don't navigate on error - let user see the error message
    }
  };

  const handleContinueDraft = (study) => {
    // Check quiz access first
    if (study.quiz_access && study.quiz_access.requiresQuiz && !study.quiz_access.canAccess) {
      // Handle multiple quizzes
      if (study.quiz_access.quizzes && study.quiz_access.quizzes.length > 0) {
        const notAttempted = study.quiz_access.quizzes.find(q => q.status === 'not_attempted');
        const pending = study.quiz_access.quizzes.find(q => q.status === 'pending_grading');
        const failed = study.quiz_access.quizzes.find(q => q.status === 'failed');
        
        const quizToTake = notAttempted || pending || failed;
        
        if (notAttempted && quizToTake.quiz) {
          navigate(`/quiz/take/${quizToTake.quiz.id}?studyId=${study.id}`);
          return;
        }
        
        if (pending) {
          setError(`You have ${study.quiz_access.pendingQuizzes || 1} quiz attempt(s) pending manual grading. You will be able to access the study once grading is complete.`);
          return;
        }
        
        if (failed) {
          const failedCount = study.quiz_access.failedQuizzes || 1;
          const totalCount = study.quiz_access.totalQuizzes || 1;
          setError(`You must pass all required quizzes to access study tasks. ${failedCount} of ${totalCount} quiz(zes) failed. Please contact the study administrator for assistance.`);
          return;
        }
      } else if (study.quiz_access.quiz) {
        // Single quiz (backward compatibility)
        if (study.quiz_access.reason === 'Quiz not attempted' && study.quiz_access.quiz) {
          navigate(`/quiz/take/${study.quiz_access.quiz.id}?studyId=${study.id}`);
          return;
        }
        if (study.quiz_access.reason === 'Quiz not passed - no retakes allowed') {
          setError('You must pass the required quiz to access study tasks. Please contact the study administrator for assistance.');
          return;
        }
        if (study.quiz_access.reason === 'Quiz attempt is pending grading') {
          setError('Your quiz attempt is pending manual grading. You will be able to access the study once grading is complete.');
          return;
        }
      }
    }
    
    // Navigate to tasks page with draft data
    navigate(`/participant/studies/${study.id}/tasks`);
  };

  const handleViewCompletedEvaluations = (study) => {
    setSelectedStudyForEvaluations(study);
    setCompletedEvaluationsDialogOpen(true);
  };

  const handleSubmitEvaluation = async () => {
    try {
      setSubmitting(true);
      // TODO: Replace with actual API call when evaluation submission endpoint is available
      // await ParticipantService.submitEvaluation(currentTask.id, evaluationData);
      
      // For now, navigate to the tasks page where evaluation can be submitted
      if (selectedStudy && currentTask) {
        navigate(`/participant/studies/${selectedStudy.id}/tasks`);
      } else {
        // Fallback: simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update local state
        const updatedStudies = studies.map(study => {
          if (study.id === selectedStudy.id) {
            const updatedTasks = study.tasks.map(task => {
              if (task.id === currentTask.id) {
                return { ...task, status: 'completed' };
              }
              return task;
            });
            return {
              ...study,
              tasks: updatedTasks,
              completedTasks: updatedTasks.filter(t => t.status === 'completed').length
            };
          }
          return study;
        });
        
        setStudies(updatedStudies);
        setEvaluationDialogOpen(false);
        setCurrentTask(null);
        setSelectedStudy(null);
      }
    } catch (error) {
      console.error('Failed to submit evaluation:', error);
      alert('Failed to submit evaluation. Please try again.');
    } finally {
      setSubmitting(false);
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

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            My Studies
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Evaluate studies and complete assigned tasks
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<FolderSpecial />}
            onClick={() => navigate('/participant/studies/completed')}
          >
            Completed Studies
          </Button>
        </Box>
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search Bar */}
      {!loading && studies.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search studies by title, description, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      )}

      {/* Loading State */}
      {loading ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              Loading studies...
            </Typography>
          </CardContent>
        </Card>
      ) : filteredStudies.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Science sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
              {searchQuery ? 'No Studies Found' : 'No Studies Assigned'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {searchQuery 
                ? 'Try adjusting your search terms.' 
                : "You haven't been assigned to any studies yet."}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredStudies.map((study) => (
            <Grid item xs={12} key={study.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                        {study.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {study.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Chip
                          label={study.status === 'active' ? 'Active' : study.status === 'completed' ? 'Completed' : study.status === 'upcoming' ? 'Upcoming' : study.status}
                          color={study.status === 'active' ? 'success' : study.status === 'completed' ? 'default' : 'info'}
                          size="small"
                        />
                        <Typography variant="body2" color="text.secondary">
                          {study.completedTasks} / {study.totalTasks} tasks completed
                        </Typography>
                      </Box>
                      {study.totalTasks > 0 && (
                        <Box sx={{ mt: 2, mb: 2 }}>
                          <LinearProgress
                            variant="determinate"
                            value={(study.completedTasks / study.totalTasks) * 100}
                            sx={{ height: 8, borderRadius: 1 }}
                          />
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {/* Quiz Required Section - Show when quiz is required but not passed */}
                  {study.quiz_access && study.quiz_access.requiresQuiz && !study.quiz_access.canAccess && (
                    <Card 
                      sx={{ 
                        mb: 3, 
                        background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                        border: '2px solid #ff9800',
                        borderRadius: 2
                      }}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Quiz sx={{ color: 'warning.main', fontSize: 28 }} />
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'warning.dark' }}>
                                Competency Quiz Required
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {study.quiz_access.reason === 'Quiz not attempted' 
                                  ? 'Complete the quiz to access evaluation tasks'
                                  : study.quiz_access.reason === 'Quiz attempt is pending grading'
                                  ? 'Your quiz is pending grading'
                                  : 'Quiz not passed'}
                              </Typography>
                            </Box>
                          </Box>
                          {study.quiz_access.reason === 'Quiz not attempted' && (
                            <Button
                              variant="contained"
                              color="warning"
                              startIcon={<Quiz />}
                              onClick={() => {
                                const quizToTake = study.quiz_access.quizzes?.find(q => q.status === 'not_attempted')?.quiz || study.quiz_access.quiz;
                                if (quizToTake) {
                                  navigate(`/quiz/take/${quizToTake.id}?studyId=${study.id}`);
                                }
                              }}
                              sx={{
                                fontWeight: 600,
                                textTransform: 'none',
                                boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)'
                              }}
                            >
                              Take Quiz Now
                            </Button>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  )}

                  {/* Draft Evaluation Section */}
                  {draftEvaluations[study.id] && (
                    <Card 
                      sx={{ 
                        mb: 3, 
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
                              onClick={() => handleContinueDraft(study)}
                              disabled={study.quiz_access && study.quiz_access.requiresQuiz && !study.quiz_access.canAccess}
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
                                },
                                '&.Mui-disabled': {
                                  bgcolor: 'grey.300',
                                  color: 'grey.600'
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

                  {/* Tasks List */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Evaluation Tasks
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {study.completedTasks > 0 && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<History />}
                          onClick={() => handleViewCompletedEvaluations(study)}
                          color="success"
                        >
                          Completed Evaluations
                        </Button>
                      )}
                      {study.tasks && study.tasks.length > 0 && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => handleViewAll(study)}
                          disabled={study.quiz_access && study.quiz_access.requiresQuiz && !study.quiz_access.canAccess}
                          sx={{
                            '&.Mui-disabled': {
                              bgcolor: 'grey.300',
                              color: 'grey.600',
                              borderColor: 'grey.400'
                            }
                          }}
                        >
                          {study.quiz_access && study.quiz_access.requiresQuiz && !study.quiz_access.canAccess ? 'Quiz Required' : 'View All'}
                        </Button>
                      )}
                    </Box>
                  </Box>
                  <Grid container spacing={2}>
                    {study.tasks && study.tasks.slice(0, 2).map((task) => {
                      // Get full task details (with answer_type, answer_options) for status calculation
                      const fullTask = study.tasksWithDetails?.find(t => t.id === task.id) || task;
                      
                      // Use same logic as ParticipantStudyTasks.js
                      const isFinalCompleted = task.status === 'completed'; // Task completed after final submission
                      const taskData = draftEvaluations[study.id]?.task_answers?.[task.id] || draftEvaluations[study.id]?.task_answers?.[task.id.toString()] || {};
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
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {task.title}
                                </Typography>
                                <Chip
                                  label={statusLabel}
                                  color={statusColor}
                                  size="small"
                                />
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {task.description}
                              </Typography>
                              <Button
                                variant={actualStatus === 'completed' ? 'outlined' : 'contained'}
                                startIcon={actualStatus === 'completed' ? <CheckCircle /> : <PlayArrow />}
                                fullWidth
                                onClick={() => handleStartEvaluation(study, task)}
                                disabled={
                                  actualStatus === 'completed' ||
                                  (study.quiz_access && study.quiz_access.requiresQuiz && !study.quiz_access.canAccess)
                                }
                                sx={{
                                  '&.Mui-disabled': {
                                    bgcolor: 'grey.300',
                                    color: 'grey.600'
                                  }
                                }}
                              >
                                {actualStatus === 'completed' 
                                  ? 'Completed' 
                                  : (study.quiz_access && study.quiz_access.requiresQuiz && !study.quiz_access.canAccess)
                                  ? 'Quiz Required'
                                  : actualStatus === 'in_progress' 
                                  ? 'Continue Evaluation' 
                                  : 'Start Evaluation'}
                              </Button>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                    {study.tasks && study.tasks.length > 2 && (
                      <Grid item xs={12}>
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                          <Button
                            variant="text"
                            startIcon={<Visibility />}
                            onClick={() => handleViewAll(study)}
                          >
                            View All {study.tasks.length} Tasks
                          </Button>
                        </Box>
                      </Grid>
                    )}
                  </Grid>

                  {/* Badge Skip Info - Show when user has required badges */}
                  {/* Quiz Status Message - Show when quiz is required and user has access */}
                  {study.quiz_access && study.quiz_access.requiresQuiz && study.quiz_access.canAccess && (
                    <Box 
                      sx={{ 
                        mt: 2, 
                        p: 1.5, 
                        bgcolor: 'success.light', 
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ color: 'success.dark' }}>
                        {/* Priority: 1. Check if quiz was passed, 2. Check if skipped via badge */}
                        {study.quiz_access.quizzes?.some(q => q.status === 'passed') 
                          ? 'Quiz passed'
                          : study.quiz_access.quizzes?.some(q => q.status === 'passed_badge')
                            ? `Quiz skipped - you already have the required badge${study.quiz_access.quizzes.filter(q => q.status === 'passed_badge').length > 1 ? 's' : ''}`
                            : 'Quiz completed'}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Evaluation Dialog */}
      <Dialog
        open={evaluationDialogOpen}
        onClose={() => !submitting && setEvaluationDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {currentTask?.title || 'Evaluation Task'}
        </DialogTitle>
        <DialogContent>
          {currentTask && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {currentTask.description}
              </Typography>

              {/* Rating */}
              <Box sx={{ mb: 3 }}>
                <FormLabel component="legend">Overall Rating</FormLabel>
                <Rating
                  value={evaluationData.rating}
                  onChange={(event, newValue) => {
                    setEvaluationData({ ...evaluationData, rating: newValue });
                  }}
                  size="large"
                  sx={{ mt: 1 }}
                />
              </Box>

              {/* Comparison */}
              <Box sx={{ mb: 3 }}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Which artifact is better?</FormLabel>
                  <RadioGroup
                    value={evaluationData.comparison}
                    onChange={(e) => setEvaluationData({ ...evaluationData, comparison: e.target.value })}
                  >
                    <FormControlLabel value="artifact1" control={<Radio />} label="Artifact 1" />
                    <FormControlLabel value="artifact2" control={<Radio />} label="Artifact 2" />
                    <FormControlLabel value="equal" control={<Radio />} label="They are equal" />
                    <FormControlLabel value="different" control={<Radio />} label="They serve different purposes" />
                  </RadioGroup>
                </FormControl>
              </Box>

              {/* Comments */}
              <TextField
                label="Additional Comments"
                multiline
                rows={4}
                fullWidth
                value={evaluationData.comments}
                onChange={(e) => setEvaluationData({ ...evaluationData, comments: e.target.value })}
                placeholder="Provide any additional feedback or observations..."
                sx={{ mb: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEvaluationDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitEvaluation}
            variant="contained"
            disabled={submitting || !evaluationData.rating || !evaluationData.comparison}
          >
            {submitting ? 'Submitting...' : 'Submit Evaluation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Completed Evaluations Dialog */}
      <CompletedEvaluationsDialog
        open={completedEvaluationsDialogOpen}
        onClose={() => {
          setCompletedEvaluationsDialogOpen(false);
          setSelectedStudyForEvaluations(null);
        }}
        studyId={selectedStudyForEvaluations?.id}
        studyTitle={selectedStudyForEvaluations?.title}
      />
    </Box>
  );
};

export default ParticipantStudies;


