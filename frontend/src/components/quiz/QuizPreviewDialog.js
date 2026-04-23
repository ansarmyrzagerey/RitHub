import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  TextField,
  LinearProgress,
  Chip,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  IconButton
} from '@mui/material';
import {
  Quiz,
  CheckCircle,
  EmojiEvents,
  ArrowBack,
  ArrowForward,
  Close
} from '@mui/icons-material';
import axios from 'axios';

const QuizPreviewDialog = ({ open, onClose, quizId }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && quizId) {
      loadQuizData();
    }
  }, [open, quizId]);

  const loadQuizData = async () => {
    try {
      setLoading(true);
      setError(null);
      setCurrentQuestion(0);
      setAnswers({});
      
      const token = localStorage.getItem('token');
      
      const [quizResponse, questionsResponse] = await Promise.all([
        axios.get(`/api/quizzes/${quizId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`/api/quizzes/${quizId}/questions`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setQuiz(quizResponse.data.quiz);
      setQuestions(questionsResponse.data.questions || []);
    } catch (error) {
      console.error('Failed to load quiz:', error);
      setError('Failed to load quiz preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers({
      ...answers,
      [questionId]: value
    });
  };

  const handleNext = () => {
    if (questions && currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleClose = () => {
    setCurrentQuestion(0);
    setAnswers({});
    onClose();
  };

  if (!open) return null;

  const question = questions[currentQuestion];
  const progress = questions.length > 0 ? ((currentQuestion + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;
  const totalPoints = questions.reduce((sum, q) => sum + (q.point_weight || 1), 0);

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Quiz color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Quiz Preview
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        ) : error || !quiz ? (
          <Alert severity="error">{error || 'Quiz not found'}</Alert>
        ) : questions.length === 0 ? (
          <Alert severity="warning">This quiz has no questions yet.</Alert>
        ) : (
          <Box>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                {quiz.title}
              </Typography>
              {quiz.description && (
                <Typography variant="body1" color="text.secondary">
                  {quiz.description}
                </Typography>
              )}
            </Box>

            {/* Quiz Info Bar */}
            <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', bgcolor: 'action.hover' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle color="action" />
                <Typography variant="body2">
                  <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> answered
                </Typography>
              </Box>

              {quiz.passing_score && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmojiEvents color="action" />
                  <Typography variant="body2">
                    Passing Score: <strong>{quiz.passing_score}%</strong>
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">
                  Total Points: <strong>{totalPoints}</strong>
                </Typography>
              </Box>
            </Paper>

            {/* Progress Bar */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Question {currentQuestion + 1} of {questions.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {Math.round(progress)}% Complete
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 1 }} />
            </Box>

            {/* Question Card */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                {/* Question Header */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={
                      question.type === 'multiple'
                        ? 'Multiple Choice'
                        : question.type === 'open'
                          ? 'Open-Ended'
                          : 'Code'
                    }
                    color="primary"
                    size="small"
                  />
                  <Chip label={`${question.point_weight || 1} ${(question.point_weight || 1) === 1 ? 'point' : 'points'}`} size="small" />
                  {question.is_absolute && <Chip label="Required" color="error" size="small" />}
                </Box>

                {/* Question Title */}
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
                  {question.title}
                </Typography>

                <Divider sx={{ mb: 2 }} />

                {/* Answer Input */}
                {question.type === 'multiple' && question.options && (
                  <FormControl component="fieldset" fullWidth>
                    <RadioGroup
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    >
                      {question.options.map((option, index) => (
                        <FormControlLabel
                          key={index}
                          value={index.toString()}
                          control={<Radio />}
                          label={option}
                          sx={{
                            mb: 1,
                            p: 1.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            '&:hover': {
                              bgcolor: 'action.hover'
                            }
                          }}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                )}

                {question.type === 'open' && (
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    placeholder="Type your answer here..."
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    variant="outlined"
                  />
                )}

                {question.type === 'code' && (
                  <TextField
                    fullWidth
                    multiline
                    rows={10}
                    placeholder="// Write your code here..."
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    variant="outlined"
                    sx={{
                      '& textarea': {
                        fontFamily: 'monospace',
                        fontSize: '14px'
                      }
                    }}
                  />
                )}
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                size="small"
              >
                Previous
              </Button>

              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={handleNext}
                disabled={currentQuestion >= questions.length - 1}
                size="small"
              >
                Next Question
              </Button>
            </Box>

            {/* Question Navigator */}
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Question Navigator
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {questions.map((q, index) => (
                  <Button
                    key={q.id}
                    variant={currentQuestion === index ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setCurrentQuestion(index)}
                    sx={{
                      minWidth: 40,
                      bgcolor: answers[q.id] !== undefined && currentQuestion !== index ? 'success.light' : undefined,
                      color: answers[q.id] !== undefined && currentQuestion !== index ? 'success.contrastText' : undefined,
                      '&:hover': {
                        bgcolor: answers[q.id] !== undefined && currentQuestion !== index ? 'success.main' : undefined
                      }
                    }}
                  >
                    {index + 1}
                  </Button>
                ))}
              </Box>
            </Paper>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Alert severity="info" sx={{ flex: 1, mr: 2 }}>
          This is a preview. No answers will be saved.
        </Alert>
        <Button onClick={handleClose} variant="contained">
          Close Preview
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuizPreviewDialog;
