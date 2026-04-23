import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Alert
} from '@mui/material';
import { Quiz, Save, Publish, AutoAwesome, Add, Delete, Edit } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import quizService from '../../services/quizService';
import AIQuizGenerationDialog from './AIQuizGenerationDialog';
import AIQuizPreview from './AIQuizPreview';

const CreateQuizDialog = ({ open, onClose, onCreateSuccess, studyId }) => {
  const [creating, setCreating] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [badges, setBadges] = useState([]);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [skipBadges, setSkipBadges] = useState([null]);
  const [awardBadges, setAwardBadges] = useState([null]);
  const [applySameBadges, setApplySameBadges] = useState(false);
  const [showSkipBadgeForm, setShowSkipBadgeForm] = useState(false);
  const [showAwardBadgeForm, setShowAwardBadgeForm] = useState(false);
  const [newBadgeName, setNewBadgeName] = useState('');
  const [newBadgeDescription, setNewBadgeDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    type: 'multiple',
    title: '',
    options: ['', ''],
    correctAnswer: '',
    isAbsolute: false,
    pointWeight: 1
  });
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showAIPreview, setShowAIPreview] = useState(false);
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState([]);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      description: '',
      isAIGenerated: false,
      isSkippable: false,
      isPassable: false,
      isGivingBadges: false,
      passingScore: 70
    }
  });

  const isSkippable = watch('isSkippable');
  const isGivingBadges = watch('isGivingBadges');

  const steps = ['Basic Info', 'Badge Settings', 'Questions'];

  // Fetch badges when dialog opens
  useEffect(() => {
    if (open) {
      fetchBadges();
    }
  }, [open]);

  // Apply same badges logic
  useEffect(() => {
    if (applySameBadges) {
      setAwardBadges([...skipBadges]);
    }
  }, [applySameBadges, skipBadges]);

  const fetchBadges = async () => {
    setLoadingBadges(true);
    try {
      const result = await quizService.getBadges();
      if (result.success) {
        setBadges(result.badges);
      }
    } catch (error) {
      console.error('Error fetching badges:', error);
      toast.error('Failed to load badges');
    } finally {
      setLoadingBadges(false);
    }
  };

  const handleCreateBadge = async (type) => {
    if (!newBadgeName.trim()) {
      toast.error('Badge name is required');
      return;
    }

    try {
      const response = await fetch('/api/badges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: newBadgeName.trim(),
          description: newBadgeDescription.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Badge created successfully');
        // Add new badge to list
        setBadges([...badges, data.badge]);
        
        // Auto-select the new badge
        if (type === 'skip') {
          const newSkipBadges = [...skipBadges];
          newSkipBadges[newSkipBadges.length - 1] = data.badge.id;
          setSkipBadges(newSkipBadges);
          setShowSkipBadgeForm(false);
        } else {
          const newAwardBadges = [...awardBadges];
          newAwardBadges[newAwardBadges.length - 1] = data.badge.id;
          setAwardBadges(newAwardBadges);
          setShowAwardBadgeForm(false);
        }
        
        // Reset form
        setNewBadgeName('');
        setNewBadgeDescription('');
      } else {
        toast.error(data.message || 'Failed to create badge');
      }
    } catch (error) {
      console.error('Error creating badge:', error);
      toast.error('Failed to create badge');
    }
  };

  const handleClose = () => {
    if (!creating) {
      reset();
      setActiveStep(0);
      setSkipBadges([null]);
      setAwardBadges([null]);
      setApplySameBadges(false);
      setQuestions([]);
      setEditingQuestion(null);
      setQuestionForm({
        type: 'multiple',
        title: '',
        options: ['', ''],
        correctAnswer: '',
        isAbsolute: false,
        pointWeight: 1
      });
      onClose();
    }
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const addQuestion = () => {
    if (!questionForm.title.trim()) {
      toast.error('Question title is required');
      return;
    }

    if (questionForm.type === 'multiple') {
      const validOptions = questionForm.options.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        toast.error('Multiple choice questions need at least 2 options');
        return;
      }
      if (!questionForm.correctAnswer) {
        toast.error('Please select the correct answer');
        return;
      }
    }

    const newQuestion = {
      ...questionForm,
      id: Date.now(), // temporary ID for UI
      orderIndex: questions.length
    };

    if (editingQuestion !== null) {
      const updated = [...questions];
      updated[editingQuestion] = newQuestion;
      setQuestions(updated);
      setEditingQuestion(null);
    } else {
      setQuestions([...questions, newQuestion]);
    }

    // Reset form
    setQuestionForm({
      type: 'multiple',
      title: '',
      options: ['', ''],
      correctAnswer: '',
      isAbsolute: false,
      pointWeight: 1
    });
  };

  const editQuestion = (index) => {
    const q = questions[index];
    
    // Handle correctAnswer - it might be the actual text (from AI) or an index (from manual entry)
    let correctAnswerValue = q.correctAnswer;
    if (q.type === 'multiple' && q.options && q.correctAnswer) {
      // Check if correctAnswer is already an index
      const isIndex = /^\d+$/.test(q.correctAnswer);
      if (!isIndex) {
        // It's the actual answer text, find its index
        const answerIndex = q.options.findIndex(opt => opt === q.correctAnswer);
        correctAnswerValue = answerIndex >= 0 ? answerIndex.toString() : '';
      }
    }
    
    setQuestionForm({
      ...q,
      options: q.options || ['', ''],
      correctAnswer: correctAnswerValue
    });
    setEditingQuestion(index);
  };

  const deleteQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const cancelEditQuestion = () => {
    setEditingQuestion(null);
    setQuestionForm({
      type: 'multiple',
      title: '',
      options: ['', ''],
      correctAnswer: '',
      isAbsolute: false,
      pointWeight: 1
    });
  };

  const onSubmit = async (data, shouldPublish = false) => {
    if (questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    setCreating(true);
    
    try {
      // Filter out null values from badge arrays
      const requiredBadges = skipBadges.filter(id => id !== null);
      const awardedBadges = awardBadges.filter(id => id !== null);

      const quizData = {
        studyId: studyId || null,
        title: data.title,
        description: data.description,
        isAIGenerated: data.isAIGenerated,
        isSkippable: data.isSkippable,
        isPassable: data.isPassable,
        isGivingBadges: data.isGivingBadges,
        passingScore: data.passingScore,
        requiredBadges: requiredBadges,
        awardedBadges: awardedBadges
      };

      const result = await quizService.createQuiz(quizData);

      if (result.success) {
        // Add questions to the quiz
        try {
          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const filteredOptions = q.type === 'multiple' ? q.options.filter(opt => opt.trim()) : null;
            
            // Convert correctAnswer from index to actual text if needed
            let correctAnswerText = null;
            if (q.type === 'multiple' && q.correctAnswer !== null && q.correctAnswer !== '') {
              // Check if correctAnswer is an index (number string) or already the text
              const isIndex = /^\d+$/.test(q.correctAnswer);
              if (isIndex && filteredOptions) {
                const idx = parseInt(q.correctAnswer, 10);
                correctAnswerText = filteredOptions[idx] || q.correctAnswer;
              } else {
                correctAnswerText = q.correctAnswer;
              }
            }
            
            const questionData = {
              type: q.type,
              title: q.title,
              options: filteredOptions,
              correctAnswer: correctAnswerText,
              isAbsolute: q.type === 'multiple' ? q.isAbsolute : false,
              pointWeight: q.pointWeight,
              orderIndex: i
            };

            await quizService.addQuestion(result.quiz.id, questionData);
          }
        } catch (questionError) {
          console.error('Error adding questions:', questionError);
          toast.error('Quiz created but failed to add questions. Please edit the quiz to add questions.');
          onCreateSuccess(result.quiz);
          handleClose();
          return;
        }

        // If should publish, publish the quiz immediately
        if (shouldPublish) {
          try {
            const publishResult = await quizService.publishQuiz(result.quiz.id);
            if (publishResult.success) {
              toast.success('Quiz created and published successfully!');
            } else {
              toast.error('Quiz created but failed to publish: ' + (publishResult.message || 'Unknown error'));
            }
          } catch (publishError) {
            console.error('Error publishing quiz:', publishError);
            toast.error('Quiz created but failed to publish. You can publish it later.');
          }
        } else {
          toast.success('Quiz created as draft');
        }
        
        onCreateSuccess(result.quiz);
        handleClose();
      } else {
        toast.error(result.message || 'Failed to create quiz');
      }
    } catch (error) {
      console.error('Create quiz error:', error);
      toast.error('Failed to create quiz: ' + (error.response?.data?.message || error.message || 'Please try again.'));
    } finally {
      setCreating(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Title Field */}
            <Controller
              name="title"
              control={control}
              rules={{ required: 'Title is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Quiz Title *"
                  fullWidth
                  error={!!errors.title}
                  helperText={errors.title?.message}
                  disabled={creating}
                />
              )}
            />

            {/* Description Field */}
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Description (optional)"
                  multiline
                  rows={3}
                  fullWidth
                  disabled={creating}
                />
              )}
            />

            {/* Passing Score */}
            <Controller
              name="passingScore"
              control={control}
              rules={{ 
                required: 'Passing score is required',
                min: { value: 0, message: 'Score must be at least 0' },
                max: { value: 100, message: 'Score cannot exceed 100' }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Passing Score (%) *"
                  type="number"
                  fullWidth
                  error={!!errors.passingScore}
                  helperText={errors.passingScore?.message || 'Percentage required to pass the quiz'}
                  disabled={creating}
                  inputProps={{ min: 0, max: 100 }}
                />
              )}
            />

            {/* AI Generation Button */}
            <Box>
              <Button
                variant="outlined"
                startIcon={<AutoAwesome />}
                disabled={creating}
                fullWidth
                sx={{ mb: 2 }}
                onClick={() => setShowAIDialog(true)}
              >
                Generate via AI
              </Button>
              <Typography variant="caption" color="text.secondary">
                Use AI to automatically generate quiz questions based on your title and description
              </Typography>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Configure badge requirements and rewards for this quiz.
            </Typography>

            {/* Allow Skip with Badges */}
            <Box>
              <Controller
                name="isSkippable"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Checkbox {...field} checked={field.value} disabled={creating} />}
                    label="Allow participants to skip this quiz with badges"
                  />
                )}
              />
              
              {isSkippable && (
                <Box sx={{ ml: 4, mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Participants must have ALL selected badges to skip this quiz
                  </Typography>
                  
                  {skipBadges.map((badgeId, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Select Badge</InputLabel>
                        <Select
                          value={badgeId || ''}
                          onChange={(e) => {
                            const newSkipBadges = [...skipBadges];
                            newSkipBadges[index] = e.target.value;
                            setSkipBadges(newSkipBadges);
                          }}
                          label="Select Badge"
                          disabled={creating || loadingBadges}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {badges.map((badge) => (
                            <MenuItem key={badge.id} value={badge.id}>
                              {badge.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      
                      {skipBadges.length > 1 && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            const newSkipBadges = skipBadges.filter((_, i) => i !== index);
                            setSkipBadges(newSkipBadges);
                          }}
                          disabled={creating}
                        >
                          <Delete />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                  
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => setSkipBadges([...skipBadges, null])}
                    disabled={creating}
                    sx={{ mt: 1 }}
                  >
                    Add Badge
                  </Button>

                  {!showSkipBadgeForm ? (
                    <Button
                      size="small"
                      startIcon={<Add />}
                      onClick={() => setShowSkipBadgeForm(true)}
                      disabled={creating}
                      sx={{ mt: 1, ml: 1 }}
                      variant="outlined"
                    >
                      Create New Badge
                    </Button>
                  ) : (
                    <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                        Create New Badge
                      </Typography>
                      <TextField
                        label="Badge Name"
                        value={newBadgeName}
                        onChange={(e) => setNewBadgeName(e.target.value)}
                        fullWidth
                        size="small"
                        sx={{ mb: 2 }}
                      />
                      <TextField
                        label="Description (optional)"
                        value={newBadgeDescription}
                        onChange={(e) => setNewBadgeDescription(e.target.value)}
                        fullWidth
                        size="small"
                        multiline
                        rows={2}
                        sx={{ mb: 2 }}
                      />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleCreateBadge('skip')}
                        >
                          Add Badge
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setShowSkipBadgeForm(false);
                            setNewBadgeName('');
                            setNewBadgeDescription('');
                          }}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            {/* Badge Rewards */}
            <Box>
              <Controller
                name="isGivingBadges"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Checkbox {...field} checked={field.value} disabled={creating} />}
                    label="Award badges upon passing"
                  />
                )}
              />
              
              {isGivingBadges && (
                <Box sx={{ ml: 4, mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={applySameBadges}
                        onChange={(e) => setApplySameBadges(e.target.checked)}
                        disabled={creating || !isSkippable}
                      />
                    }
                    label="Apply same badges as skip requirements"
                    sx={{ mb: 2 }}
                  />
                  
                  {!applySameBadges && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Select badges to award upon passing
                      </Typography>
                      
                      {awardBadges.map((badgeId, index) => (
                        <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Select Badge</InputLabel>
                            <Select
                              value={badgeId || ''}
                              onChange={(e) => {
                                const newAwardBadges = [...awardBadges];
                                newAwardBadges[index] = e.target.value;
                                setAwardBadges(newAwardBadges);
                              }}
                              label="Select Badge"
                              disabled={creating || loadingBadges}
                            >
                              <MenuItem value="">
                                <em>None</em>
                              </MenuItem>
                              {badges.map((badge) => (
                                <MenuItem key={badge.id} value={badge.id}>
                                  {badge.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          
                          {awardBadges.length > 1 && (
                            <IconButton
                              size="small"
                              onClick={() => {
                                const newAwardBadges = awardBadges.filter((_, i) => i !== index);
                                setAwardBadges(newAwardBadges);
                              }}
                              disabled={creating}
                            >
                              <Delete />
                            </IconButton>
                          )}
                        </Box>
                      ))}
                      
                      <Button
                        size="small"
                        startIcon={<Add />}
                        onClick={() => setAwardBadges([...awardBadges, null])}
                        disabled={creating}
                        sx={{ mt: 1 }}
                      >
                        Add Badge
                      </Button>

                      {!showAwardBadgeForm ? (
                        <Button
                          size="small"
                          startIcon={<Add />}
                          onClick={() => setShowAwardBadgeForm(true)}
                          disabled={creating}
                          sx={{ mt: 1, ml: 1 }}
                          variant="outlined"
                        >
                          Create New Badge
                        </Button>
                      ) : (
                        <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                            Create New Badge
                          </Typography>
                          <TextField
                            label="Badge Name"
                            value={newBadgeName}
                            onChange={(e) => setNewBadgeName(e.target.value)}
                            fullWidth
                            size="small"
                            sx={{ mb: 2 }}
                          />
                          <TextField
                            label="Description (optional)"
                            value={newBadgeDescription}
                            onChange={(e) => setNewBadgeDescription(e.target.value)}
                            fullWidth
                            size="small"
                            multiline
                            rows={2}
                            sx={{ mb: 2 }}
                          />
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleCreateBadge('award')}
                            >
                              Add Badge
                            </Button>
                            <Button
                              size="small"
                              onClick={() => {
                                setShowAwardBadgeForm(false);
                                setNewBadgeName('');
                                setNewBadgeDescription('');
                              }}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                  
                  {applySameBadges && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Same badges as skip requirements will be awarded
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Add questions to your quiz. At least one question is required.
            </Typography>

            {/* Question List */}
            {questions.length > 0 && (
              <Box sx={{ mb: 2 }}>
                {questions.map((q, index) => (
                  <Box
                    key={q.id}
                    sx={{
                      p: 2,
                      mb: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start'
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="bold">
                          Q{index + 1}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            px: 1,
                            py: 0.25,
                            bgcolor: 'primary.main',
                            color: 'white',
                            borderRadius: 1
                          }}
                        >
                          {q.type === 'multiple' ? 'Multiple Choice' : q.type === 'open' ? 'Open-Ended' : 'Code'}
                        </Typography>
                        {q.isAbsolute && (
                          <Typography
                            variant="caption"
                            sx={{
                              px: 1,
                              py: 0.25,
                              bgcolor: 'error.main',
                              color: 'white',
                              borderRadius: 1
                            }}
                          >
                            Required
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {q.pointWeight} {q.pointWeight === 1 ? 'point' : 'points'}
                        </Typography>
                      </Box>
                      <Typography variant="body2">{q.title}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => editQuestion(index)} disabled={creating} title="Edit question">
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteQuestion(index)} disabled={creating} title="Delete question">
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {/* Question Form */}
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                {editingQuestion !== null ? 'Edit Question' : 'Add New Question'}
              </Typography>

              {/* Question Type */}
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Question Type</InputLabel>
                <Select
                  value={questionForm.type}
                  onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value, options: e.target.value === 'multiple' ? ['', ''] : [], correctAnswer: '' })}
                  label="Question Type"
                  disabled={creating}
                >
                  <MenuItem value="multiple">Multiple Choice</MenuItem>
                  <MenuItem value="open">Open-Ended</MenuItem>
                  <MenuItem value="code">Code</MenuItem>
                </Select>
              </FormControl>

              {/* Question Title */}
              <TextField
                label="Question Text *"
                multiline
                rows={2}
                fullWidth
                value={questionForm.title}
                onChange={(e) => setQuestionForm({ ...questionForm, title: e.target.value })}
                disabled={creating}
                sx={{ mb: 2 }}
              />

              {/* Multiple Choice Options */}
              {questionForm.type === 'multiple' && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>Options</Typography>
                  {questionForm.options.map((option, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...questionForm.options];
                          newOptions[index] = e.target.value;
                          setQuestionForm({ ...questionForm, options: newOptions });
                        }}
                        disabled={creating}
                      />
                      {questionForm.options.length > 2 && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            const newOptions = questionForm.options.filter((_, i) => i !== index);
                            setQuestionForm({ ...questionForm, options: newOptions });
                          }}
                          disabled={creating}
                        >
                          <Delete />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => setQuestionForm({ ...questionForm, options: [...questionForm.options, ''] })}
                    disabled={creating}
                  >
                    Add Option
                  </Button>

                  {/* Correct Answer Selection */}
                  <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                    <InputLabel>Correct Answer</InputLabel>
                    <Select
                      value={questionForm.correctAnswer}
                      onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                      label="Correct Answer"
                      disabled={creating}
                    >
                      {questionForm.options.map((option, index) => (
                        option.trim() && (
                          <MenuItem key={index} value={index.toString()}>
                            Option {index + 1}: {option}
                          </MenuItem>
                        )
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}

              {/* Point Weight */}
              <TextField
                label="Point Weight"
                type="number"
                size="small"
                value={questionForm.pointWeight}
                onChange={(e) => setQuestionForm({ ...questionForm, pointWeight: parseInt(e.target.value) || 1 })}
                disabled={creating}
                inputProps={{ min: 1 }}
                sx={{ mb: 2, width: 150 }}
              />

              {/* Is Absolute (only for multiple choice) */}
              {questionForm.type === 'multiple' && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={questionForm.isAbsolute}
                      onChange={(e) => setQuestionForm({ ...questionForm, isAbsolute: e.target.checked })}
                      disabled={creating}
                    />
                  }
                  label="Required question (must be answered correctly to pass)"
                />
              )}

              {/* Add/Update Question Button */}
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={addQuestion}
                  disabled={creating}
                  startIcon={editingQuestion !== null ? <Save /> : <Add />}
                >
                  {editingQuestion !== null ? 'Update Question' : 'Add Question'}
                </Button>
                {editingQuestion !== null && (
                  <Button onClick={cancelEditQuestion} disabled={creating}>
                    Cancel
                  </Button>
                )}
              </Box>
            </Box>

            {questions.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No questions added yet. Add your first question above.
              </Typography>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Quiz />
          Create Quiz
        </Box>
      </DialogTitle>
      
      <form onSubmit={handleSubmit((data) => onSubmit(data, false))}>
        <DialogContent>
          {!studyId && (
            <Alert severity="info" sx={{ mb: 3 }}>
              This quiz will be created without a study assignment. You can assign it to a study later during study creation.
            </Alert>
          )}
          
          <Box sx={{ mb: 3 }}>
            <Stepper activeStep={activeStep}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>

          {renderStepContent(activeStep)}

          {creating && (
            <Box sx={{ mt: 3 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Creating quiz...
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          
          {activeStep > 0 && (
            <Button onClick={handleBack} disabled={creating}>
              Back
            </Button>
          )}
          
          {activeStep < steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={creating}
            >
              Next
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                type="submit"
                variant="outlined"
                disabled={creating || questions.length === 0}
                startIcon={<Save />}
              >
                Save as Draft
              </Button>
              <Button
                variant="contained"
                disabled={creating || questions.length === 0}
                startIcon={<Publish />}
                onClick={handleSubmit((data) => onSubmit(data, true))}
              >
                Save & Publish
              </Button>
            </Box>
          )}
        </DialogActions>
      </form>

      {/* AI Quiz Generation Dialog */}
      <AIQuizGenerationDialog
        open={showAIDialog}
        onClose={() => setShowAIDialog(false)}
        onGenerated={(generatedQuiz) => {
          const questions = generatedQuiz?.questions || [];
          if (questions.length > 0) {
            // Close generation dialog first
            setShowAIDialog(false);
            // Then set questions and open preview
            setAiGeneratedQuestions(questions);
            setShowAIPreview(true);
          } else {
            toast.error('No questions generated');
          }
        }}
        quizTitle={watch('title')}
        quizDescription={watch('description')}
      />

      {/* AI Quiz Preview Dialog */}
      <AIQuizPreview
        open={showAIPreview}
        onClose={() => {
          setShowAIPreview(false);
          setAiGeneratedQuestions([]);
        }}
        onAccept={(acceptedQuestions) => {
          // Add AI-generated questions to the quiz
          const newQuestions = acceptedQuestions.map((q, index) => ({
            ...q,
            id: Date.now() + index, // temporary ID for UI
            orderIndex: questions.length + index
          }));
          setQuestions([...questions, ...newQuestions]);
          setShowAIPreview(false);
          setAiGeneratedQuestions([]);
          toast.success(`${newQuestions.length} questions added to quiz`);
          
          // Move to questions step if not already there
          if (activeStep < 2) {
            setActiveStep(2);
          }
        }}
        generatedQuestions={aiGeneratedQuestions}
      />
    </Dialog>
  );
};

export default CreateQuizDialog;
