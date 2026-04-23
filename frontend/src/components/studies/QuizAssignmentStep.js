import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Alert, Paper, List, ListItem, ListItemText, CircularProgress, Checkbox, Chip, IconButton, Tooltip } from '@mui/material';
import { Quiz, Add, Refresh, Visibility } from '@mui/icons-material';
import CreateQuizDialog from '../quiz/CreateQuizDialog';
import QuizPreviewDialog from '../quiz/QuizPreviewDialog';
import quizService from '../../services/quizService';

const QuizAssignmentStep = ({ studyId, selectedQuizIds = [], onQuizSelectionChange, onBack, onNext }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewQuizId, setPreviewQuizId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allQuizzes, setAllQuizzes] = useState([]);
  const [error, setError] = useState(null);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all available quizzes - quizzes can be assigned to multiple studies
      const data = await quizService.getQuizzes();
      const quizzes = data.quizzes || [];
      
      // Show all published quizzes - they can be reused across studies
      setAllQuizzes(quizzes);
    } catch (e) {
      console.error('Failed to load quizzes', e);
      setError('Failed to load quizzes');
      setAllQuizzes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, [studyId]);

  const handleCreated = async (createdQuiz) => {
    setDialogOpen(false);
    await loadQuizzes();
    
    // Automatically select the newly created quiz if we have a studyId
    if (createdQuiz && createdQuiz.id && studyId) {
      const newSelection = selectedQuizIds.includes(createdQuiz.id)
        ? selectedQuizIds
        : [...selectedQuizIds, createdQuiz.id];
      
      if (onQuizSelectionChange) {
        onQuizSelectionChange(newSelection);
      }
    }
  };

  const handleToggleQuiz = (quizId) => {
    const newSelection = selectedQuizIds.includes(quizId)
      ? selectedQuizIds.filter(id => id !== quizId)
      : [...selectedQuizIds, quizId];
    
    if (onQuizSelectionChange) {
      onQuizSelectionChange(newSelection);
    }
  };

  const handlePreviewQuiz = (quizId, event) => {
    event.stopPropagation();
    setPreviewQuizId(quizId);
    setPreviewDialogOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewDialogOpen(false);
    setPreviewQuizId(null);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
        Assign Quizzes (Optional)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select existing quizzes or create new ones to assign to this study. Quizzes can be used for participant screening.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!studyId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Study will be created automatically when you proceed to the next step. Newly created quizzes will be assigned to this study.
        </Alert>
      )}

      {selectedQuizIds.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {selectedQuizIds.length} quiz{selectedQuizIds.length > 1 ? 'zes' : ''} selected
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<Quiz />}
          onClick={() => setDialogOpen(true)}
        >
          Create New Quiz
        </Button>
        <Button
          variant="text"
          startIcon={<Refresh />}
          onClick={loadQuizzes}
        >
          Refresh
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onBack}>Back</Button>
        <Button
          variant="contained"
          onClick={onNext}
        >
          Continue
        </Button>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          Available Quizzes
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select quizzes to assign to this study. Quizzes can be shared across multiple studies.
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : allQuizzes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No quizzes available. Create a new quiz to get started.
          </Typography>
        ) : (
          <List dense>
            {allQuizzes.map((q) => (
              <ListItem 
                key={q.id} 
                divider
                button
                onClick={() => handleToggleQuiz(q.id)}
                secondaryAction={
                  <Tooltip title="Preview quiz as participant">
                    <IconButton 
                      edge="end" 
                      onClick={(e) => handlePreviewQuiz(q.id, e)}
                      color="primary"
                    >
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                }
              >
                <Checkbox
                  edge="start"
                  checked={selectedQuizIds.includes(q.id)}
                  tabIndex={-1}
                  disableRipple
                />
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body1">{q.title}</Typography>
                      {q.is_published && (
                        <Chip label="Published" size="small" color="success" />
                      )}
                      {q.is_ai_generated && (
                        <Chip label="AI" size="small" color="info" />
                      )}
                      {q.assigned_studies_count > 0 && (
                        <Chip 
                          label={`Used in ${q.assigned_studies_count} study${q.assigned_studies_count > 1 ? 'ies' : ''}`} 
                          size="small" 
                          color="default"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {q.description || 'No description'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Passing Score: {q.passing_score}%
                        {q.is_skippable && ' • Skippable'}
                        {q.is_giving_badges && ' • Awards Badges'}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <CreateQuizDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreateSuccess={handleCreated}
        studyId={studyId}
      />

      <QuizPreviewDialog
        open={previewDialogOpen}
        onClose={handleClosePreview}
        quizId={previewQuizId}
      />
    </Box>
  );
};

export default QuizAssignmentStep;

