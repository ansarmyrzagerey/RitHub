import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Rating,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Chip,
  Divider,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Code,
  Image,
  Description,
  CameraAlt,
  Delete,
  Quiz,
  Add,
  Close
} from '@mui/icons-material';
import HighlightableText from '../components/HighlightableText';
import SynchronizedArtifactComparison from '../components/SynchronizedArtifactComparison';
import AuthenticatedImage from '../components/AuthenticatedImage';
import plantumlEncoder from 'plantuml-encoder';

// Import services
import ParticipantService from '../services/participantService';
import api from '../services/api';

// Import utilities
import { isTaskComplete, hasTaskData } from '../utils/taskUtils';

// Import styles
import '../styles/globals.css';
import '../styles/components.css';

// Helper function to construct image URL
const getImageUrl = (url) => {
  if (!url) return '';
  console.log('[getImageUrl] Original URL:', url);
  
  // If URL is already absolute, check if it's from the same origin or needs adjustment
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // In Docker, backend might return localhost:5000 but frontend needs to use the proxy
    // Check if we're in Docker and need to use relative path instead
    const apiBaseUrl = process.env.REACT_APP_API_URL || '/api';
    
    // If API base is relative (/api), convert absolute backend URL to relative
    if (apiBaseUrl.startsWith('/')) {
      try {
        const urlObj = new URL(url);
        // Extract just the path part
        return urlObj.pathname;
      } catch (e) {
        // If URL parsing fails, try to extract path manually
        const match = url.match(/https?:\/\/[^\/]+(\/.*)/);
        if (match) {
          return match[1];
        }
      }
    }
    return url;
  }
  
  // If URL starts with /uploads, use as-is (will be served by backend)
  if (url.startsWith('/uploads')) {
    return url;
  }
  
  return url;
};

const ParticipantStudyTasks = () => {
  const { id: studyId } = useParams();
  const navigate = useNavigate();
  const [study, setStudy] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requiredQuiz, setRequiredQuiz] = useState(null); // Store quiz info when access is denied
  const [evaluationData, setEvaluationData] = useState({});
  const [submittingTasks, setSubmittingTasks] = useState(new Set());
  const [submittingFinal, setSubmittingFinal] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [submittedTasks, setSubmittedTasks] = useState(new Set()); // Track individually submitted tasks
  const [artifactTags, setArtifactTags] = useState({}); // { taskId: { artifactId: [tags] } }
  const [newTagInputs, setNewTagInputs] = useState({}); // { taskId-artifactId: 'tag text' }
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewingImages, setViewingImages] = useState([]); // Array of { artifact, imageSrc, label }

  useEffect(() => {
    loadStudyAndTasks();
  }, [studyId]);


  const loadStudyAndTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      // First fetch study details to check quiz access
      const studyData = await ParticipantService.getStudyDetails(studyId);

      // Check quiz access - block if canAccess is false (quizzes exist and not all passed)
      const quizAccess = studyData.quiz_access;
      
      // If quiz access is denied, handle accordingly
      if (quizAccess && !quizAccess.canAccess) {
        // Handle multiple quizzes
        if (quizAccess.quizzes && quizAccess.quizzes.length > 0) {
          // Find first quiz that needs attention (not attempted > pending > failed)
          const notAttempted = quizAccess.quizzes.find(q => q.status === 'not_attempted');
          const pending = quizAccess.quizzes.find(q => q.status === 'pending_grading');
          const failed = quizAccess.quizzes.find(q => q.status === 'failed');
          
          const quizToTake = notAttempted || pending || failed;
          
          if (notAttempted && quizToTake.quiz) {
            // Store quiz info for display instead of redirecting immediately
            setRequiredQuiz({
              quiz: quizToTake.quiz,
              status: 'not_attempted',
              reason: 'Quiz not attempted'
            });
            setLoading(false);
            return;
          }
          
          if (pending) {
            setError(`You have ${quizAccess.pendingQuizzes || 1} quiz attempt(s) pending manual grading. You will be able to access the study once grading is complete.`);
            setLoading(false);
            return;
          }
          
          if (failed) {
            const failedCount = quizAccess.failedQuizzes || 1;
            const totalCount = quizAccess.totalQuizzes || 1;
            setError(`You must pass all required quizzes to access study tasks. ${failedCount} of ${totalCount} quiz(zes) failed. Please contact the study administrator for assistance.`);
            setLoading(false);
            return;
          }
        } else if (quizAccess.quiz) {
          // Single quiz (backward compatibility)
          // If quiz not attempted, show button instead of redirecting
          if (quizAccess.reason === 'Quiz not attempted' && quizAccess.quiz) {
            setRequiredQuiz({
              quiz: quizAccess.quiz,
              status: 'not_attempted',
              reason: quizAccess.reason
            });
            setLoading(false);
            return;
          }
          // If quiz failed, show error and prevent access
          if (quizAccess.reason === 'Quiz not passed - no retakes allowed') {
            setError('You must pass the required quiz to access study tasks. Please contact the study administrator for assistance.');
            setLoading(false);
            return;
          }
          // If pending grading, show message
          if (quizAccess.reason === 'Quiz attempt is pending grading') {
            setError('Your quiz attempt is pending manual grading. You will be able to access the study once grading is complete.');
            setLoading(false);
            return;
          }
        }
        return; // Exit early - don't load tasks
      }

      // Now fetch tasks (only if quiz access is granted)
      let tasksData;
      try {
        tasksData = await ParticipantService.getStudyTasks(studyId);
      } catch (err) {
        // If API returns 403, it means quiz access was denied
        if (err.response?.status === 403 && err.response?.data?.quiz_access) {
          const apiQuizAccess = err.response.data.quiz_access;
          // Handle quiz access error from API
          if (apiQuizAccess.quizzes && apiQuizAccess.quizzes.length > 0) {
            const notAttempted = apiQuizAccess.quizzes.find(q => q.status === 'not_attempted');
            if (notAttempted && notAttempted.quiz) {
              setRequiredQuiz({
                quiz: notAttempted.quiz,
                status: 'not_attempted',
                reason: 'Quiz not attempted'
              });
              setLoading(false);
              return;
            }
          } else if (apiQuizAccess.quiz) {
            setRequiredQuiz({
              quiz: apiQuizAccess.quiz,
              status: 'not_attempted',
              reason: 'Quiz not attempted'
            });
            setLoading(false);
            return;
          }
          setError('You must pass all required quizzes to access study tasks.');
          setLoading(false);
          return;
        }
        throw err; // Re-throw if it's not a quiz access error
      }

      setStudy({
        id: studyData.id,
        title: studyData.title,
        description: studyData.description,
        completedTasks: studyData.completed_tasks || 0,
        totalTasks: studyData.total_tasks || 0,
        quiz_access: quizAccess
      });

      // Fetch full details for each task
      const tasksWithDetails = await Promise.all(
        tasksData.map(async (task) => {
          try {
            const response = await api.get(`/participant/tasks/${task.id}`);
            return {
              ...task,
              ...response.data,
              status: task.status || 'pending'
            };
          } catch (err) {
            console.error(`Failed to load task ${task.id}:`, err);
            return {
              ...task,
              status: task.status || 'pending',
              error: 'Failed to load task details'
            };
          }
        })
      );

      setTasks(tasksWithDetails);

      // Initialize evaluation data for all tasks
      const initialData = {};
      tasksWithDetails.forEach(task => {
        initialData[task.id] = {
          ratings: {},
          choice: '',
          text: '',
          comments: '',
          annotations: {},
          screenshots: [],
          highlights: [], // Highlights for task instructions
          artifactHighlights: {
            artifact1: [],
            artifact2: [],
            artifact3: []
          }
        };

        // Initialize ratings based on answer type
        if (task.answer_type === 'rating' || task.answer_type === 'rating_required_comments') {
          if (task.artifact1) initialData[task.id].ratings.artifact1 = 0;
          if (task.artifact2) initialData[task.id].ratings.artifact2 = 0;
          if (task.artifact3) initialData[task.id].ratings.artifact3 = 0;
        }

        // Initialize ratings for criteria if they exist
        if (task.criteria && task.criteria.length > 0) {
          task.criteria.forEach(criterion => {
            initialData[task.id].ratings[criterion.id] = 0;
          });
        }
      });

      // Load draft evaluation and merge with initial data
      const alreadySubmittedTasks = new Set();
      try {
        const draft = await ParticipantService.getDraftEvaluation(studyId);
        if (draft && draft.task_answers && Object.keys(draft.task_answers).length > 0) {
          setHasDraft(true);
          // Merge draft data with initial data
          Object.keys(draft.task_answers).forEach(taskId => {
            const taskIdNum = parseInt(taskId, 10);
            const draftData = draft.task_answers[taskId];
            
            // Check if this task has meaningful data saved (consider it submitted)
            const hasData = (draftData.ratings && Object.values(draftData.ratings).some(r => r > 0)) ||
                           (draftData.choice && draftData.choice.trim()) ||
                           (draftData.text && draftData.text.trim()) ||
                           (draftData.comments && draftData.comments.trim());
            
            if (hasData) {
              alreadySubmittedTasks.add(taskIdNum || parseInt(taskId, 10));
            }
            
            if (initialData[taskIdNum]) {
              initialData[taskIdNum] = {
                ...initialData[taskIdNum],
                ...draftData
              };
            } else if (initialData[taskId]) {
              initialData[taskId] = {
                ...initialData[taskId],
                ...draftData
              };
            }
          });
        }
      } catch (error) {
        // No draft exists - that's okay
        console.log('No draft evaluation found');
      }

      setSubmittedTasks(alreadySubmittedTasks);
      setEvaluationData(initialData);

      // Load tags for all tasks
      const tagsData = {};
      for (const task of tasksData.tasks || []) {
        try {
          const tagsResponse = await ParticipantService.getEvaluationTags(task.id);
          if (tagsResponse.tags) {
            tagsData[task.id] = tagsResponse.tags;
          }
        } catch (error) {
          // Tags might not exist yet, that's okay
          console.log(`No tags found for task ${task.id}`);
        }
      }
      setArtifactTags(tagsData);
    } catch (error) {
      console.error('Failed to load study and tasks:', error);
      setError('Failed to load study and tasks. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to update task status based on data
  const updateTaskStatus = async (taskId, taskData) => {
    try {
      const hasData = hasTaskData(taskData);
      // Only update status if task is not already completed
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== 'completed') {
        if (hasData) {
          // Update to in_progress if there's any data
          await ParticipantService.startTask(taskId);
        }
        // Note: We don't set back to pending here - that's handled by backend when saving draft
      }
    } catch (error) {
      console.log('Could not update task status:', error);
    }
  };

  const handleRatingChange = (taskId, criterionId, value) => {
    setEvaluationData(prev => {
      const newData = {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          ratings: {
            ...prev[taskId].ratings,
            [criterionId]: value
          }
        }
      };
      // Update status asynchronously
      updateTaskStatus(taskId, newData[taskId]);
      return newData;
    });
  };

  const handleChoiceChange = (taskId, value) => {
    setEvaluationData(prev => {
      const currentChoice = prev[taskId]?.choice || '';
      // Allow unchecking: if clicking the same option, clear it
      const newChoice = currentChoice === value ? '' : value;
      const newData = {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          choice: newChoice
        }
      };
      // Update status asynchronously
      updateTaskStatus(taskId, newData[taskId]);
      return newData;
    });
  };

  const handleTextChange = (taskId, value) => {
    setEvaluationData(prev => {
      const newData = {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          text: value
        }
      };
      // Update status asynchronously
      updateTaskStatus(taskId, newData[taskId]);
      return newData;
    });
  };

  const handleCommentsChange = (taskId, value) => {
    setEvaluationData(prev => {
      const newData = {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          comments: value
        }
      };
      // Update status asynchronously
      updateTaskStatus(taskId, newData[taskId]);
      return newData;
    });
  };

  const handleScreenshotUpload = async (taskId, file) => {
    try {
      const formData = new FormData();
      formData.append('screenshot', file);

      const response = await ParticipantService.uploadScreenshot(taskId, formData);
      if (response && response.image) {
        const newScreenshot = {
          id: response.image.id,
          url: response.image.url,
          fileName: response.image.fileName
        };

        setEvaluationData(prev => {
          const newData = {
            ...prev,
            [taskId]: {
              ...prev[taskId],
              screenshots: [...(prev[taskId]?.screenshots || []), newScreenshot]
            }
          };
          // Update status asynchronously
          updateTaskStatus(taskId, newData[taskId]);
          return newData;
        });

        return newScreenshot;
      }
    } catch (error) {
      console.error('Failed to upload screenshot:', error);
      throw error;
    }
  };

  const handleScreenshotDelete = (taskId, screenshotId) => {
    setEvaluationData(prev => {
      const newData = {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          screenshots: (prev[taskId]?.screenshots || []).filter(s => s.id !== screenshotId)
        }
      };
      // Update status asynchronously
      updateTaskStatus(taskId, newData[taskId]);
      return newData;
    });
  };

  const handleHighlightAdd = (taskId, highlight, artifactKey = null) => {
    setEvaluationData(prev => {
      const taskData = prev[taskId] || {};
      let newData;
      if (artifactKey) {
        // Add highlight to specific artifact
        newData = {
          ...prev,
          [taskId]: {
            ...taskData,
            artifactHighlights: {
              ...(taskData.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }),
              [artifactKey]: [...(taskData.artifactHighlights?.[artifactKey] || []), highlight]
            }
          }
        };
      } else {
        // Add highlight to task instructions
        newData = {
          ...prev,
          [taskId]: {
            ...taskData,
            highlights: [...(taskData.highlights || []), highlight]
          }
        };
      }
      // Update status asynchronously
      updateTaskStatus(taskId, newData[taskId]);
      return newData;
    });
  };

  const handleHighlightUpdate = (taskId, highlight, artifactKey = null) => {
    setEvaluationData(prev => {
      const taskData = prev[taskId] || {};
      if (artifactKey) {
        // Update highlight in specific artifact
        return {
          ...prev,
          [taskId]: {
            ...taskData,
            artifactHighlights: {
              ...(taskData.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }),
              [artifactKey]: (taskData.artifactHighlights?.[artifactKey] || []).map(h => 
                h.id === highlight.id ? highlight : h
              )
            }
          }
        };
      } else {
        // Update highlight in task instructions
        return {
          ...prev,
          [taskId]: {
            ...taskData,
            highlights: (taskData.highlights || []).map(h => 
              h.id === highlight.id ? highlight : h
            )
          }
        };
      }
    });
  };

  const handleHighlightDelete = (taskId, highlightId, artifactKey = null) => {
    setEvaluationData(prev => {
      const taskData = prev[taskId] || {};
      let newData;
      if (artifactKey) {
        // Delete highlight from specific artifact
        newData = {
          ...prev,
          [taskId]: {
            ...taskData,
            artifactHighlights: {
              ...(taskData.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }),
              [artifactKey]: (taskData.artifactHighlights?.[artifactKey] || []).filter(h => h.id !== highlightId)
            }
          }
        };
      } else {
        // Delete highlight from task instructions
        newData = {
          ...prev,
          [taskId]: {
            ...taskData,
            highlights: (taskData.highlights || []).filter(h => h.id !== highlightId)
          }
        };
      }
      // Update status asynchronously
      updateTaskStatus(taskId, newData[taskId]);
      return newData;
    });
  };

  const handleHighlightImageUpload = async (taskId, formData) => {
    try {
      const response = await ParticipantService.uploadHighlightImage(taskId, formData);
      return response;
    } catch (error) {
      console.error('Failed to upload highlight image:', error);
      throw error;
    }
  };

  const handleTagChange = async (taskId, artifactId, tags) => {
    // Update local state immediately
    setArtifactTags(prev => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        [artifactId]: tags
      }
    }));

    // Save to backend
    try {
      const tagsToSave = {
        [artifactId]: tags
      };
      await ParticipantService.saveEvaluationTags(taskId, tagsToSave);
    } catch (error) {
      console.error('Failed to save tags:', error);
      // Revert on error
      setArtifactTags(prev => ({
        ...prev,
        [taskId]: {
          ...(prev[taskId] || {}),
          [artifactId]: prev[taskId]?.[artifactId] || []
        }
      }));
    }
  };

  const handleSaveDraft = async (taskId) => {
    try {
      setSubmittingTasks(prev => new Set(prev).add(taskId));
      setError(null);

      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const taskData = evaluationData[taskId] || {};

      // Save to draft evaluation (no validation blocking - save regardless of completion status)
      const submissionData = {
        ratings: taskData.ratings || {},
        choice: taskData.choice || '',
        text: taskData.text || '',
        comments: taskData.comments || '',
        annotations: taskData.annotations || {},
        screenshots: taskData.screenshots || [],
        highlights: taskData.highlights || [],
        artifactHighlights: taskData.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }
      };

      // Get current draft or initialize
      let currentDraft;
      try {
        currentDraft = await ParticipantService.getDraftEvaluation(studyId);
      } catch (error) {
        currentDraft = { task_answers: {} };
      }

      // Collect all current task answers from evaluationData to save all changes
      const allCurrentTaskAnswers = {};
      tasks.forEach(task => {
        const currentTaskData = evaluationData[task.id] || {};
        allCurrentTaskAnswers[task.id] = {
          ratings: currentTaskData.ratings || {},
          choice: currentTaskData.choice || '',
          text: currentTaskData.text || '',
          comments: currentTaskData.comments || '',
          annotations: currentTaskData.annotations || {},
          screenshots: currentTaskData.screenshots || [],
          highlights: currentTaskData.highlights || [],
          artifactHighlights: currentTaskData.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }
        };
      });

      // Merge with draft to preserve any data that might not be in evaluationData yet
      // But prioritize current evaluationData over draft
      const updatedTaskAnswers = {
        ...(currentDraft.task_answers || {}),
        ...allCurrentTaskAnswers,
        [taskId]: submissionData // Ensure the current task's data is definitely included
      };

      // Save to draft - this saves ALL tasks' current state
      await ParticipantService.saveDraftEvaluation(studyId, updatedTaskAnswers);
      setHasDraft(true);

      // Update local evaluation data
      setEvaluationData(prev => ({
        ...prev,
        [taskId]: submissionData
      }));

      // Try to update task progress to in_progress (not completed yet)
      try {
        await ParticipantService.startTask(taskId);
      } catch (startError) {
        console.log('Could not update task progress');
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
      setError(error.response?.data?.error || `Failed to save draft. Please try again.`);
    } finally {
      setSubmittingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const handleSubmitTask = async (taskId) => {
    try {
      setSubmittingTasks(prev => new Set(prev).add(taskId));
      setError(null);

      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const taskData = evaluationData[taskId] || {};

      // Validate that all required fields are filled
      if (!isTaskComplete(task, taskData)) {
        const answerType = task.answer_type || 'rating';
        let errorMessage = 'Please fill in all required fields before submitting.';
        
        if (answerType === 'rating' || answerType === 'rating_required_comments') {
          const missingRatings = [];
          if (task.artifact1 && (!taskData.ratings?.artifact1 || taskData.ratings.artifact1 === 0)) {
            missingRatings.push('Artifact 1 rating');
          }
          if (task.artifact2 && (!taskData.ratings?.artifact2 || taskData.ratings.artifact2 === 0)) {
            missingRatings.push('Artifact 2 rating');
          }
          if (task.artifact3 && (!taskData.ratings?.artifact3 || taskData.ratings.artifact3 === 0)) {
            missingRatings.push('Artifact 3 rating');
          }
          if (answerType === 'rating_required_comments' && !taskData.comments?.trim()) {
            missingRatings.push('Comments');
          }
          if (missingRatings.length > 0) {
            errorMessage = `Please provide: ${missingRatings.join(', ')}`;
          }
        } else if (answerType === 'choice' || answerType === 'choice_required_text') {
          const missing = [];
          if (!taskData.choice) missing.push('Choice selection');
          if (answerType === 'choice_required_text' && !taskData.text?.trim()) {
            missing.push('Text explanation');
          }
          if (missing.length > 0) {
            errorMessage = `Please provide: ${missing.join(', ')}`;
          }
        } else if (answerType === 'text_required') {
          errorMessage = 'Please provide your evaluation text.';
        }
        
        setError(errorMessage);
        setSubmittingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
        return;
      }

      // Save to draft evaluation
      const submissionData = {
        ratings: taskData.ratings || {},
        choice: taskData.choice || '',
        text: taskData.text || '',
        comments: taskData.comments || '',
        annotations: taskData.annotations || {},
        screenshots: taskData.screenshots || [],
        highlights: taskData.highlights || [],
        artifactHighlights: taskData.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }
      };

      // Get current draft or initialize
      let currentDraft;
      try {
        currentDraft = await ParticipantService.getDraftEvaluation(studyId);
      } catch (error) {
        currentDraft = { task_answers: {} };
      }

      // Collect all current task answers from evaluationData to save all changes
      const allCurrentTaskAnswers = {};
      tasks.forEach(task => {
        const currentTaskData = evaluationData[task.id] || {};
        allCurrentTaskAnswers[task.id] = {
          ratings: currentTaskData.ratings || {},
          choice: currentTaskData.choice || '',
          text: currentTaskData.text || '',
          comments: currentTaskData.comments || '',
          annotations: currentTaskData.annotations || {},
          screenshots: currentTaskData.screenshots || [],
          highlights: currentTaskData.highlights || [],
          artifactHighlights: currentTaskData.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }
        };
      });

      // Merge with draft to preserve any data that might not be in evaluationData yet
      // But prioritize current evaluationData over draft
      const updatedTaskAnswers = {
        ...(currentDraft.task_answers || {}),
        ...allCurrentTaskAnswers,
        [taskId]: submissionData // Ensure the current task's data is definitely included
      };

      // Save to draft - this saves ALL tasks' current state
      await ParticipantService.saveDraftEvaluation(studyId, updatedTaskAnswers);
      setHasDraft(true);

      // Submit the task to backend - this saves it as completed in the database
      await ParticipantService.submitTask(taskId, submissionData);

      // Update local evaluation data
      setEvaluationData(prev => ({
        ...prev,
        [taskId]: submissionData
      }));

      // Mark task as submitted (completed visually)
      setSubmittedTasks(prev => new Set(prev).add(taskId));

      // Update task status in local state to reflect completion
      setTasks(prevTasks => prevTasks.map(t => 
        t.id === taskId ? { ...t, status: 'completed' } : t
      ));

      // No page reload - just update the UI state
    } catch (error) {
      console.error('Failed to submit evaluation:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || `Failed to submit task. Please try again.`;
      setError(errorMessage);
    } finally {
      setSubmittingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const getArtifactIcon = (type) => {
    if (!type) return <Code />;
    const lowerType = type.toLowerCase();
    if (lowerType.includes('image') || lowerType.includes('png') || lowerType.includes('jpg')) {
      return <Image />;
    }
    if (lowerType.includes('text') || lowerType.includes('document')) {
      return <Description />;
    }
    return <Code />;
  };

  // Helper to check if type is UI snapshot or image
  const isUISnapshotType = (type) => {
    if (!type) return false;
    const normalized = type.trim().replace(/[-_\s]+/g, ' ').toLowerCase();
    return normalized === 'ui snapshot' || normalized.startsWith('ui snapshot');
  };

  const isImageArtifact = (artifact) => {
    if (!artifact) return false;
    const artifactType = artifact.type?.toLowerCase() || '';
    return artifactType.includes('image') || 
           isUISnapshotType(artifactType) ||
           (artifact.name && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(artifact.name));
  };

  // Get image source for an artifact
  const getImageSource = (artifact) => {
    if (!artifact) return null;
    const artifactType = artifact.type?.toLowerCase() || '';
    const isUISnapshot = isUISnapshotType(artifactType);
    const isDatabaseStorage = artifact.storage_type === 'database';
    
    if (isUISnapshot || isDatabaseStorage) {
      return artifact.id ? `/api/participant/artifacts/${artifact.id}/image` : null;
    }
    
    if (artifact.content && typeof artifact.content === 'string' && 
        artifact.content.length > 100 && 
        /^[A-Za-z0-9+/=\s]+$/.test(artifact.content.trim()) &&
        !artifact.content.startsWith('http') &&
        !artifact.content.startsWith('/')) {
      const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : (artifact.metadata || {});
      const imageFormat = metadata.format || metadata.mimeType?.split('/')[1] || artifact.mime_type?.split('/')[1] || 'png';
      return `data:image/${imageFormat};base64,${artifact.content.trim()}`;
    }
    
    if (artifact.storage_type === 'filesystem' && artifact.file_path && !isUISnapshot) {
      const filePath = artifact.file_path.replace(/\\/g, '/');
      const uploadsPath = filePath.startsWith('/uploads') ? filePath : `/uploads/${filePath}`;
      return getImageUrl(uploadsPath);
    }
    
    return artifact.id ? `/api/participant/artifacts/${artifact.id}/image` : null;
  };

  // Open image viewer with all images from the task for comparison
  const handleOpenImageViewer = (artifact, task) => {
    const images = [];
    
    // Collect all image artifacts from the task
    if (task.artifact1 && isImageArtifact(task.artifact1)) {
      const src = getImageSource(task.artifact1);
      if (src) {
        images.push({ artifact: task.artifact1, imageSrc: src, label: task.artifact1.name || 'Artifact 1' });
      }
    }
    if (task.artifact2 && isImageArtifact(task.artifact2)) {
      const src = getImageSource(task.artifact2);
      if (src) {
        images.push({ artifact: task.artifact2, imageSrc: src, label: task.artifact2.name || 'Artifact 2' });
      }
    }
    if (task.artifact3 && isImageArtifact(task.artifact3)) {
      const src = getImageSource(task.artifact3);
      if (src) {
        images.push({ artifact: task.artifact3, imageSrc: src, label: task.artifact3.name || 'Artifact 3' });
      }
    }
    
    // If no images found, just show the clicked one
    if (images.length === 0 && artifact) {
      const src = getImageSource(artifact);
      if (src) {
        images.push({ artifact, imageSrc: src, label: artifact.name || 'Artifact' });
      }
    }
    
    setViewingImages(images);
    setImageViewerOpen(true);
  };

  const renderArtifact = (artifact, label, taskId, artifactKey, task = null) => {
    if (!artifact) return null;

    const artifactType = artifact.type?.toLowerCase() || '';
    const originalType = artifact.type || '';
    
    // Helper to check if type is UI snapshot (handles variations like 'ui_snapshot', 'ui snapshot', 'ui-snapshot', etc.)
    const isUISnapshotType = (type) => {
      if (!type) return false;
      const normalized = type.trim().replace(/[-_\s]+/g, ' ').toLowerCase();
      return normalized === 'ui snapshot' || normalized.startsWith('ui snapshot');
    };
    
    const isUISnapshotArtifact = isUISnapshotType(artifactType) || isUISnapshotType(originalType);
    const isImageType = artifactType.includes('image') || 
                       isUISnapshotArtifact ||
                       (artifact.name && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(artifact.name));

    const artifactContent = typeof artifact.content === 'string' 
      ? artifact.content 
      : JSON.stringify(artifact.content, null, 2);

    const artifactHighlights = evaluationData[taskId]?.artifactHighlights?.[artifactKey] || [];
    const artifactId = artifact.id;
    const currentTags = artifactTags[taskId]?.[artifactId] || [];
    const inputKey = `${taskId}-${artifactId}`;
    const newTag = newTagInputs[inputKey] || '';

    const handleAddTag = () => {
      if (newTag.trim() && currentTags.length < 5) {
        const trimmedTag = newTag.trim();
        if (!currentTags.includes(trimmedTag)) {
          handleTagChange(taskId, artifactId, [...currentTags, trimmedTag]);
          setNewTagInputs(prev => ({ ...prev, [inputKey]: '' }));
        }
      }
    };

    const handleRemoveTag = (tagToRemove) => {
      handleTagChange(taskId, artifactId, currentTags.filter(t => t !== tagToRemove));
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      }
    };

    const handleTagInputChange = (value) => {
      setNewTagInputs(prev => ({ ...prev, [inputKey]: value }));
    };

    // Determine image source for ui_snapshot and image types
    let imageSrc = null;
    if (isImageType) {
      const isUISnapshot = isUISnapshotType(artifactType);
      const isDatabaseStorage = artifact.storage_type === 'database';
      
      // UI snapshots ALWAYS use the endpoint (regardless of storage type)
      if (isUISnapshot) {
        if (!artifact.id) {
          return (
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {getArtifactIcon(artifact.type)}
                  <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                    {label}
                  </Typography>
                </Box>
                <Typography color="error">Artifact ID is missing. Cannot load UI snapshot.</Typography>
              </CardContent>
            </Card>
          );
        }
        imageSrc = `/api/participant/artifacts/${artifact.id}/image`;
      }
      // For database storage, use endpoint
      else if (isDatabaseStorage) {
        if (!artifact.id) {
          return (
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {getArtifactIcon(artifact.type)}
                  <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                    {label}
                  </Typography>
                </Box>
                <Typography color="error">Artifact ID is missing. Cannot load image.</Typography>
              </CardContent>
            </Card>
          );
        }
        imageSrc = `/api/participant/artifacts/${artifact.id}/image`;
      }
      // Check for base64 content (only if NOT database storage and NOT ui_snapshot)
      else if (artifact.content && typeof artifact.content === 'string' && 
               artifact.content.length > 100 && 
               /^[A-Za-z0-9+/=\s]+$/.test(artifact.content.trim()) &&
               !artifact.content.startsWith('http') &&
               !artifact.content.startsWith('/')) {
        const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : (artifact.metadata || {});
        const imageFormat = metadata.format || metadata.mimeType?.split('/')[1] || artifact.mime_type?.split('/')[1] || 'png';
        imageSrc = `data:image/${imageFormat};base64,${artifact.content.trim()}`;
      }
      // Check for filesystem path (only if NOT ui_snapshot)
      else if (artifact.storage_type === 'filesystem' && artifact.file_path && !isUISnapshotType(artifactType)) {
        const filePath = artifact.file_path.replace(/\\/g, '/');
        const uploadsPath = filePath.startsWith('/uploads') ? filePath : `/uploads/${filePath}`;
        imageSrc = getImageUrl(uploadsPath);
      }
      // Default: use participant artifact image endpoint
      else {
        if (!artifact.id) {
          return (
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {getArtifactIcon(artifact.type)}
                  <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                    {label}
                  </Typography>
                </Box>
                <Typography color="error">Artifact ID is missing. Cannot load image.</Typography>
              </CardContent>
            </Card>
          );
        }
        imageSrc = `/api/participant/artifacts/${artifact.id}/image`;
      }
    }

    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {getArtifactIcon(artifact.type)}
            <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
              {label}
            </Typography>
            {artifact.name && (
              <Chip label={artifact.name} size="small" sx={{ ml: 2 }} />
            )}
          </Box>
          {artifact.type && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Type: {artifact.type}
            </Typography>
          )}
          
          {/* Render image for ui_snapshot and image types */}
          {isImageType && imageSrc ? (
            <Box 
              sx={{
                width: '100%',
                maxHeight: '80vh',
                overflow: 'auto',
                minHeight: '200px',
                bgcolor: 'grey.50',
                borderRadius: 1,
                p: 2,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'grey.100',
                  boxShadow: 2
                },
                transition: 'all 0.2s ease'
              }}
              onClick={() => handleOpenImageViewer(artifact, task)}
            >
              <Box sx={{
                display: 'inline-block',
                maxWidth: '100%'
              }}>
                {imageSrc.startsWith('/api/') || imageSrc.includes('/participant/artifacts/') ? (
                  <AuthenticatedImage
                    src={imageSrc}
                    alt={artifact.name || 'Artifact'}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      width: 'auto',
                      objectFit: 'contain',
                      borderRadius: '4px',
                      display: 'block'
                    }}
                    onError={(e) => {
                      console.error('[ParticipantStudyTasks] Image load error:', {
                        src: imageSrc,
                        artifactId: artifact.id,
                        artifactName: artifact.name,
                        artifactType: artifact.type,
                        storageType: artifact.storage_type
                      });
                    }}
                    onLoad={() => {
                      console.log('[ParticipantStudyTasks] Image loaded successfully:', artifact.id);
                    }}
                  />
                ) : (
                  <img
                    src={imageSrc}
                    alt={artifact.name || 'Artifact'}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      width: 'auto',
                      objectFit: 'contain',
                      borderRadius: '4px',
                      display: 'block'
                    }}
                    onError={(e) => {
                      console.error('[ParticipantStudyTasks] Image load error:', {
                        src: imageSrc,
                        artifactId: artifact.id,
                        artifactName: artifact.name
                      });
                    }}
                  />
                )}
              </Box>
            </Box>
          ) : (() => {
            // Check if it's a UML diagram - show both visual and text
            const isUMLDiagram = artifactType === 'uml_diagram' || artifactType.includes('uml');
            
            if (isUMLDiagram && artifact.content) {
              // Get image URL from metadata OR generate it from content
              const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : (artifact.metadata || {});
              let umlImageUrl = metadata.renderedImage;

              // If no image URL in metadata but it's a UML diagram, generate it from content
              if (!umlImageUrl && artifact.content) {
                try {
                  const encoded = plantumlEncoder.encode(artifact.content);
                  umlImageUrl = `http://www.plantuml.com/plantuml/png/${encoded}`;
                } catch (error) {
                  console.error('[renderArtifact] Error encoding PlantUML:', error);
                }
              }

              return (
                <Box>
                  {/* UML Visual Preview */}
                  {umlImageUrl && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Rendered Diagram:
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          bgcolor: 'white',
                          borderRadius: 1,
                          p: 2,
                          border: 1,
                          borderColor: 'grey.300'
                        }}
                      >
                        <img
                          src={umlImageUrl}
                          alt="UML Diagram"
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                          onError={(e) => {
                            console.error('[renderArtifact] Error loading UML image');
                            e.target.style.display = 'none';
                          }}
                        />
                      </Box>
                    </Box>
                  )}

                  {/* PlantUML Source Code / Text Content */}
                  <Box>
                    {umlImageUrl && (
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        PlantUML Source Code:
                      </Typography>
                    )}
                    <HighlightableText
                      text={artifactContent}
                      highlights={artifactHighlights}
                      onHighlightAdd={(highlight) => handleHighlightAdd(taskId, highlight, artifactKey)}
                      onHighlightUpdate={(highlight) => handleHighlightUpdate(taskId, highlight, artifactKey)}
                      onHighlightDelete={(highlightId) => handleHighlightDelete(taskId, highlightId, artifactKey)}
                      taskId={taskId}
                      onImageUpload={handleHighlightImageUpload}
                    />
                  </Box>
                </Box>
              );
            }

            // For non-UML text content
            if (artifact.content) {
              return (
                <Box>
                  <HighlightableText
                    text={artifactContent}
                    highlights={artifactHighlights}
                    onHighlightAdd={(highlight) => handleHighlightAdd(taskId, highlight, artifactKey)}
                    onHighlightUpdate={(highlight) => handleHighlightUpdate(taskId, highlight, artifactKey)}
                    onHighlightDelete={(highlightId) => handleHighlightDelete(taskId, highlightId, artifactKey)}
                    taskId={taskId}
                    onImageUpload={handleHighlightImageUpload}
                  />
                </Box>
              );
            }

            return null;
          })()}
          
          {/* Evaluation Tags */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Evaluation Tags {currentTags.length > 0 && `(${currentTags.length}/5)`}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              {currentTags.map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
            {currentTags.length < 5 && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  placeholder="Add a tag..."
                  value={newTag}
                  onChange={(e) => handleTagInputChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={currentTags.length >= 5}
                  sx={{ flexGrow: 1 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddTag}
                  disabled={!newTag.trim() || currentTags.length >= 5}
                >
                  Add
                </Button>
              </Box>
            )}
            {currentTags.length >= 5 && (
              <Typography variant="caption" color="text.secondary">
                Maximum 5 tags reached
              </Typography>
            )}
          </Box>

          {artifact.metadata && Object.keys(artifact.metadata).length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Metadata: {JSON.stringify(artifact.metadata)}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderTaskForm = (task) => {
    const taskData = evaluationData[task.id] || {};
    const answerType = task.answer_type || 'rating';
    const answerOptions = task.answer_options || {};

    // Rating-based answer types
    if (answerType === 'rating' || answerType === 'rating_required_comments') {
      return (
        <>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Rate the Artifacts
            </Typography>
            {task.artifact1 && (
              <Box sx={{ mb: 3 }}>
                <FormLabel component="legend" sx={{ mb: 1, display: 'block' }}>
                  Artifact 1
                </FormLabel>
                <Rating
                  value={taskData.ratings?.artifact1 || 0}
                  onChange={(event, newValue) => handleRatingChange(task.id, 'artifact1', newValue)}
                  max={5}
                  size="large"
                />
              </Box>
            )}
            {task.artifact2 && (
              <Box sx={{ mb: 3 }}>
                <FormLabel component="legend" sx={{ mb: 1, display: 'block' }}>
                  Artifact 2
                </FormLabel>
                <Rating
                  value={taskData.ratings?.artifact2 || 0}
                  onChange={(event, newValue) => handleRatingChange(task.id, 'artifact2', newValue)}
                  max={5}
                  size="large"
                />
              </Box>
            )}
            {task.artifact3 && (
              <Box sx={{ mb: 3 }}>
                <FormLabel component="legend" sx={{ mb: 1, display: 'block' }}>
                  Artifact 3
                </FormLabel>
                <Rating
                  value={taskData.ratings?.artifact3 || 0}
                  onChange={(event, newValue) => handleRatingChange(task.id, 'artifact3', newValue)}
                  max={5}
                  size="large"
                />
              </Box>
            )}
          </Box>
          {(answerType === 'rating' || answerType === 'rating_required_comments') && (
            <Box sx={{ mb: 3 }}>
              <TextField
                label={answerOptions.textLabel || 'Comments'}
                multiline
                rows={4}
                fullWidth
                required={answerType === 'rating_required_comments'}
                value={taskData.comments || ''}
                onChange={(e) => handleCommentsChange(task.id, e.target.value)}
                placeholder={answerOptions.textPlaceholder || (answerType === 'rating' ? 'Add any additional comments (optional)...' : 'Please provide your comments...')}
              />
            </Box>
          )}
        </>
      );
    }

    // Choice-based answer types
    if (answerType === 'choice' || answerType === 'choice_required_text') {
      // Helper function to get artifact name from option value
      const getArtifactName = (optionValue) => {
        // Handle both artifact1 and artifact_1 formats
        if (optionValue === 'artifact1' || optionValue === 'artifact_1') {
          return task.artifact1?.name || null;
        }
        if (optionValue === 'artifact2' || optionValue === 'artifact_2') {
          return task.artifact2?.name || null;
        }
        if (optionValue === 'artifact3' || optionValue === 'artifact_3') {
          return task.artifact3?.name || null;
        }
        return null;
      };
      
      // Helper function to format label with artifact name
      const formatLabel = (option) => {
        const artifactName = getArtifactName(option.value);
        if (artifactName) {
          // Add artifact name in parentheses after the label
          return `${option.label} (${artifactName})`;
        }
        return option.label;
      };
      
      return (
        <>
          <Box sx={{ mb: 4 }}>
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
                {answerOptions.question || 'Select your choice'}
              </FormLabel>
              <RadioGroup
                value={taskData.choice || ''}
                onChange={(e) => handleChoiceChange(task.id, e.target.value)}
              >
                {answerOptions.options && answerOptions.options.map((option, index) => (
                  <FormControlLabel
                    key={index}
                    value={option.value}
                    control={<Radio />}
                    label={formatLabel(option)}
                    sx={{ mb: 1 }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Box>
          {(answerOptions.textOptional !== false) && (
            <Box sx={{ mb: 3 }}>
              <TextField
                label={answerOptions.textLabel || 'Additional Comments'}
                multiline
                rows={4}
                fullWidth
                required={answerType === 'choice_required_text'}
                value={taskData.text || ''}
                onChange={(e) => handleTextChange(task.id, e.target.value)}
                placeholder={answerOptions.textPlaceholder || (answerType === 'choice' ? 'Add any additional comments (optional)...' : 'Please explain your choice...')}
              />
            </Box>
          )}
        </>
      );
    }

    // Text required answer type
    if (answerType === 'text_required') {
      return (
        <Box sx={{ mb: 3 }}>
          <TextField
            label={answerOptions.textLabel || 'Your Evaluation'}
            multiline
            rows={8}
            fullWidth
            required
            value={taskData.text || ''}
            onChange={(e) => handleTextChange(task.id, e.target.value)}
            placeholder={answerOptions.textPlaceholder || 'Please provide your detailed evaluation...'}
          />
        </Box>
      );
    }

    // Fallback for legacy criteria-based tasks
    if (task.criteria && task.criteria.length > 0) {
      return (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Rate the Artifacts
          </Typography>
          {task.criteria.map((criterion) => (
            <Box key={criterion.id} sx={{ mb: 3 }}>
              <FormLabel component="legend" sx={{ mb: 1, display: 'block' }}>
                {criterion.name}
                {criterion.description && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {criterion.description}
                  </Typography>
                )}
              </FormLabel>
              {criterion.scale === 'stars_5' || criterion.scale === 'likert_5' ? (
                <Rating
                  value={taskData.ratings?.[criterion.id] || 0}
                  onChange={(event, newValue) => handleRatingChange(task.id, criterion.id, newValue)}
                  max={5}
                  size="large"
                />
              ) : criterion.scale === 'binary' ? (
                <RadioGroup
                  value={taskData.ratings?.[criterion.id] || ''}
                  onChange={(e) => handleRatingChange(task.id, criterion.id, e.target.value)}
                  row
                >
                  <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                  <FormControlLabel value="no" control={<Radio />} label="No" />
                </RadioGroup>
              ) : (
                <TextField
                  type="number"
                  value={taskData.ratings?.[criterion.id] || ''}
                  onChange={(e) => handleRatingChange(task.id, criterion.id, parseFloat(e.target.value))}
                  inputProps={{ min: 0, step: 0.1 }}
                  fullWidth
                />
              )}
            </Box>
          ))}
        </Box>
      );
    }

    return null;
  };

  const handleSubmitFinalEvaluation = async () => {
    try {
      setSubmittingFinal(true);
      setError(null);

      // Validate that all tasks have answers
      const tasksWithoutAnswers = tasks.filter(task => {
        const taskData = evaluationData[task.id] || {};
        const answerType = task.answer_type || 'rating';
        
        if (answerType === 'rating' || answerType === 'rating_required_comments') {
          const hasRating = task.artifact1 ? (taskData.ratings?.artifact1 && taskData.ratings.artifact1 > 0) : true;
          const hasRating2 = task.artifact2 ? (taskData.ratings?.artifact2 && taskData.ratings.artifact2 > 0) : true;
          const hasRating3 = task.artifact3 ? (taskData.ratings?.artifact3 && taskData.ratings.artifact3 > 0) : true;
          const hasComments = answerType === 'rating_required_comments' ? taskData.comments?.trim() : true;
          return !(hasRating && hasRating2 && hasRating3 && hasComments);
        } else if (answerType === 'choice' || answerType === 'choice_required_text') {
          const hasChoice = !!taskData.choice;
          const hasText = answerType === 'choice_required_text' ? taskData.text?.trim() : true;
          return !(hasChoice && hasText);
        } else if (answerType === 'text_required') {
          return !taskData.text?.trim();
        }
        return false;
      });

      if (tasksWithoutAnswers.length > 0) {
        setError(`Please complete all tasks before submitting. Missing answers for: ${tasksWithoutAnswers.map(t => t.task_type || 'Task').join(', ')}`);
        setSubmittingFinal(false);
        return;
      }

      // First, save all current answers to draft to ensure everything is up to date
      const allTaskAnswers = {};
      tasks.forEach(task => {
        const taskData = evaluationData[task.id] || {};
        allTaskAnswers[task.id] = {
          ratings: taskData.ratings || {},
          choice: taskData.choice || '',
          text: taskData.text || '',
          comments: taskData.comments || '',
          annotations: taskData.annotations || {},
          screenshots: taskData.screenshots || [],
          highlights: taskData.highlights || [],
          artifactHighlights: taskData.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }
        };
      });

      // Save to draft first
      await ParticipantService.saveDraftEvaluation(studyId, allTaskAnswers);

      // Then complete the draft evaluation
      await ParticipantService.completeDraftEvaluation(studyId);

      // Show success message and navigate back
      alert('Evaluation submitted successfully!');
      navigate(`/participant/studies/${studyId}`);
    } catch (error) {
      console.error('Failed to submit final evaluation:', error);
      setError(error.response?.data?.error || 'Failed to submit final evaluation. Please try again.');
    } finally {
      setSubmittingFinal(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show quiz requirement card if quiz is required
  if (requiredQuiz && requiredQuiz.quiz) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/participant/studies/${studyId}`)}
          sx={{ mb: 3 }}
        >
          Back to Study
        </Button>
        
        <Card 
          sx={{ 
            maxWidth: 600, 
            mx: 'auto', 
            mt: 4,
            textAlign: 'center',
            p: 4,
            boxShadow: 3
          }}
        >
          <CardContent>
            <Quiz sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              Quiz Required
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              You must complete the required quiz before accessing study tasks.
            </Typography>
            
            <Button
              variant="contained"
              size="large"
              startIcon={<Quiz />}
              onClick={() => navigate(`/quiz/take/${requiredQuiz.quiz.id}`)}
              sx={{
                py: 2,
                px: 4,
                fontSize: '1.1rem',
                fontWeight: 600,
                minWidth: 300,
                textTransform: 'none'
              }}
            >
              Take Quiz: {requiredQuiz.quiz.title}
            </Button>
            
            {requiredQuiz.quiz.description && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ mt: 3, fontStyle: 'italic' }}
              >
                {requiredQuiz.quiz.description}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error && !study) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/participant/studies/${studyId}`)}
          sx={{ mb: 2 }}
        >
          Back to Study
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

  // Count tasks that are either finally completed OR (submitted AND complete)
  const completedCount = tasks.filter(t => {
    if (t.status === 'completed') return true;
    if (submittedTasks.has(t.id)) {
      const taskData = evaluationData[t.id] || {};
      return isTaskComplete(t, taskData);
    }
    return false;
  }).length;
  const progressPercentage = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <Box>
        {/* Back Button */}
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/participant/studies/${studyId}`)}
          sx={{ mb: 3 }}
        >
        Back to Study
      </Button>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Study Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          {study.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {study.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {completedCount} / {tasks.length} tasks completed
          </Typography>
        </Box>
        {tasks.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progressPercentage}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        )}
      </Box>

      {/* Tasks Section */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Tasks Available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This study doesn't have any evaluation tasks yet.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tasks.map((task, index) => {
            const hasMultipleArtifacts = (task.artifact1 ? 1 : 0) + (task.artifact2 ? 1 : 0) + (task.artifact3 ? 1 : 0) > 1;
            const isFinalCompleted = task.status === 'completed'; // Task completed after final submission
            const isTaskSubmitted = submittedTasks.has(task.id); // Task submitted/saved individually
            const isSubmitting = submittingTasks.has(task.id);
            const taskData = evaluationData[task.id] || {};
            const isComplete = isTaskComplete(task, taskData); // Check if all required fields are filled
            const hasData = hasTaskData(taskData); // Check if task has any data (highlights, screenshots, comments, etc.)

            // Determine status label and color
            // Pending: no data at all
            // In Progress: has data (highlights, screenshots, comments, ratings, etc.) but not fully completed
            // Completed: task is fully submitted (final submission) OR has all required fields filled
            let statusLabel = 'Pending';
            let statusColor = 'default';
            if (isFinalCompleted) {
              statusLabel = 'Completed';
              statusColor = 'success';
            } else if (isComplete) {
              statusLabel = 'Completed';
              statusColor = 'success';
            } else if (hasData || task.status === 'in_progress') {
              statusLabel = 'In Progress';
              statusColor = 'warning';
            } else {
              statusLabel = 'Pending';
              statusColor = 'default';
            }

            return (
              <Card key={task.id} sx={{ position: 'relative' }}>
                <CardContent>
                  {/* Task Header */}
                  <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                        Task {index + 1}: {task.task_type ? task.task_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Evaluation Task'}
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <HighlightableText
                          text={task.instructions || 'Please evaluate the artifacts below.'}
                          highlights={evaluationData[task.id]?.highlights || []}
                          onHighlightAdd={(highlight) => handleHighlightAdd(task.id, highlight)}
                          onHighlightUpdate={(highlight) => handleHighlightUpdate(task.id, highlight)}
                          onHighlightDelete={(highlightId) => handleHighlightDelete(task.id, highlightId)}
                          taskId={task.id}
                          onImageUpload={handleHighlightImageUpload}
                        />
                      </Box>
                    </Box>
                    <Chip
                      label={statusLabel}
                      color={statusColor}
                      size="small"
                      sx={{ ml: 2 }}
                    />
                  </Box>

                  {/* Artifacts Section - show for editing even after individual submission, hide only after final submission */}
                  {!isFinalCompleted && (
                    <>
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                          Artifacts to Evaluate
                        </Typography>

                        {/* Use synchronized comparison for multiple artifacts */}
                        {hasMultipleArtifacts ? (
                          <SynchronizedArtifactComparison
                            artifacts={[task.artifact1, task.artifact2, task.artifact3].filter(Boolean)}
                            taskId={task.id}
                            evaluationData={evaluationData}
                            artifactTags={artifactTags}
                            newTagInputs={newTagInputs}
                            onTagChange={handleTagChange}
                            onHighlightAdd={handleHighlightAdd}
                            onHighlightUpdate={handleHighlightUpdate}
                            onHighlightDelete={handleHighlightDelete}
                            onHighlightImageUpload={handleHighlightImageUpload}
                            setNewTagInputs={setNewTagInputs}
                          />
                        ) : (
                          /* Fallback to single artifact view for single artifact tasks */
                          <Grid container spacing={3}>
                            {task.artifact1 && (
                              <Grid item xs={12}>
                                {renderArtifact(task.artifact1, task.artifact1.name, task.id, 'artifact1', task)}
                              </Grid>
                            )}
                          </Grid>
                        )}
                      </Box>

                      {/* Evaluation Form */}
                      <Card variant="outlined" sx={{ mb: 3 }}>
                        <CardContent>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                            Your Evaluation
                          </Typography>
                          {renderTaskForm(task)}
                        </CardContent>
                      </Card>

                      {/* Screenshots Section */}
                      <Card variant="outlined" sx={{ mb: 3 }}>
                        <CardContent>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                            Screenshots (Optional)
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Attach screenshots to support your evaluation
                          </Typography>
                          
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            id={`screenshot-upload-${task.id}`}
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (file) {
                                try {
                                  await handleScreenshotUpload(task.id, file);
                                } catch (error) {
                                  setError(`Failed to upload screenshot: ${error.message || 'Unknown error'}`);
                                }
                              }
                              e.target.value = ''; // Reset input
                            }}
                          />
                          <label htmlFor={`screenshot-upload-${task.id}`}>
                            <Button
                              variant="outlined"
                              component="span"
                              startIcon={<CameraAlt />}
                              sx={{ mb: 2 }}
                            >
                              Add Screenshot
                            </Button>
                          </label>

                          {/* Display Screenshots */}
                          {evaluationData[task.id]?.screenshots && evaluationData[task.id].screenshots.length > 0 && (
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              {evaluationData[task.id].screenshots.map((screenshot) => (
                                <Grid item xs={12} sm={6} md={4} key={screenshot.id}>
                                  <Box sx={{ position: 'relative' }}>
                                    <img
                                      src={getImageUrl(screenshot.url)}
                                      alt={screenshot.fileName}
                                      style={{
                                        width: '100%',
                                        height: '200px',
                                        objectFit: 'cover',
                                        borderRadius: '4px',
                                        border: '1px solid #ddd',
                                        backgroundColor: '#f5f5f5'
                                      }}
                                      onError={(e) => {
                                        console.error('Failed to load image:', {
                                          originalUrl: screenshot.url,
                                          processedUrl: getImageUrl(screenshot.url),
                                          error: e
                                        });
                                        // Show error message instead of hiding
                                        e.target.style.display = 'none';
                                        const errorDiv = document.createElement('div');
                                        errorDiv.textContent = 'Image failed to load';
                                        errorDiv.style.cssText = 'padding: 10px; color: red; text-align: center;';
                                        e.target.parentElement.appendChild(errorDiv);
                                      }}
                                      onLoad={() => {
                                        console.log('Image loaded successfully:', getImageUrl(screenshot.url));
                                      }}
                                    />
                                    <IconButton
                                      size="small"
                                      color="error"
                                      sx={{
                                        position: 'absolute',
                                        top: 4,
                                        right: 4,
                                        bgcolor: 'rgba(255, 255, 255, 0.9)'
                                      }}
                                      onClick={() => handleScreenshotDelete(task.id, screenshot.id)}
                                    >
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </Grid>
                              ))}
                            </Grid>
                          )}
                        </CardContent>
                      </Card>

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={() => handleSaveDraft(task.id)}
                          disabled={isSubmitting || isFinalCompleted}
                        >
                          {isSubmitting ? 'Saving...' : 'Draft'}
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={isTaskSubmitted ? <CheckCircle /> : null}
                          onClick={() => handleSubmitTask(task.id)}
                          disabled={isSubmitting || isFinalCompleted || !isComplete}
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit Changes'}
                        </Button>
                      </Box>
                    </>
                  )}

                  {isFinalCompleted && (
                    <Alert severity="success" sx={{ mt: 2 }}>
                      This task has been completed.
                    </Alert>
                  )}

                  {/* Divider between tasks (except last) */}
                  {index < tasks.length - 1 && (
                    <Divider sx={{ mt: 4 }} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Final Submission Button */}
      {tasks.length > 0 && (
        <Box sx={{ mt: 4, pt: 4, borderTop: '2px solid', borderColor: 'divider' }}>
          <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Submit Final Evaluation
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
                Once you submit your final evaluation, all your answers will be finalized and you won't be able to make changes.
                Make sure you have completed all tasks before submitting.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={handleSubmitFinalEvaluation}
                disabled={submittingFinal || tasks.length === 0}
                sx={{ 
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'primary.dark'
                  }
                }}
              >
                {submittingFinal ? 'Submitting...' : 'Submit Final Evaluation'}
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Image Viewer Dialog */}
      <Dialog
        open={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        maxWidth={viewingImages.length > 1 ? 'xl' : 'md'}
        fullWidth
        fullScreen={viewingImages.length === 1}
        PaperProps={{
          sx: {
            maxHeight: '95vh',
            m: viewingImages.length === 1 ? 0 : 2
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6">
            {viewingImages.length > 1 
              ? `Image Comparison (${viewingImages.length} images)`
              : viewingImages[0]?.label || 'Image Viewer'
            }
          </Typography>
          <IconButton onClick={() => setImageViewerOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2, overflow: 'auto' }}>
          {viewingImages.length > 1 ? (
            // Side-by-side comparison for multiple images
            <Grid container spacing={2}>
              {viewingImages.map((imgData, index) => (
                <Grid 
                  item 
                  xs={12} 
                  sm={viewingImages.length === 2 ? 6 : viewingImages.length === 3 ? 4 : 12}
                  key={index}
                >
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      {imgData.label}
                    </Typography>
                    <Box sx={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                      p: 2,
                      minHeight: '400px',
                      maxHeight: '75vh',
                      overflow: 'auto'
                    }}>
                      {imgData.imageSrc.startsWith('/api/') || imgData.imageSrc.includes('/participant/artifacts/') ? (
                        <AuthenticatedImage
                          src={imgData.imageSrc}
                          alt={imgData.label}
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            width: 'auto',
                            objectFit: 'contain',
                            borderRadius: '4px',
                            display: 'block'
                          }}
                        />
                      ) : (
                        <img
                          src={imgData.imageSrc}
                          alt={imgData.label}
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            width: 'auto',
                            objectFit: 'contain',
                            borderRadius: '4px',
                            display: 'block'
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          ) : viewingImages.length === 1 ? (
            // Full-size single image view
            <Box sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: 'grey.900',
              p: 2
            }}>
              {viewingImages[0].imageSrc.startsWith('/api/') || viewingImages[0].imageSrc.includes('/participant/artifacts/') ? (
                <AuthenticatedImage
                  src={viewingImages[0].imageSrc}
                  alt={viewingImages[0].label}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '90vh',
                    height: 'auto',
                    width: 'auto',
                    objectFit: 'contain',
                    borderRadius: '4px',
                    display: 'block'
                  }}
                />
              ) : (
                <img
                  src={viewingImages[0].imageSrc}
                  alt={viewingImages[0].label}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '90vh',
                    height: 'auto',
                    width: 'auto',
                    objectFit: 'contain',
                    borderRadius: '4px',
                    display: 'block'
                  }}
                />
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageViewerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ParticipantStudyTasks;

