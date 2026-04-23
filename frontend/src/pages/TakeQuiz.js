import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
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
  Alert
} from '@mui/material';
import {
  Quiz,
  CheckCircle,
  Timer,
  EmojiEvents,
  ArrowBack,
  ArrowForward
} from '@mui/icons-material';
import axios from 'axios';

const TakeQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studyId = searchParams.get('studyId');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadQuizData();
  }, [id]);

  const loadQuizData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch quiz details, questions, and check if already taken
      const [quizResponse, questionsResponse, attemptResponse] = await Promise.all([
        axios.get(`/api/quizzes/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`/api/quizzes/${id}/questions`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`/api/quizzes/${id}/attempt`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { studyId }
        }).catch(() => ({ data: { attempt: null } }))
      ]);

      const previousAttempt = attemptResponse.data.attempt;

      if (previousAttempt) {
        // User has already taken this quiz
        let statusMessage;
        if (previousAttempt.grading_status === 'pending_grading') {
          statusMessage = 'PENDING GRADING ⏳';
        } else if (previousAttempt.passed) {
          statusMessage = 'PASSED ✓';
        } else {
          statusMessage = 'FAILED ✗';
        }

        setError(
          `You have already taken this quiz.\n\n` +
          `Score: ${previousAttempt.score}%\n` +
          `Status: ${statusMessage}\n` +
          `Submitted: ${new Date(previousAttempt.submitted_at).toLocaleString()}`
        );
        setLoading(false);
        return;
      }

      setQuiz(quizResponse.data.quiz);
      setQuestions(questionsResponse.data.questions || []);
    } catch (error) {
      console.error('Failed to load quiz:', error);
      setError('Failed to load quiz. Please try again.');
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

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `/api/quizzes/${id}/submit`,
        { answers, studyId: studyId ? parseInt(studyId) : null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const { attempt } = response.data;

        let message = `Quiz Submitted!\n\n`;

        if (attempt.needsManualGrading) {
          message += `Auto-graded Score: ${attempt.scorePercentage}%\n`;
          message += `Points: ${attempt.earnedPoints}/${attempt.autoGradablePoints} (auto-graded questions)\n\n`;
          message += `⏳ Pending Manual Grading\n`;
          message += `Your quiz includes open-ended or code questions that require manual grading by the researcher.\n`;
          message += `You will be notified once grading is complete.`;
        } else {
          message += `Score: ${attempt.scorePercentage}%\n`;
          message += `Points: ${attempt.earnedPoints}/${attempt.totalPoints}\n`;
          message += `Status: ${attempt.passed ? 'PASSED ✓' : 'Not Passed'}\n\n`;
          message += response.data.message;
        }

        alert(message);
        navigate(-1);
      }
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !quiz) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Back
        </Button>
        <Alert severity="error">{error || 'Quiz not found'}</Alert>
      </Box>
    );
  }

  if (questions.length === 0) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Back
        </Button>
        <Alert severity="warning">This quiz has no questions yet.</Alert>
      </Box>
    );
  }

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  const totalPoints = questions.reduce((sum, q) => sum + (q.point_weight || 1), 0);

  return (
    <Box>
      {/* Back Button */}
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 3 }}>
        Back
      </Button>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Quiz color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {quiz.title}
          </Typography>
        </Box>
        {quiz.description && (
          <Typography variant="body1" color="text.secondary">
            {quiz.description}
          </Typography>
        )}
      </Box>

      {/* Quiz Info Bar */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <CardContent sx={{ p: 4 }}>
          {/* Question Header */}
          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
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
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
            {question.title}
          </Typography>

          <Divider sx={{ mb: 3 }} />

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
                    value={option}
                    control={<Radio />}
                    label={option}
                    sx={{
                      mb: 1,
                      p: 2,
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
        >
          Previous
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          {currentQuestion < questions.length - 1 ? (
            <Button variant="contained" endIcon={<ArrowForward />} onClick={handleNext}>
              Next Question
            </Button>
          ) : (
            <Button variant="contained" color="success" onClick={handleSubmit}>
              Submit Quiz
            </Button>
          )}
        </Box>
      </Box>

      {/* Question Navigator */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
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
  );
};

export default TakeQuiz;
