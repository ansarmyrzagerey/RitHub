import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  CircularProgress,
  Alert
} from '@mui/material';
import { AutoAwesome } from '@mui/icons-material';
import toast from 'react-hot-toast';
import quizService from '../../services/quizService';

const AIQuizGenerationDialog = ({ open, onClose, onGenerated, quizTitle, quizDescription }) => {
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    topic: '',
    difficulty: 'medium',
    numberOfQuestions: 5,
    questionTypes: ['multiple'],
    context: ''
  });

  const handleClose = () => {
    if (!generating) {
      setFormData({
        topic: '',
        difficulty: 'medium',
        numberOfQuestions: 5,
        questionTypes: ['multiple'],
        context: ''
      });
      onClose();
    }
  };

  const MAX_TOPIC_LENGTH = 100;
  const MAX_QUESTIONS = 20;
  const MAX_CONTEXT_LENGTH = 150;
  const MAX_TITLE_LENGTH = 50;

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }

    if (formData.topic.length > MAX_TOPIC_LENGTH) {
      toast.error(`Topic must be ${MAX_TOPIC_LENGTH} characters or less`);
      return;
    }

    if (formData.numberOfQuestions < 1 || formData.numberOfQuestions > MAX_QUESTIONS) {
      toast.error(`Number of questions must be between 1 and ${MAX_QUESTIONS}`);
      return;
    }

    if (formData.questionTypes.length === 0) {
      toast.error('Please select at least one question type');
      return;
    }

    setGenerating(true);

    try {
      const result = await quizService.generateAIQuiz({
        title: (quizTitle || '').slice(0, MAX_TITLE_LENGTH),
        description: quizDescription,
        topic: formData.topic,
        difficulty: formData.difficulty,
        numberOfQuestions: formData.numberOfQuestions,
        questionTypes: formData.questionTypes,
        context: formData.context.slice(0, MAX_CONTEXT_LENGTH)
      });

      if (result.success) {
        // Don't close this dialog - let parent handle it
        onGenerated(result.quiz);
        toast.success('Quiz generated successfully!');
      } else {
        toast.error(result.message || 'Failed to generate quiz');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error(error.response?.data?.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesome color="primary" />
          <Typography variant="h6">AI Quiz Generation</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <Alert severity="info" sx={{ mb: 1 }}>
            AI will generate quiz questions based on your inputs. You can review and edit them before saving.
          </Alert>

          {/* Topic */}
          <TextField
            label="Topic / Subject *"
            fullWidth
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value.slice(0, MAX_TOPIC_LENGTH) })}
            disabled={generating}
            placeholder="e.g., JavaScript Basics, World History, Biology"
            helperText={`${formData.topic.length}/${MAX_TOPIC_LENGTH} characters`}
            inputProps={{ maxLength: MAX_TOPIC_LENGTH }}
          />

          {/* Difficulty */}
          <FormControl fullWidth disabled={generating}>
            <InputLabel>Difficulty Level</InputLabel>
            <Select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              label="Difficulty Level"
            >
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
            </Select>
          </FormControl>

          {/* Number of Questions */}
          <TextField
            label="Number of Questions *"
            type="number"
            fullWidth
            value={formData.numberOfQuestions}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 1;
              setFormData({ ...formData, numberOfQuestions: Math.min(Math.max(val, 1), MAX_QUESTIONS) });
            }}
            disabled={generating}
            inputProps={{ min: 1, max: MAX_QUESTIONS }}
            helperText={`Between 1 and ${MAX_QUESTIONS} questions`}
          />

          {/* Question Types */}
          <FormControl fullWidth disabled={generating}>
            <InputLabel>Question Types</InputLabel>
            <Select
              multiple
              value={formData.questionTypes}
              onChange={(e) => setFormData({ ...formData, questionTypes: e.target.value })}
              input={<OutlinedInput label="Question Types" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip
                      key={value}
                      label={value === 'multiple' ? 'Multiple Choice' : value === 'open' ? 'Open-Ended' : 'Code'}
                      size="small"
                    />
                  ))}
                </Box>
              )}
            >
              <MenuItem value="multiple">Multiple Choice</MenuItem>
              <MenuItem value="open">Open-Ended</MenuItem>
              <MenuItem value="code">Code</MenuItem>
            </Select>
          </FormControl>

          {/* Additional Context */}
          <TextField
            label="Additional Context (Optional)"
            multiline
            rows={3}
            fullWidth
            value={formData.context}
            onChange={(e) => setFormData({ ...formData, context: e.target.value.slice(0, MAX_CONTEXT_LENGTH) })}
            disabled={generating}
            placeholder="Any specific requirements, focus areas, or constraints..."
            helperText={`${formData.context.length}/${MAX_CONTEXT_LENGTH} characters`}
            inputProps={{ maxLength: MAX_CONTEXT_LENGTH }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={generating}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={generating}
          startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesome />}
        >
          {generating ? 'Generating...' : 'Generate Quiz'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AIQuizGenerationDialog;
