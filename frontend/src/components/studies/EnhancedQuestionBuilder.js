import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Divider,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  DragIndicator as DragIcon,
  Visibility as VisibilityIcon,
  Folder as FolderIcon,
  CompareArrows as CompareIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import ArtifactLibraryBrowser from './ArtifactLibraryBrowser';
import ArtifactPreviewDialog from './ArtifactPreviewDialog';
import ArtifactSetManager from './ArtifactSetManager';

const EnhancedQuestionBuilder = ({ studyId, questions = [], onQuestionsChange }) => {
  const [localQuestions, setLocalQuestions] = useState(questions);
  const [templates, setTemplates] = useState({ templates: [], scales: [] });
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [artifactBrowserOpen, setArtifactBrowserOpen] = useState(false);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [previewArtifacts, setPreviewArtifacts] = useState([]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [artifactSetManagerOpen, setArtifactSetManagerOpen] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    setLocalQuestions(questions);
  }, [questions]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/studies/questions/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const addQuestion = (type = 'comparison') => {
    const newQuestion = {
      id: `temp-${Date.now()}`,
      title: '',
      description: '',
      question_type: type,
      display_order: localQuestions.length + 1,
      artifacts: [],
      criteria: [],
      isNew: true
    };
    const updated = [...localQuestions, newQuestion];
    setLocalQuestions(updated);
    onQuestionsChange(updated);
    setExpandedQuestion(newQuestion.id);
  };

  const updateQuestion = (questionId, field, value) => {
    console.log(`=== UPDATING QUESTION ${questionId} ===`);
    console.log(`Field: ${field}, Value:`, value);

    const updated = localQuestions.map(q => {
      if (q.id === questionId) {
        const updatedQuestion = { ...q, [field]: value };
        console.log('Updated question:', updatedQuestion);
        return updatedQuestion;
      }
      return q;
    });

    setLocalQuestions(updated);
    onQuestionsChange(updated);
  };

  const deleteQuestion = (questionId) => {
    const updated = localQuestions.filter(q => q.id !== questionId);
    setLocalQuestions(updated);
    onQuestionsChange(updated);
    toast.success('Question removed');
  };

  const openArtifactBrowser = (questionId) => {
    setCurrentQuestionId(questionId);
    setArtifactBrowserOpen(true);
  };

  const handleArtifactSelectionChange = (selectedArtifacts) => {
    if (!currentQuestionId) return;

    const updated = localQuestions.map(q => {
      if (q.id === currentQuestionId) {
        return {
          ...q,
          artifacts: selectedArtifacts.map((artifact, index) => ({
            artifact_id: artifact.id,
            display_order: index + 1,
            name: artifact.name,
            type: artifact.type,
            metadata: artifact.metadata
          }))
        };
      }
      return q;
    });

    setLocalQuestions(updated);
    onQuestionsChange(updated);
  };

  const handleArtifactBrowserClose = () => {
    setArtifactBrowserOpen(false);
    setCurrentQuestionId(null);
  };

  const handlePreviewArtifacts = (questionId) => {
    const question = localQuestions.find(q => q.id === questionId);
    if (question && question.artifacts.length > 0) {
      // Convert question artifacts back to full artifact objects for preview
      const artifactsToPreview = question.artifacts.map(qa => ({
        id: qa.artifact_id,
        name: qa.name,
        type: qa.type,
        metadata: qa.metadata
      }));
      setPreviewArtifacts(artifactsToPreview);
      setPreviewDialogOpen(true);
    }
  };

  const handleLoadArtifactSet = (artifacts) => {
    if (!currentQuestionId) return;

    const updated = localQuestions.map(q => {
      if (q.id === currentQuestionId) {
        return {
          ...q,
          artifacts: artifacts.map((artifact, index) => ({
            artifact_id: artifact.id,
            display_order: index + 1,
            name: artifact.name,
            type: artifact.type,
            metadata: artifact.metadata
          }))
        };
      }
      return q;
    });

    setLocalQuestions(updated);
    onQuestionsChange(updated);
  };

  const removeArtifactFromQuestion = (questionId, artifactId) => {
    const updated = localQuestions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          artifacts: q.artifacts.filter(a => a.artifact_id !== artifactId)
        };
      }
      return q;
    });
    setLocalQuestions(updated);
    onQuestionsChange(updated);
  };

  const addCriterionToQuestion = (questionId, template = null) => {
    const updated = localQuestions.map(q => {
      if (q.id === questionId) {
        const newCriterion = template ? {
          id: `temp-${Date.now()}`,
          name: template.name,
          type: template.type,
          scale: 'stars_5', // Always use 5-star rating
          description: template.description,
          display_order: q.criteria.length + 1,
          isNew: true
        } : {
          id: `temp-${Date.now()}`,
          name: '',
          type: 'custom',
          scale: 'stars_5', // Always use 5-star rating
          description: '',
          display_order: q.criteria.length + 1,
          isNew: true
        };

        return {
          ...q,
          criteria: [...q.criteria, newCriterion]
        };
      }
      return q;
    });
    setLocalQuestions(updated);
    onQuestionsChange(updated);
  };

  const updateCriterion = (questionId, criterionId, field, value) => {
    const updated = localQuestions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          criteria: q.criteria.map(c =>
            c.id === criterionId ? { ...c, [field]: value } : c
          )
        };
      }
      return q;
    });
    setLocalQuestions(updated);
    onQuestionsChange(updated);
  };

  const removeCriterionFromQuestion = (questionId, criterionId) => {
    const updated = localQuestions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          criteria: q.criteria.filter(c => c.id !== criterionId)
        };
      }
      return q;
    });
    setLocalQuestions(updated);
    onQuestionsChange(updated);
  };

  const getCurrentQuestion = () => {
    return localQuestions.find(q => q.id === currentQuestionId);
  };

  const getSelectedArtifactsForBrowser = () => {
    const question = getCurrentQuestion();
    if (!question) return [];

    // Convert question artifacts to format expected by browser
    return question.artifacts.map(qa => ({
      id: qa.artifact_id,
      name: qa.name,
      type: qa.type,
      metadata: qa.metadata
    }));
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Study Questions</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<CompareIcon />}
            onClick={() => addQuestion('comparison')}
          >
            Add Comparison Question
          </Button>
          <Button
            variant="outlined"
            startIcon={<StarIcon />}
            onClick={() => addQuestion('rating')}
          >
            Add Rating Question
          </Button>
        </Box>
      </Box>

      {localQuestions.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Add questions to define what participants will evaluate. Choose between:
          <ul>
            <li><strong>Comparison Questions:</strong> Compare 2-3 artifacts side-by-side</li>
            <li><strong>Rating Questions:</strong> Rate a single artifact based on criteria</li>
          </ul>
        </Alert>
      )}

      {localQuestions.map((question, index) => (
        <Accordion
          key={question.id}
          expanded={expandedQuestion === question.id}
          onChange={(e, isExpanded) => setExpandedQuestion(isExpanded ? question.id : null)}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
              <DragIcon sx={{ color: 'text.secondary' }} />
              {question.question_type === 'comparison' ? (
                <CompareIcon color="primary" />
              ) : (
                <StarIcon color="secondary" />
              )}
              <Typography sx={{ flexGrow: 1 }}>
                {question.title || `${question.question_type === 'comparison' ? 'Comparison' : 'Rating'} Question ${index + 1}`}
              </Typography>
              <Chip
                label={question.question_type}
                size="small"
                color={question.question_type === 'comparison' ? 'primary' : 'secondary'}
                sx={{ mr: 1 }}
              />
              <Chip
                label={`${question.artifacts.length} artifact${question.artifacts.length !== 1 ? 's' : ''}`}
                size="small"
                sx={{ mr: 1 }}
              />
              <Chip
                label={`${question.criteria.length} criteria`}
                size="small"
              />
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Question Details */}
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      label="Question Title"
                      value={question.title}
                      onChange={(e) => updateQuestion(question.id, 'title', e.target.value)}
                      placeholder={
                        question.question_type === 'comparison'
                          ? "e.g., Compare readability of implementations"
                          : "e.g., Rate the code quality"
                      }
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Question Type</InputLabel>
                      <Select
                        value={question.question_type}
                        label="Question Type"
                        onChange={(e) => {
                          updateQuestion(question.id, 'question_type', e.target.value);
                          // Clear artifacts when changing type
                          updateQuestion(question.id, 'artifacts', []);
                        }}
                      >
                        <MenuItem value="comparison">Comparison (2-3 artifacts)</MenuItem>
                        <MenuItem value="rating">Rating (1 artifact)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description (Optional)"
                      value={question.description}
                      onChange={(e) => updateQuestion(question.id, 'description', e.target.value)}
                      multiline
                      rows={2}
                      placeholder="Provide additional context or instructions for participants"
                    />
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* Artifacts Section */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1">
                    Artifacts {question.question_type === 'comparison' ? 'to Compare' : 'to Rate'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {question.artifacts.length > 0 && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handlePreviewArtifacts(question.id)}
                      >
                        Preview
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<FolderIcon />}
                      onClick={() => {
                        setCurrentQuestionId(question.id);
                        setArtifactSetManagerOpen(true);
                      }}
                    >
                      Artifact Sets
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => openArtifactBrowser(question.id)}
                    >
                      Select Artifacts
                    </Button>
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {question.question_type === 'comparison'
                    ? 'Select 2-3 compatible artifacts for participants to compare'
                    : 'Select 1 artifact for participants to rate'}
                </Typography>

                {question.artifacts.length > 0 ? (
                  <Grid container spacing={2}>
                    {question.artifacts.map((artifact) => (
                      <Grid item xs={12} sm={6} md={4} key={artifact.artifact_id}>
                        <Card variant="outlined">
                          <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {artifact.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {artifact.type?.replace('_', ' ')}
                              </Typography>
                            </Box>
                            <IconButton
                              size="small"
                              onClick={() => removeArtifactFromQuestion(question.id, artifact.artifact_id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Alert severity="warning">
                    No artifacts selected. Click "Select Artifacts" to choose artifacts for this question.
                  </Alert>
                )}
              </Box>

              <Divider />

              {/* Criteria Section */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1">
                    Evaluation Criteria
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => addCriterionToQuestion(question.id)}
                  >
                    Add Custom Criterion
                  </Button>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Add predefined or custom criteria for evaluating the artifacts
                </Typography>

                {/* Predefined Templates */}
                <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {templates.templates.map((template) => (
                    <Chip
                      key={template.name}
                      label={template.name}
                      onClick={() => addCriterionToQuestion(question.id, template)}
                      clickable
                      size="small"
                    />
                  ))}
                </Box>

                {/* Criteria List */}
                {question.criteria.length > 0 ? (
                  question.criteria.map((criterion) => (
                    <Card key={criterion.id} variant="outlined" sx={{ mb: 2, p: 2 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Criterion Name"
                            value={criterion.name}
                            onChange={(e) => updateCriterion(question.id, criterion.id, 'name', e.target.value)}
                            required
                            size="small"
                            placeholder="e.g., Readability, Code Quality, Efficiency"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Description (Optional)"
                            value={criterion.description}
                            onChange={(e) => updateCriterion(question.id, criterion.id, 'description', e.target.value)}
                            multiline
                            rows={2}
                            size="small"
                            placeholder="Describe what participants should evaluate for this criterion"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              ⭐ Participants will rate using a 5-star scale
                            </Typography>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeCriterionFromQuestion(question.id, criterion.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Grid>
                      </Grid>
                    </Card>
                  ))
                ) : (
                  <Alert severity="info">
                    No criteria added. Add criteria to define how participants should evaluate the artifacts.
                  </Alert>
                )}
              </Box>

              <Divider />

              {/* Delete Question Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => deleteQuestion(question.id)}
                >
                  Delete Question
                </Button>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Artifact Browser Dialog */}
      <Dialog
        open={artifactBrowserOpen}
        onClose={handleArtifactBrowserClose}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Select Artifacts for Question
        </DialogTitle>
        <DialogContent dividers>
          <ArtifactLibraryBrowser
            selectedArtifacts={getSelectedArtifactsForBrowser()}
            onSelectionChange={handleArtifactSelectionChange}
            questionType={getCurrentQuestion()?.question_type || 'comparison'}
            studyId={studyId}
            onPreview={(artifact) => {
              setPreviewArtifacts([artifact]);
              setPreviewDialogOpen(true);
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleArtifactBrowserClose}>Cancel</Button>
          <Button onClick={handleArtifactBrowserClose} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Artifact Preview Dialog */}
      <ArtifactPreviewDialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        artifacts={previewArtifacts}
      />

      {/* Artifact Set Manager */}
      <ArtifactSetManager
        open={artifactSetManagerOpen}
        onClose={() => setArtifactSetManagerOpen(false)}
        selectedArtifacts={getSelectedArtifactsForBrowser()}
        onLoadSet={handleLoadArtifactSet}
      />
    </Box>
  );
};

export default EnhancedQuestionBuilder;
