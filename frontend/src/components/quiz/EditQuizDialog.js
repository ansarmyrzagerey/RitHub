import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Stepper,
  Step,
  StepLabel,
  Radio,
  RadioGroup
} from '@mui/material';
import { Close, Edit, Save, Add, Delete, ArrowBack, ArrowForward } from '@mui/icons-material';
import toast from 'react-hot-toast';
import quizService from '../../services/quizService';

const EditQuizDialog = ({ open, onClose, quiz, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [badges, setBadges] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    type: 'multiple',
    title: '',
    options: ['', ''],
    correctAnswer: '',
    isAbsolute: false,
    pointWeight: 1
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    passingScore: 70,
    isSkippable: false,
    isGivingBadges: false,
    requiredBadges: [],
    awardedBadges: []
  });
  const [errors, setErrors] = useState({});

  const steps = ['Basic Info', 'Badge Settings', 'Questions'];


  useEffect(() => {
    if (open && quiz) {
      setActiveStep(0);
      loadQuizData();
      loadBadges();
    }
  }, [open, quiz]);

  const loadBadges = async () => {
    try {
      const data = await quizService.getBadges();
      setBadges(data.badges || []);
    } catch (error) {
      console.error('Error loading badges:', error);
    }
  };

  const loadQuizData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [requiredRes, awardedRes, questionsData] = await Promise.all([
        fetch(`/api/quizzes/${quiz.id}/required-badges`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/quizzes/${quiz.id}/awarded-badges`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        quizService.getQuestions(quiz.id)
      ]);

      const requiredData = await requiredRes.json();
      const awardedData = await awardedRes.json();

      setFormData({
        title: quiz.title || '',
        description: quiz.description || '',
        passingScore: quiz.passing_score || 70,
        isSkippable: quiz.is_skippable || false,
        isGivingBadges: quiz.is_giving_badges || false,
        requiredBadges: (requiredData.badges || []).map(b => b.id),
        awardedBadges: (awardedData.badges || []).map(b => b.id)
      });

      // Load existing questions
      const loadedQuestions = (questionsData.questions || []).map(q => ({
        id: q.id,
        type: q.type,
        title: q.title,
        options: q.options || ['', ''],
        correctAnswer: q.correct_answer || '',
        isAbsolute: q.is_absolute || false,
        pointWeight: q.point_weight || 1,
        orderIndex: q.order_index || 0,
        isExisting: true // Mark as existing question from DB
      }));
      setQuestions(loadedQuestions);
    } catch (error) {
      console.error('Error loading quiz data:', error);
      toast.error('Failed to load quiz data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleBadgeChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: typeof value === 'string' ? value.split(',') : value }));
  };

  const handleQuestionFormChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setQuestionForm(prev => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index) => (event) => {
    const newOptions = [...questionForm.options];
    newOptions[index] = event.target.value;
    setQuestionForm(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    setQuestionForm(prev => ({ ...prev, options: [...prev.options, ''] }));
  };

  const removeOption = (index) => {
    if (questionForm.options.length <= 2) return;
    const newOptions = questionForm.options.filter((_, i) => i !== index);
    let newCorrectAnswer = questionForm.correctAnswer;
    if (questionForm.correctAnswer === index.toString()) {
      newCorrectAnswer = '';
    } else if (parseInt(questionForm.correctAnswer) > index) {
      newCorrectAnswer = (parseInt(questionForm.correctAnswer) - 1).toString();
    }
    setQuestionForm(prev => ({ ...prev, options: newOptions, correctAnswer: newCorrectAnswer }));
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      type: 'multiple',
      title: '',
      options: ['', ''],
      correctAnswer: '',
      isAbsolute: false,
      pointWeight: 1
    });
    setEditingQuestionIndex(null);
  };


  const addOrUpdateQuestion = () => {
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
      if (questionForm.correctAnswer === '' || questionForm.correctAnswer === null) {
        toast.error('Please select the correct answer');
        return;
      }
    }

    const newQuestion = {
      ...questionForm,
      id: editingQuestionIndex !== null ? questions[editingQuestionIndex].id : `temp_${Date.now()}`,
      orderIndex: editingQuestionIndex !== null ? questions[editingQuestionIndex].orderIndex : questions.length,
      isExisting: editingQuestionIndex !== null ? questions[editingQuestionIndex].isExisting : false,
      isModified: editingQuestionIndex !== null ? questions[editingQuestionIndex].isExisting : false
    };

    if (editingQuestionIndex !== null) {
      const updated = [...questions];
      updated[editingQuestionIndex] = newQuestion;
      setQuestions(updated);
    } else {
      setQuestions([...questions, newQuestion]);
    }

    resetQuestionForm();
  };

  const editQuestion = (index) => {
    const q = questions[index];
    let correctAnswerValue = q.correctAnswer;
    
    // Convert correct answer text to index for multiple choice
    if (q.type === 'multiple' && q.options && q.correctAnswer) {
      const isIndex = /^\d+$/.test(q.correctAnswer);
      if (!isIndex) {
        const answerIndex = q.options.findIndex(opt => opt === q.correctAnswer);
        correctAnswerValue = answerIndex >= 0 ? answerIndex.toString() : '';
      }
    }

    setQuestionForm({
      type: q.type,
      title: q.title,
      options: q.options || ['', ''],
      correctAnswer: correctAnswerValue,
      isAbsolute: q.isAbsolute,
      pointWeight: q.pointWeight
    });
    setEditingQuestionIndex(index);
  };

  const deleteQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
    if (editingQuestionIndex === index) {
      resetQuestionForm();
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (formData.passingScore < 0 || formData.passingScore > 100) {
      newErrors.passingScore = 'Passing score must be between 0 and 100';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      setActiveStep(0);
      return;
    }

    if (questions.length === 0) {
      toast.error('Please add at least one question');
      setActiveStep(2);
      return;
    }

    setSaving(true);
    try {
      // Update quiz basic info
      await quizService.updateQuiz(quiz.id, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        passingScore: Number(formData.passingScore),
        isSkippable: formData.isSkippable,
        isGivingBadges: formData.isGivingBadges,
        requiredBadges: formData.requiredBadges,
        awardedBadges: formData.awardedBadges
      });

      // Handle questions - delete removed, update existing, add new
      const existingQuestionIds = questions.filter(q => q.isExisting).map(q => q.id);
      
      // Get original questions to find deleted ones
      const originalQuestions = await quizService.getQuestions(quiz.id);
      const originalIds = (originalQuestions.questions || []).map(q => q.id);
      
      // Delete removed questions
      for (const id of originalIds) {
        if (!existingQuestionIds.includes(id)) {
          await quizService.deleteQuestion(quiz.id, id);
        }
      }

      // Update or add questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const filteredOptions = q.type === 'multiple' ? q.options.filter(opt => opt.trim()) : null;
        
        // Convert correctAnswer from index to text
        let correctAnswerText = null;
        if (q.type === 'multiple' && q.correctAnswer !== null && q.correctAnswer !== '') {
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

        if (q.isExisting) {
          await quizService.updateQuestion(quiz.id, q.id, questionData);
        } else {
          await quizService.addQuestion(quiz.id, questionData);
        }
      }

      toast.success('Quiz updated successfully');
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating quiz:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update quiz';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      resetQuestionForm();
      setActiveStep(0);
      onClose();
    }
  };

  if (!quiz) return null;

  const isConnectedToStudy = quiz.study_id !== null;
  const isPublished = quiz.is_published;
  const canEdit = !isConnectedToStudy && !isPublished;


  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Title"
              value={formData.title}
              onChange={handleChange('title')}
              error={!!errors.title}
              helperText={errors.title}
              fullWidth
              required
              disabled={saving}
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={handleChange('description')}
              multiline
              rows={3}
              fullWidth
              disabled={saving}
            />
            <TextField
              label="Passing Score (%)"
              type="number"
              value={formData.passingScore}
              onChange={handleChange('passingScore')}
              error={!!errors.passingScore}
              helperText={errors.passingScore}
              inputProps={{ min: 0, max: 100 }}
              fullWidth
              disabled={saving}
            />
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isSkippable}
                  onChange={handleChange('isSkippable')}
                  disabled={saving}
                />
              }
              label="Quiz can be skipped with badges"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isGivingBadges}
                  onChange={handleChange('isGivingBadges')}
                  disabled={saving}
                />
              }
              label="Award badges on completion"
            />
            {badges.length > 0 && (
              <>
                <FormControl fullWidth sx={{ mt: 1 }}>
                  <InputLabel>Required Badges to Skip</InputLabel>
                  <Select
                    multiple
                    value={formData.requiredBadges}
                    onChange={handleBadgeChange('requiredBadges')}
                    input={<OutlinedInput label="Required Badges to Skip" />}
                    disabled={saving || !formData.isSkippable}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((id) => {
                          const badge = badges.find(b => b.id === id);
                          return badge ? <Chip key={id} label={badge.name} size="small" /> : null;
                        })}
                      </Box>
                    )}
                  >
                    {badges.map((badge) => (
                      <MenuItem key={badge.id} value={badge.id}>{badge.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {formData.isGivingBadges && (
                  <FormControl fullWidth>
                    <InputLabel>Awarded Badges</InputLabel>
                    <Select
                      multiple
                      value={formData.awardedBadges}
                      onChange={handleBadgeChange('awardedBadges')}
                      input={<OutlinedInput label="Awarded Badges" />}
                      disabled={saving}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((id) => {
                            const badge = badges.find(b => b.id === id);
                            return badge ? <Chip key={id} label={badge.name} size="small" color="secondary" /> : null;
                          })}
                        </Box>
                      )}
                    >
                      {badges.map((badge) => (
                        <MenuItem key={badge.id} value={badge.id}>{badge.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </>
            )}
          </Box>
        );

      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Existing Questions List */}
            {questions.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Questions ({questions.length})
                </Typography>
                {questions.map((q, index) => (
                  <Box
                    key={q.id}
                    sx={{
                      p: 2, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'start',
                      bgcolor: editingQuestionIndex === index ? 'action.selected' : 'transparent'
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="bold">Q{index + 1}</Typography>
                        <Chip
                          label={q.type === 'multiple' ? 'Multiple Choice' : q.type === 'open' ? 'Open-Ended' : 'Code'}
                          size="small" color="primary" variant="outlined"
                        />
                        {q.isAbsolute && <Chip label="Required" size="small" color="error" variant="outlined" />}
                        <Typography variant="caption" color="text.secondary">
                          {q.pointWeight} {q.pointWeight === 1 ? 'pt' : 'pts'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 400 }}>{q.title}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => editQuestion(index)} disabled={saving}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteQuestion(index)} disabled={saving}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            <Divider />

            {/* Question Form */}
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                {editingQuestionIndex !== null ? 'Edit Question' : 'Add New Question'}
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Question Type</InputLabel>
                <Select
                  value={questionForm.type}
                  onChange={handleQuestionFormChange('type')}
                  label="Question Type"
                  disabled={saving}
                >
                  <MenuItem value="multiple">Multiple Choice</MenuItem>
                  <MenuItem value="open">Open-Ended</MenuItem>
                  <MenuItem value="code">Code</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Question"
                value={questionForm.title}
                onChange={handleQuestionFormChange('title')}
                fullWidth
                multiline
                rows={2}
                sx={{ mb: 2 }}
                disabled={saving}
              />

              {questionForm.type === 'multiple' && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>Options (select correct answer):</Typography>
                  <RadioGroup
                    value={questionForm.correctAnswer}
                    onChange={handleQuestionFormChange('correctAnswer')}
                  >
                    {questionForm.options.map((opt, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Radio value={idx.toString()} disabled={saving} />
                        <TextField
                          value={opt}
                          onChange={handleOptionChange(idx)}
                          placeholder={`Option ${idx + 1}`}
                          size="small"
                          fullWidth
                          disabled={saving}
                        />
                        {questionForm.options.length > 2 && (
                          <IconButton size="small" onClick={() => removeOption(idx)} disabled={saving}>
                            <Delete fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                  </RadioGroup>
                  <Button size="small" startIcon={<Add />} onClick={addOption} disabled={saving}>
                    Add Option
                  </Button>
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  label="Points"
                  type="number"
                  value={questionForm.pointWeight}
                  onChange={handleQuestionFormChange('pointWeight')}
                  inputProps={{ min: 1 }}
                  size="small"
                  sx={{ width: 100 }}
                  disabled={saving}
                />
                {questionForm.type === 'multiple' && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={questionForm.isAbsolute}
                        onChange={handleQuestionFormChange('isAbsolute')}
                        disabled={saving}
                      />
                    }
                    label="Must answer correctly to pass"
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={addOrUpdateQuestion}
                  disabled={saving}
                >
                  {editingQuestionIndex !== null ? 'Update Question' : 'Add Question'}
                </Button>
                {editingQuestionIndex !== null && (
                  <Button onClick={resetQuestionForm} disabled={saving}>
                    Cancel
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };


  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit color="primary" />
            <Typography variant="h6">Edit Quiz</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={saving}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : !canEdit ? (
          <Alert severity="warning">
            {isConnectedToStudy 
              ? 'This quiz is connected to a study and cannot be edited.'
              : 'This quiz is published and cannot be edited.'}
          </Alert>
        ) : (
          <>
            <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            {renderStepContent(activeStep)}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {canEdit && (
          <>
            <Button
              onClick={() => setActiveStep(prev => prev - 1)}
              disabled={activeStep === 0 || saving}
              startIcon={<ArrowBack />}
            >
              Back
            </Button>
            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={() => setActiveStep(prev => prev + 1)}
                disabled={saving}
                endIcon={<ArrowForward />}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <Save />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EditQuizDialog;
