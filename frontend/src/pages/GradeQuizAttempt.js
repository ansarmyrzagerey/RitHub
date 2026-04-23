import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import { ArrowBack, Save, CheckCircle, Cancel, AutoAwesome } from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';
import AIGradingPreview from '../components/quiz/AIGradingPreview';
import quizService from '../services/quizService';

const GradeQuizAttempt = () => {
  const { id, attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [manualScores, setManualScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // AI Grading state
  const [aiGrading, setAiGrading] = useState(false);
  const [aiGrades, setAiGrades] = useState(null);
  const [showAiPreview, setShowAiPreview] = useState(false);

  useEffect(() => {
    loadData();
  }, [id, attemptId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const [quizResponse, attemptResponse] = await Promise.all([
        axios.get(`/api/quizzes/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`/api/quizzes/${id}/attempts/${attemptId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setQuiz(quizResponse.data.quiz);
      setAttempt(attemptResponse.data.attempt);
      setQuestions(attemptResponse.data.questions || []);

      // Initialize manual scores to 0
      const initialScores = {};
      attemptResponse.data.questions.forEach(q => {
        if (q.type === 'open' || q.type === 'code') {
          initialScores[q.id] = 0;
        }
      });
      setManualScores(initialScores);
    } catch (error) {
      console.error('Failed to load attempt:', error);
      setError('Failed to load attempt data');
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (questionId, value) => {
    const numValue = parseFloat(value) || 0;
    setManualScores(prev => ({
      ...prev,
      [questionId]: numValue
    }));
  };

  const calculateFinalScore = () => {
    let totalPoints = 0;
    let earnedPoints = 0;

    questions.forEach(question => {
      totalPoints += question.point_weight || 1;
      const userAnswer = attempt.answers[question.id];

      if (question.type === 'multiple' && question.correct_answer !== null) {
        if (userAnswer === question.correct_answer) {
          earnedPoints += question.point_weight || 1;
        }
      } else if (question.type === 'open' || question.type === 'code') {
        earnedPoints += manualScores[question.id] || 0;
      }
    });

    return {
      totalPoints,
      earnedPoints,
      percentage: totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
    };
  };

  // Check if there are any open/code questions that need manual grading
  const hasGradableQuestions = questions.some(q => q.type === 'open' || q.type === 'code');

  // Handle AI grading request
  const handleAIGrading = async () => {
    try {
      setAiGrading(true);
      const response = await quizService.requestAIGrading(id, attemptId);
      
      if (response.success) {
        setAiGrades(response.grades);
        setShowAiPreview(true);
      } else {
        toast.error(response.message || 'AI grading failed');
      }
    } catch (error) {
      console.error('AI grading failed:', error);
      toast.error(error.response?.data?.message || 'AI grading failed. Please try again or grade manually.');
    } finally {
      setAiGrading(false);
    }
  };

  // Handle accepting AI grades
  const handleAcceptAIGrades = (grades) => {
    // Populate manualScores with AI-suggested (or edited) values
    setManualScores(prev => ({
      ...prev,
      ...grades
    }));
    setShowAiPreview(false);
    setAiGrades(null);
    toast.success('AI grades applied! Review and submit when ready.');
  };

  // Handle closing AI preview (reject)
  const handleCloseAIPreview = () => {
    setShowAiPreview(false);
    setAiGrades(null);
  };

  const handleSubmitGrading = async () => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `/api/quizzes/${id}/attempts/${attemptId}/grade`,
        { manualScores },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Quiz graded successfully!');
        navigate(`/quizzes/${id}/grade`);
      }
    } catch (error) {
      console.error('Failed to submit grading:', error);
      toast.error(error.response?.data?.message || 'Failed to submit grading');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !attempt || !quiz) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(`/quizzes/${id}/grade`)} sx={{ mb: 2 }}>
          Back to Grading List
        </Button>
        <Alert severity="error">{error || 'Attempt not found'}</Alert>
      </Box>
    );
  }

  const finalScore = calculateFinalScore();
  const willPass = finalScore.percentage >= (quiz.passing_score || 0);

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(`/quizzes/${id}/grade`)} sx={{ mb: 3 }}>
        Back to Grading List
      </Button>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Grade Submission
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Participant: {attempt.participant_name} ({attempt.participant_email})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Submitted: {new Date(attempt.submitted_at).toLocaleString()}
        </Typography>
      </Box>

      {/* Score Summary */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: willPass ? 'success.light' : 'error.light' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Final Score Preview
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {Math.round(finalScore.percentage)}%
            </Typography>
            <Typography variant="body2">
              {finalScore.earnedPoints} / {finalScore.totalPoints} points
            </Typography>
            <Chip
              label={willPass ? 'Will Pass ✓' : 'Will Fail ✗'}
              color={willPass ? 'success' : 'error'}
              sx={{ mt: 2 }}
            />
          </Box>
          
          {/* AI Grading Button */}
          {hasGradableQuestions && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={aiGrading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesome />}
              onClick={handleAIGrading}
              disabled={aiGrading || submitting}
            >
              {aiGrading ? 'Grading...' : 'Grade via AI'}
            </Button>
          )}
        </Box>
      </Paper>

      {/* Questions */}
      {questions.map((question, index) => {
        const userAnswer = attempt.answers[question.id];
        const isManualGrading = question.type === 'open' || question.type === 'code';

        return (
          <Card key={question.id} sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={`Question ${index + 1}`} color="primary" size="small" />
                <Chip
                  label={question.type === 'multiple' ? 'Multiple Choice' : question.type === 'open' ? 'Open-Ended' : 'Code'}
                  size="small"
                />
                <Chip label={`${question.point_weight || 1} points`} size="small" />
                {isManualGrading && <Chip label="Manual Grading" color="warning" size="small" />}
              </Box>

              <Typography variant="h6" sx={{ mb: 2 }}>
                {question.title}
              </Typography>

              <Divider sx={{ mb: 2 }} />

              {question.type === 'multiple' && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Participant's Answer:
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {question.options && question.options[userAnswer] ? question.options[userAnswer] : 'No answer'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Correct Answer:
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2, color: 'success.main' }}>
                    {question.options && question.options[question.correct_answer]}
                  </Typography>
                  <Chip
                    icon={userAnswer === question.correct_answer ? <CheckCircle /> : <Cancel />}
                    label={userAnswer === question.correct_answer ? 'Correct' : 'Incorrect'}
                    color={userAnswer === question.correct_answer ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              )}

              {(question.type === 'open' || question.type === 'code') && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Participant's Answer:
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      mb: 3,
                      bgcolor: 'grey.50',
                      fontFamily: question.type === 'code' ? 'monospace' : 'inherit',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
                    {userAnswer || 'No answer provided'}
                  </Paper>

                  <TextField
                    label="Points Awarded"
                    type="number"
                    value={manualScores[question.id] || 0}
                    onChange={(e) => handleScoreChange(question.id, e.target.value)}
                    inputProps={{
                      min: 0,
                      max: question.point_weight || 1,
                      step: 0.5
                    }}
                    helperText={`Maximum: ${question.point_weight || 1} points`}
                    sx={{ width: 200 }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Submit Button */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={() => navigate(`/quizzes/${id}/grade`)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSubmitGrading}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Grading'}
        </Button>
      </Box>

      {/* AI Grading Preview Modal */}
      <AIGradingPreview
        open={showAiPreview}
        onClose={handleCloseAIPreview}
        onAccept={handleAcceptAIGrades}
        grades={aiGrades}
        questions={questions.filter(q => q.type === 'open' || q.type === 'code')}
        answers={attempt?.answers || {}}
      />
    </Box>
  );
};

export default GradeQuizAttempt;
