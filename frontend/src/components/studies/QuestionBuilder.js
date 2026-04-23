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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const QuestionBuilder = ({ studyId, questions = [], onQuestionsChange, artifacts = [] }) => {
  const [localQuestions, setLocalQuestions] = useState(questions);
  const [templates, setTemplates] = useState({ templates: [], scales: [] });
  const [expandedQuestion, setExpandedQuestion] = useState(null);

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

  const addQuestion = () => {
    const newQuestion = {
      id: `temp-${Date.now()}`,
      title: '',
      description: '',
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
    const updated = localQuestions.map(q =>
      q.id === questionId ? { ...q, [field]: value } : q
    );
    setLocalQuestions(updated);
    onQuestionsChange(updated);
  };

  const deleteQuestion = (questionId) => {
    const updated = localQuestions.filter(q => q.id !== questionId);
    setLocalQuestions(updated);
    onQuestionsChange(updated);
    toast.success('Question removed');
  };

  const addArtifactToQuestion = (questionId, artifactId) => {
    const updated = localQuestions.map(q => {
      if (q.id === questionId) {
        const artifact = artifacts.find(a => a.id === artifactId);
        if (!artifact) return q;
        
        const alreadyAdded = q.artifacts.some(a => a.artifact_id === artifactId);
        if (alreadyAdded) {
          toast.error('Artifact already added to this question');
          return q;
        }

        if (q.artifacts.length >= 5) {
          toast.error('Maximum 5 artifacts per question');
          return q;
        }

        return {
          ...q,
          artifacts: [...q.artifacts, {
            artifact_id: artifactId,
            display_order: q.artifacts.length + 1,
            name: artifact.name,
            type: artifact.type
          }]
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
          scale: template.suggested_scale,
          description: template.description,
          display_order: q.criteria.length + 1,
          isNew: true
        } : {
          id: `temp-${Date.now()}`,
          name: '',
          type: 'custom',
          scale: 'likert_5',
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

  const getScaleLabel = (scaleValue) => {
    const scale = templates.scales.find(s => s.value === scaleValue);
    return scale ? scale.label : scaleValue;
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Study Questions</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={addQuestion}
        >
          Add Question
        </Button>
      </Box>

      {localQuestions.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Add questions to define what participants will evaluate. Each question can compare different artifacts using specific criteria.
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
              <Typography sx={{ flexGrow: 1 }}>
                {question.title || `Question ${index + 1}`}
              </Typography>
              <Chip
                label={`${question.artifacts.length} artifacts`}
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
                <TextField
                  fullWidth
                  label="Question Title"
                  value={question.title}
                  onChange={(e) => updateQuestion(question.id, 'title', e.target.value)}
                  placeholder="e.g., Compare readability of implementations"
                  required
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Description (Optional)"
                  value={question.description}
                  onChange={(e) => updateQuestion(question.id, 'description', e.target.value)}
                  multiline
                  rows={2}
                  placeholder="Provide additional context or instructions for participants"
                />
              </Box>

              <Divider />

              {/* Artifacts Section */}
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Artifacts to Compare
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select 2-5 artifacts for participants to evaluate in this question
                </Typography>

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
                              {artifact.type}
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

                {question.artifacts.length < 5 && (
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Add Artifact</InputLabel>
                    <Select
                      value=""
                      label="Add Artifact"
                      onChange={(e) => addArtifactToQuestion(question.id, e.target.value)}
                    >
                      {artifacts
                        .filter(a => !question.artifacts.some(qa => qa.artifact_id === a.id))
                        .map(artifact => (
                          <MenuItem key={artifact.id} value={artifact.id}>
                            {artifact.name} ({artifact.type})
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                )}
              </Box>

              <Divider />

              {/* Criteria Section */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1">
                    Evaluation Criteria
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => addCriterionToQuestion(question.id)}
                    >
                      Custom Criterion
                    </Button>
                  </Box>
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
                {question.criteria.map((criterion, cIndex) => (
                  <Card key={criterion.id} variant="outlined" sx={{ mb: 2, p: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Criterion Name"
                          value={criterion.name}
                          onChange={(e) => updateCriterion(question.id, criterion.id, 'name', e.target.value)}
                          required
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Rating Scale</InputLabel>
                          <Select
                            value={criterion.scale}
                            label="Rating Scale"
                            onChange={(e) => updateCriterion(question.id, criterion.id, 'scale', e.target.value)}
                          >
                            {templates.scales.map((scale) => (
                              <MenuItem key={scale.value} value={scale.value}>
                                {scale.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Description"
                          value={criterion.description}
                          onChange={(e) => updateCriterion(question.id, criterion.id, 'description', e.target.value)}
                          multiline
                          rows={2}
                          size="small"
                          placeholder="Describe what participants should evaluate"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                ))}
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
    </Box>
  );
};

export default QuestionBuilder;
