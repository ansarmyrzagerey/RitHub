import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  Alert
} from '@mui/material';
import { Edit, Delete, Add, Check, Close, AutoAwesome } from '@mui/icons-material';
import toast from 'react-hot-toast';

const AIQuizPreview = ({ open, onClose, onAccept, generatedQuestions }) => {
  const [questions, setQuestions] = useState(generatedQuestions || []);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState(null);

  // Sync questions state when generatedQuestions prop changes
  React.useEffect(() => {
    if (generatedQuestions && generatedQuestions.length > 0) {
      setQuestions(generatedQuestions);
    }
  }, [generatedQuestions]);

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditForm({ ...questions[index] });
  };

  const handleSaveEdit = () => {
    if (!editForm.title.trim()) {
      toast.error('Question title is required');
      return;
    }

    if (editForm.type === 'multiple') {
      const validOptions = editForm.options.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        toast.error('Multiple choice questions need at least 2 options');
        return;
      }
      if (!editForm.correctAnswer) {
        toast.error('Please select the correct answer');
        return;
      }
    }

    const updated = [...questions];
    updated[editingIndex] = editForm;
    setQuestions(updated);
    setEditingIndex(null);
    setEditForm(null);
    toast.success('Question updated');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const handleDelete = (index) => {
    if (questions.length === 1) {
      toast.error('Quiz must have at least one question');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
    toast.success('Question deleted');
  };

  const handleAccept = () => {
    if (questions.length === 0) {
      toast.error('Quiz must have at least one question');
      return;
    }
    onAccept(questions);
  };

  const handleReject = () => {
    onClose();
  };

  const updateEditFormOption = (index, value) => {
    const newOptions = [...editForm.options];
    newOptions[index] = value;
    setEditForm({ ...editForm, options: newOptions });
  };

  const addEditFormOption = () => {
    setEditForm({ ...editForm, options: [...editForm.options, ''] });
  };

  const removeEditFormOption = (index) => {
    if (editForm.options.length <= 2) {
      toast.error('Multiple choice questions need at least 2 options');
      return;
    }
    const newOptions = editForm.options.filter((_, i) => i !== index);
    setEditForm({ ...editForm, options: newOptions });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesome color="primary" />
          <Typography variant="h6">AI Generated Quiz Preview</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="success" sx={{ mb: 3 }}>
          {questions.length} question{questions.length !== 1 ? 's' : ''} generated! Review and edit as needed, then accept to add them to your quiz.
        </Alert>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {questions.map((question, index) => (
            <Paper key={index} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
              {editingIndex === index ? (
                // Edit Mode
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" color="primary">
                      Editing Question {index + 1}
                    </Typography>
                    <Box>
                      <IconButton size="small" onClick={handleSaveEdit} color="primary">
                        <Check />
                      </IconButton>
                      <IconButton size="small" onClick={handleCancelEdit}>
                        <Close />
                      </IconButton>
                    </Box>
                  </Box>

                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Question Type</InputLabel>
                    <Select
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      label="Question Type"
                    >
                      <MenuItem value="multiple">Multiple Choice</MenuItem>
                      <MenuItem value="open">Open-Ended</MenuItem>
                      <MenuItem value="code">Code</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    label="Question Text"
                    multiline
                    rows={2}
                    fullWidth
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    sx={{ mb: 2 }}
                  />

                  {editForm.type === 'multiple' && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>Options</Typography>
                      {editForm.options.map((option, optIndex) => (
                        <Box key={optIndex} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                          <TextField
                            size="small"
                            fullWidth
                            value={option}
                            onChange={(e) => updateEditFormOption(optIndex, e.target.value)}
                            placeholder={`Option ${optIndex + 1}`}
                          />
                          {editForm.options.length > 2 && (
                            <IconButton size="small" onClick={() => removeEditFormOption(optIndex)}>
                              <Delete />
                            </IconButton>
                          )}
                        </Box>
                      ))}
                      <Button size="small" startIcon={<Add />} onClick={addEditFormOption}>
                        Add Option
                      </Button>

                      <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                        <InputLabel>Correct Answer</InputLabel>
                        <Select
                          value={editForm.correctAnswer}
                          onChange={(e) => setEditForm({ ...editForm, correctAnswer: e.target.value })}
                          label="Correct Answer"
                        >
                          {editForm.options.filter(opt => opt.trim()).map((option, i) => (
                            <MenuItem key={i} value={option}>{option}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Point Weight"
                      type="number"
                      size="small"
                      value={editForm.pointWeight}
                      onChange={(e) => setEditForm({ ...editForm, pointWeight: parseInt(e.target.value) || 1 })}
                      inputProps={{ min: 1 }}
                      sx={{ width: 150 }}
                    />
                  </Box>
                </Box>
              ) : (
                // View Mode
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          Q{index + 1}
                        </Typography>
                        <Chip
                          label={question.type === 'multiple' ? 'Multiple Choice' : question.type === 'open' ? 'Open-Ended' : 'Code'}
                          size="small"
                          color="primary"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {question.pointWeight} {question.pointWeight === 1 ? 'point' : 'points'}
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        {question.title}
                      </Typography>

                      {question.type === 'multiple' && question.options && (
                        <Box sx={{ ml: 2, mt: 1 }}>
                          {question.options.map((option, optIndex) => (
                            <Box
                              key={optIndex}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                py: 0.5,
                                px: 1,
                                borderRadius: 1,
                                bgcolor: option === question.correctAnswer ? 'success.light' : 'transparent',
                                color: option === question.correctAnswer ? 'success.contrastText' : 'text.primary'
                              }}
                            >
                              <Typography variant="body2">
                                {String.fromCharCode(65 + optIndex)}. {option}
                              </Typography>
                              {option === question.correctAnswer && (
                                <Check fontSize="small" />
                              )}
                            </Box>
                          ))}
                        </Box>
                      )}

                      {question.explanation && (
                        <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            <strong>Explanation:</strong> {question.explanation}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => handleEdit(index)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(index)} color="error">
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={handleReject} variant="outlined" color="error">
          Reject & Start Over
        </Button>
        <Button onClick={handleAccept} variant="contained" color="success" startIcon={<Check />}>
          Accept & Add to Quiz
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AIQuizPreview;
