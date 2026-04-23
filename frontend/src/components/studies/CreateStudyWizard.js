import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack, ArrowForward, Save } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { studyService } from '../../services/studyService';

// Import step components (will be created in subsequent tasks)
import BasicInformationForm from './BasicInformationForm';
import EnhancedQuestionBuilder from './EnhancedQuestionBuilder';
import EvaluationCriteriaBuilder from './EvaluationCriteriaBuilder';
import StudyConfigurationForm from './StudyConfigurationForm';
import QuizAssignmentStep from './QuizAssignmentStep';
import ReviewAndLaunchPanel from './ReviewAndLaunchPanel';

const steps = [
  'Basic Information',
  'Build Questions',
  'Study Configuration',
  'Generate & Assign',
  'Review & Launch',
];

const CreateStudyWizard = ({ studyId = null, onComplete, editMode = false }) => {
  const navigate = useNavigate();
  const { isResearcher, loading: authLoading } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [studyData, setStudyData] = useState({
    title: '',
    description: '',
    artifacts: [],
    questions: [],
    criteria: [],
    deadline: null,
    participant_capacity: 50,
    status: 'draft',
    selectedQuizIds: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [createdStudyId, setCreatedStudyId] = useState(studyId);
  const [loadingStudy, setLoadingStudy] = useState(editMode && studyId);

  // Load existing study data if in edit mode
  useEffect(() => {
    const loadStudyData = async () => {
      if (editMode && studyId) {
        try {
          setLoadingStudy(true);
          
          // Fetch study details
          const studyResponse = await studyService.getStudy(studyId);
          const study = studyResponse.study || studyResponse;
          
          // Fetch questions with artifacts and criteria
          const questionsResponse = await studyService.getStudyQuestions(studyId);
          const questions = questionsResponse.questions || [];
          
          // Fetch assigned quizzes
          const quizzesResponse = await fetch(`/api/studies/${studyId}/quizzes`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }).then(res => res.json()).catch(() => ({ success: false, quizzes: [] }));
          
          const selectedQuizIds = quizzesResponse.success 
            ? quizzesResponse.quizzes.map(q => q.id) 
            : [];
          
          // Set the study data
          setStudyData({
            title: study.title || '',
            description: study.description || '',
            artifacts: study.artifacts || [],
            questions: questions,
            criteria: study.criteria || [],
            deadline: study.deadline || null,
            participant_capacity: study.participant_capacity || 50,
            status: study.status || 'draft',
            selectedQuizIds: selectedQuizIds,
          });
          
          toast.success('Study loaded for editing');
        } catch (error) {
          console.error('Failed to load study:', error);
          toast.error('Failed to load study data');
          navigate('/studies');
        } finally {
          setLoadingStudy(false);
        }
      }
    };
    
    loadStudyData();
  }, [editMode, studyId, navigate]);

  // Redirect non-researchers
  useEffect(() => {
    if (!authLoading && !isResearcher) {
      toast.error('Only researchers can create studies');
      navigate('/studies');
    }
  }, [isResearcher, authLoading, navigate]);

  // Auto-save functionality (every 30 seconds)
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (studyData.title || studyData.description) {
        handleAutoSave();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [studyData]);

  const handleAutoSave = useCallback(async () => {
    try {
      setIsSaving(true);
      // TODO: Call API to save draft
      // await studyService.saveDraft(studyData);
      setLastSaved(new Date());
      console.log('Auto-saved study draft');
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [studyData]);

  const handleNext = async () => {
    if (activeStep < steps.length - 1) {
      // Auto-save draft when moving to Quiz Assignment step (step 3)
      if (activeStep === 2 && !createdStudyId && !editMode) {
        console.log('Auto-saving study draft before quiz assignment step...');
        try {
          await handleSaveDraft(true); // skipNavigation = true
          console.log('Study draft auto-saved successfully');
        } catch (error) {
          console.error('Failed to auto-save study draft:', error);
          // Still allow navigation even if auto-save fails
        }
      }

      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prevStep) => prevStep - 1);
    }
  };

  const handleStepClick = (stepIndex) => {
    // Allow jumping to any step
    setActiveStep(stepIndex);
  };

  const handleDataChange = (stepData) => {
    setStudyData((prev) => ({
      ...prev,
      ...stepData,
    }));
  };

  // Save questions to backend
  const saveQuestionsToBackend = async (studyId, questions) => {
    console.log('=== SAVING QUESTIONS TO BACKEND ===');
    console.log('Study ID:', studyId);
    console.log('Questions to save:', questions);
    
    if (!studyId || !questions || questions.length === 0) {
      console.log('No questions to save - returning success');
      return { success: true, message: 'No questions to save', updatedQuestions: questions };
    }

    try {
      const token = localStorage.getItem('token');
      console.log('Using token:', token ? 'Token exists' : 'No token found');
      
      const updatedQuestions = [...questions];
      
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        console.log('Processing question:', question);
        
        // Skip if question has no title
        if (!question.title || !question.title.trim()) {
          console.log('Skipping question with no title');
          continue;
        }

        let questionId = question.id;

        // Create or update question
        if (typeof questionId === 'string' && questionId.startsWith('temp-')) {
          console.log('Creating new question:', question.title);
          
          // Create new question
          const questionPayload = {
            title: question.title,
            description: question.description || '',
            question_type: question.question_type || 'comparison',
            display_order: question.display_order
          };
          
          console.log('Question payload:', questionPayload);
          
          const questionResponse = await fetch(`/api/studies/${studyId}/questions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(questionPayload)
          });

          console.log('Question response status:', questionResponse.status);
          
          if (!questionResponse.ok) {
            if (questionResponse.status === 409) {
              // Question already exists, get the existing question ID
              const conflictData = await questionResponse.json();
              console.log('Question already exists:', conflictData);
              if (conflictData.existingQuestion) {
                questionId = conflictData.existingQuestion.id;
                console.log('Using existing question ID:', questionId);
                // Update the question in our local array with the real ID
                updatedQuestions[i] = { ...question, id: questionId };
              } else {
                console.error('Question exists but no existing question data returned');
                continue;
              }
            } else {
              const errorText = await questionResponse.text();
              console.error('Failed to create question:', errorText);
              console.error('Response status:', questionResponse.status);
              continue;
            }
          } else {
            const questionData = await questionResponse.json();
            console.log('Question created successfully:', questionData);
            questionId = questionData.question?.id || questionData.id;
            
            // Update the question in our local array with the real ID
            updatedQuestions[i] = { ...question, id: questionId };
          }
        }

        // Save artifacts
        if (question.artifacts && question.artifacts.length > 0) {
          console.log('Saving artifacts for question:', questionId, question.artifacts);
          for (const artifact of question.artifacts) {
            try {
              const artifactResponse = await fetch(`/api/studies/${studyId}/questions/${questionId}/artifacts`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  artifact_id: artifact.artifact_id,
                  display_order: artifact.display_order
                })
              });
              
              if (!artifactResponse.ok) {
                const errorText = await artifactResponse.text();
                console.error('Failed to add artifact:', errorText);
              } else {
                console.log('Artifact added successfully');
              }
            } catch (error) {
              console.error('Failed to add artifact:', error);
            }
          }
        }

        // Save criteria
        if (question.criteria && question.criteria.length > 0) {
          console.log('Saving criteria for question:', questionId, question.criteria);
          for (const criterion of question.criteria) {
            // Skip if criterion has no name
            if (!criterion.name || !criterion.name.trim()) {
              console.log('Skipping criterion with no name');
              continue;
            }

            try {
              const criterionResponse = await fetch(`/api/studies/${studyId}/questions/${questionId}/criteria`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  name: criterion.name,
                  type: criterion.type || 'custom',
                  scale: criterion.scale || 'stars_5',
                  description: criterion.description || '',
                  display_order: criterion.display_order
                })
              });
              
              if (!criterionResponse.ok) {
                if (criterionResponse.status === 409) {
                  // Criterion already exists, this is expected behavior
                  const conflictData = await criterionResponse.json();
                  console.log('Criterion already exists:', conflictData);
                } else {
                  const errorText = await criterionResponse.text();
                  console.error('Failed to add criterion:', errorText);
                }
              } else {
                console.log('Criterion added successfully');
              }
            } catch (error) {
              console.error('Failed to add criterion:', error);
            }
          }
        }
      }

      console.log('=== ALL QUESTIONS SAVED SUCCESSFULLY ===');
      return { success: true, message: 'Questions saved successfully', updatedQuestions };
    } catch (error) {
      console.error('=== ERROR SAVING QUESTIONS ===');
      console.error('Error details:', error);
      return { success: false, message: error.message, updatedQuestions: questions };
    }
  };

  const handleSaveDraft = async (skipNavigation = false) => {
    // Prepare study data for API (moved outside try block for error logging)
    let draftData = null;
    
    try {
      setIsSaving(true);
      
      // Validate required fields
      if (!studyData.title || studyData.title.trim() === '') {
        toast.error('Please enter a study title before saving');
        setIsSaving(false);
        return null;
      }
      
      if (!studyData.description || studyData.description.trim() === '') {
        toast.error('Please enter a study description before saving');
        setIsSaving(false);
        return null;
      }
      
      // Prepare study data for API
      draftData = {
        title: studyData.title.trim(),
        description: studyData.description.trim(),
        status: 'draft'
      };
      // Only include optional fields if provided to avoid backend validation on null
      if (studyData.deadline) {
        // Convert datetime-local value to ISO string with local timezone
        // datetime-local gives us "YYYY-MM-DDTHH:mm" in local time
        // We append seconds and convert to Date, then format with timezone offset
        const dt = new Date(studyData.deadline + ':00'); // Add seconds
        const offset = -dt.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
        const offsetMins = (Math.abs(offset) % 60).toString().padStart(2, '0');
        const offsetSign = offset >= 0 ? '+' : '-';
        // Format as ISO 8601 with timezone: "YYYY-MM-DDTHH:mm:ss+HH:mm"
        draftData.deadline = studyData.deadline + ':00' + offsetSign + offsetHours + ':' + offsetMins;
      }
      if (studyData.participant_capacity) {
        draftData.participant_capacity = studyData.participant_capacity;
      }

      let studyIdToUse = createdStudyId;

      // Update existing study or create new one
      if (editMode && createdStudyId) {
        // Update existing study
        const response = await studyService.updateStudy(createdStudyId, draftData);
        if (!skipNavigation) {
          toast.success('Study updated successfully');
        }
      } else if (createdStudyId) {
        // Update existing draft
        const response = await studyService.updateStudy(createdStudyId, draftData);
        if (!skipNavigation) {
          toast.success('Draft updated successfully');
        }
      } else {
        // Create new study
        const response = await studyService.createStudy(draftData);
        // Backend returns { success, message, study }
        const newId = response?.study?.id || response?.id;
        if (newId) {
          setCreatedStudyId(newId);
          studyIdToUse = newId;
        }
        if (!skipNavigation) {
          toast.success('Draft saved successfully');
        }
      }
      
      // Save questions if any exist
      console.log('=== CHECKING QUESTIONS AFTER STUDY SAVE ===');
      console.log('studyData.questions:', studyData.questions);
      console.log('Questions length:', studyData.questions?.length || 0);
      
      if (studyData.questions && studyData.questions.length > 0 && studyIdToUse) {
        console.log('Saving questions to backend...');
        const questionsResult = await saveQuestionsToBackend(studyIdToUse, studyData.questions);
        if (!questionsResult.success) {
          console.warn('Some questions failed to save:', questionsResult.message);
        } else {
          console.log('Questions saved successfully!');
          // Update the study data with the questions that now have real IDs
          if (questionsResult.updatedQuestions) {
            setStudyData(prev => ({ ...prev, questions: questionsResult.updatedQuestions }));
          }
        }
      } else {
        console.log('No questions to save');
      }
      
      // Assign quizzes to study if any are selected
      console.log('=== QUIZ ASSIGNMENT CHECK ===');
      console.log('studyData.selectedQuizIds:', studyData.selectedQuizIds);
      console.log('studyIdToUse:', studyIdToUse);
      console.log('Has quizzes:', studyData.selectedQuizIds && studyData.selectedQuizIds.length > 0);
      
      if (studyData.selectedQuizIds && studyData.selectedQuizIds.length > 0 && studyIdToUse) {
        console.log('=== ASSIGNING QUIZZES TO STUDY ===');
        console.log('Selected quiz IDs:', studyData.selectedQuizIds);
        console.log('Study ID:', studyIdToUse);
        try {
          const assignResult = await studyService.assignQuizzesToStudy(studyIdToUse, studyData.selectedQuizIds);
          console.log('Quiz assignment result:', assignResult);
          if (assignResult.success) {
            console.log('✅ Quizzes assigned successfully!');
            toast.success(`${assignResult.assignedCount || studyData.selectedQuizIds.length} quiz(zes) assigned to study`);
          } else {
            console.error('❌ Quiz assignment failed:', assignResult.message);
            toast.error('Failed to assign quizzes: ' + (assignResult.message || 'Unknown error'));
          }
        } catch (error) {
          console.error('❌ Failed to assign quizzes:', error);
          console.error('Error response:', error.response?.data);
          toast.error('Failed to assign quizzes. Please try again.');
        }
      } else {
        console.log('⚠️ No quizzes to assign - selectedQuizIds is empty or studyIdToUse is missing');
      }
      
      setLastSaved(new Date());
      
      // Navigate to studies page after saving (unless skipped for activation)
      if (!skipNavigation && onComplete) {
        onComplete();
      }
      
      // Return the study ID for activation
      return studyIdToUse;
    } catch (error) {
      console.error('=== SAVE DRAFT ERROR ===');
      console.error('Full error:', error);
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      console.error('Study data sent:', draftData);
      
      // Show detailed validation errors if available
      let errorMessage = 'Failed to save draft';
      if (error.response?.data?.details) {
        const details = error.response.data.details;
        const errorList = Object.entries(details).map(([field, msg]) => `${field}: ${msg}`).join(', ');
        errorMessage = `Validation failed: ${errorList}`;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      toast.error(errorMessage);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <BasicInformationForm
            data={studyData}
            onChange={handleDataChange}
            onNext={handleNext}
          />
        );
      case 1:
        return (
          <Box>
            <EnhancedQuestionBuilder
              studyId={createdStudyId}
              questions={studyData.questions}
              onQuestionsChange={(questions) => handleDataChange({ questions })}
            />
            {createdStudyId && studyData.questions && studyData.questions.length > 0 && (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  💡 Tip: Save your questions to the database before activating the study
                </Typography>
                <Button
                  variant="contained"
                  onClick={async () => {
                    try {
                      setIsSaving(true);
                      const result = await saveQuestionsToBackend(createdStudyId, studyData.questions);
                      if (result.success) {
                        toast.success('Questions saved successfully!');
                        setLastSaved(new Date());
                        // Update the study data with the questions that now have real IDs
                        if (result.updatedQuestions) {
                          setStudyData(prev => ({ ...prev, questions: result.updatedQuestions }));
                        }
                      } else {
                        toast.error('Failed to save some questions');
                      }
                    } catch (error) {
                      toast.error('Failed to save questions');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving Questions...' : 'Save Questions'}
                </Button>
              </Box>
            )}
          </Box>
        );
      case 2:
        return (
          <StudyConfigurationForm
            data={studyData}
            onChange={handleDataChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <QuizAssignmentStep
            studyId={createdStudyId}
            selectedQuizIds={studyData.selectedQuizIds || []}
            onQuizSelectionChange={(quizIds) => handleDataChange({ selectedQuizIds: quizIds })}
            onBack={handleBack}
            onNext={handleNext}
          />
        );
      case 4:
        return (
          <ReviewAndLaunchPanel
            data={{ ...studyData, id: createdStudyId }}
            onBack={handleBack}
            onSaveDraft={handleSaveDraft}
            onComplete={onComplete}
            editMode={editMode}
          />
        );
      default:
        return 'Unknown step';
    }
  };

  // Show loading while checking authorization or loading study
  if (authLoading || loadingStudy) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
        {loadingStudy && (
          <Typography sx={{ ml: 2 }}>Loading study data...</Typography>
        )}
      </Box>
    );
  }

  // Show error if not authorized
  if (!isResearcher) {
    return (
      <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', py: 4 }}>
        <Alert severity="error">
          Only researchers can create studies. Please contact an administrator if you need researcher access.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          {editMode ? 'Edit Study' : 'Create New Study'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {editMode ? 'Update your study configuration' : 'Follow the steps below to configure your study'}
          </Typography>
          {isSaving && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Saving...
              </Typography>
            </Box>
          )}
          {lastSaved && !isSaving && (
            <Typography variant="caption" color="text.secondary">
              Last saved: {lastSaved.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Progress Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel
                sx={{ cursor: 'pointer' }}
                onClick={() => handleStepClick(index)}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step Content */}
      <Paper sx={{ p: 4, minHeight: 400 }}>
        {getStepContent(activeStep)}
      </Paper>

      {/* Navigation Buttons (shown for non-final steps) */}
      {activeStep < steps.length - 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={handleBack}
            disabled={activeStep === 0}
          >
            Back
          </Button>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Save />}
              onClick={handleSaveDraft}
              disabled={isSaving}
            >
              Save Draft
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              onClick={handleNext}
            >
              Next
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default CreateStudyWizard;
