import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  TextField,
  Chip,
  Divider,
  Alert
} from '@mui/material';
import { AutoAwesome, Check, Close } from '@mui/icons-material';

/**
 * AIGradingPreview - Modal dialog for reviewing and editing AI-suggested grades
 * 
 * Props:
 * - open: boolean - Whether the dialog is open
 * - onClose: () => void - Called when user cancels/closes
 * - onAccept: (grades: Record<string, number>) => void - Called with edited grades when accepted
 * - grades: Record<string, GradeResult> - AI-suggested grades keyed by question ID
 * - questions: Question[] - Array of gradable questions
 * - answers: Record<string, string> - Participant answers keyed by question ID
 */
const AIGradingPreview = ({ open, onClose, onAccept, grades, questions, answers }) => {
  // Local state for edited scores
  const [editedScores, setEditedScores] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  // Initialize edited scores when grades prop changes
  useEffect(() => {
    if (grades) {
      const initialScores = {};
      Object.keys(grades).forEach(questionId => {
        initialScores[questionId] = grades[questionId].suggestedScore;
      });
      setEditedScores(initialScores);
      setValidationErrors({});
    }
  }, [grades]);

  // Handle score change with validation
  const handleScoreChange = (questionId, value) => {
    const numValue = parseFloat(value);
    const maxScore = grades[questionId]?.maxScore || 0;

    // Update the score
    setEditedScores(prev => ({
      ...prev,
      [questionId]: value === '' ? '' : numValue
    }));

    // Validate
    if (value === '' || isNaN(numValue)) {
      setValidationErrors(prev => ({
        ...prev,
        [questionId]: 'Score is required'
      }));
    } else if (numValue < 0) {
      setValidationErrors(prev => ({
        ...prev,
        [questionId]: 'Score cannot be negative'
      }));
    } else if (numValue > maxScore) {
      setValidationErrors(prev => ({
        ...prev,
        [questionId]: `Score cannot exceed ${maxScore}`
      }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };


  // Handle accept - validate all scores and call onAccept
  const handleAccept = () => {
    // Check for validation errors
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    // Ensure all scores are valid numbers
    const finalGrades = {};
    let hasErrors = false;

    Object.keys(grades).forEach(questionId => {
      const score = editedScores[questionId];
      if (score === '' || score === undefined || isNaN(score)) {
        hasErrors = true;
        setValidationErrors(prev => ({
          ...prev,
          [questionId]: 'Score is required'
        }));
      } else {
        finalGrades[questionId] = parseFloat(score);
      }
    });

    if (!hasErrors) {
      onAccept(finalGrades);
    }
  };

  // Get confidence chip color
  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high':
        return 'success';
      case 'medium':
        return 'warning';
      case 'low':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get question by ID
  const getQuestion = (questionId) => {
    return questions?.find(q => q.id === questionId || q.id === parseInt(questionId));
  };

  // If no grades, don't render
  if (!grades || !questions) {
    return null;
  }

  const gradableQuestionIds = Object.keys(grades);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesome color="primary" />
          <Typography variant="h6">AI Grading Preview</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          Review the AI-suggested grades below. You can edit any score before accepting.
          {gradableQuestionIds.length} question{gradableQuestionIds.length !== 1 ? 's' : ''} graded.
        </Alert>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {gradableQuestionIds.map((questionId) => {
            const grade = grades[questionId];
            const question = getQuestion(questionId);
            const answer = answers?.[questionId];

            if (!question || !grade) return null;

            return (
              <Paper key={questionId} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                {/* Question Header */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={question.type === 'open' ? 'Open-Ended' : 'Code'}
                    size="small"
                    color="primary"
                  />
                  <Chip
                    label={`Max: ${grade.maxScore} pts`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`Confidence: ${grade.confidence}`}
                    size="small"
                    color={getConfidenceColor(grade.confidence)}
                  />
                </Box>

                {/* Question Title */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  {question.title}
                </Typography>

                {/* Participant's Answer */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Participant's Answer:
                </Typography>
                <Paper
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: 'grey.50',
                    fontFamily: question.type === 'code' ? 'monospace' : 'inherit',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 150,
                    overflow: 'auto'
                  }}
                >
                  {answer || 'No answer provided'}
                </Paper>

                {/* AI Justification */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  AI Justification:
                </Typography>
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
                  <Typography variant="body2">
                    {grade.justification}
                  </Typography>
                </Paper>

                {/* Score Input */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TextField
                    label="Score"
                    type="number"
                    size="small"
                    value={editedScores[questionId] ?? grade.suggestedScore}
                    onChange={(e) => handleScoreChange(questionId, e.target.value)}
                    inputProps={{
                      min: 0,
                      max: grade.maxScore,
                      step: 0.5
                    }}
                    error={!!validationErrors[questionId]}
                    helperText={validationErrors[questionId] || `0 - ${grade.maxScore}`}
                    sx={{ width: 150 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    AI suggested: {grade.suggestedScore} / {grade.maxScore}
                  </Typography>
                </Box>
              </Paper>
            );
          })}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button
          onClick={onClose}
          variant="outlined"
          startIcon={<Close />}
        >
          Cancel
        </Button>
        <Button
          onClick={handleAccept}
          variant="contained"
          color="success"
          startIcon={<Check />}
          disabled={Object.keys(validationErrors).length > 0}
        >
          Accept All
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AIGradingPreview;
