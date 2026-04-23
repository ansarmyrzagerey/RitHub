import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  Rating,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Close,
  CheckCircle,
  Code,
  Image,
  Description,
  Highlight,
  MoreVert,
  Delete
} from '@mui/icons-material';
import ParticipantService from '../services/participantService';
import toast from 'react-hot-toast';

// Helper function to construct image URL
const getImageUrl = (url) => {
  if (!url) return '';
  
  // If URL is already absolute, check if it's from the same origin or needs adjustment
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // In Docker, backend might return localhost:5000 but frontend needs to use the proxy
    // Check if we're in Docker and need to use relative path instead
    const apiBaseUrl = process.env.REACT_APP_API_URL || '/api';
    
    // If API base is relative (/api), convert absolute backend URL to relative
    if (apiBaseUrl.startsWith('/')) {
      try {
        const urlObj = new URL(url);
        // Extract just the path part
        return urlObj.pathname;
      } catch (e) {
        // If URL parsing fails, try to extract path manually
        const match = url.match(/https?:\/\/[^\/]+(\/.*)/);
        if (match) {
          return match[1];
        }
      }
    }
    return url;
  }
  
  // If URL starts with /uploads, use as-is (will be served by backend)
  if (url.startsWith('/uploads')) {
    return url;
  }
  
  return url;
};

const CompletedEvaluationsDialog = ({ open, onClose, studyId, studyTitle, evaluationData = null }) => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedHighlight, setSelectedHighlight] = useState(null);
  const [highlightContext, setHighlightContext] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Handler to set highlight with context
  const handleHighlightClick = (highlight, sourceText, sourceLabel) => {
    setSelectedHighlight(highlight);
    setHighlightContext({
      text: sourceText,
      label: sourceLabel
    });
  };

  useEffect(() => {
    if (open) {
      if (evaluationData) {
        // Use provided evaluation data (for researchers)
        setEvaluations(Array.isArray(evaluationData) ? evaluationData : []);
        setLoading(false);
        setError(null);
      } else if (studyId) {
        // Load from API (for participants)
        loadCompletedEvaluations();
      } else {
        // No data source provided
        setEvaluations([]);
        setLoading(false);
      }
    }
  }, [open, studyId, evaluationData]);

  const loadCompletedEvaluations = async () => {
    try {
      setLoading(true);
      setError(null);
      // Extract participantId from URL if present (for admin viewing as participant)
      const searchParams = new URLSearchParams(window.location.search);
      const participantId = searchParams.get('participantId');
      const params = participantId ? { participantId } : {};
      const response = await ParticipantService.getCompletedEvaluations(studyId, params);
      setEvaluations(response.evaluations || []);
    } catch (err) {
      console.error('Failed to load completed evaluations:', err);
      setError('Failed to load completed evaluations. Please try again.');
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event, evaluationId) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedEvaluationId(evaluationId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedEvaluationId(null);
  };

  const handleDeleteEvaluation = async () => {
    if (!selectedEvaluationId) return;
    
    handleMenuClose();
    
    try {
      setDeleting(true);
      await ParticipantService.deleteEvaluation(selectedEvaluationId);
      toast.success('Evaluation moved to trash bin');
      // Reload evaluations to remove the deleted one
      await loadCompletedEvaluations();
    } catch (err) {
      console.error('Failed to delete evaluation:', err);
      toast.error('Failed to delete evaluation. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const getArtifactIcon = (type) => {
    if (!type) return <Code />;
    const lowerType = type.toLowerCase();
    if (lowerType.includes('image') || lowerType.includes('png') || lowerType.includes('jpg')) {
      return <Image />;
    }
    if (lowerType.includes('text') || lowerType.includes('document')) {
      return <Description />;
    }
    return <Code />;
  };

  const renderArtifact = (artifact, label, artifactHighlights = [], onHighlightClick) => {
    if (!artifact) return null;

    const artifactContent = typeof artifact.content === 'string' 
      ? artifact.content 
      : JSON.stringify(artifact.content, null, 2);

    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {getArtifactIcon(artifact.type)}
            <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
              {label}
            </Typography>
            {artifact.name && (
              <Chip label={artifact.name} size="small" sx={{ ml: 2 }} />
            )}
          </Box>
          {artifact.type && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Type: {artifact.type}
            </Typography>
          )}
          {artifact.content && (
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: 'grey.50', 
                maxHeight: '200px', 
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                position: 'relative'
              }}
            >
              {artifactHighlights.length > 0 ? (
                // Render with highlights
                (() => {
                  const sortedHighlights = [...artifactHighlights].sort((a, b) => a.startOffset - b.startOffset);
                  const parts = [];
                  let lastIndex = 0;

                  sortedHighlights.forEach((highlight, idx) => {
                    if (highlight.startOffset > lastIndex) {
                      parts.push(
                        <span key={`text-${idx}`}>
                          {artifactContent.substring(lastIndex, highlight.startOffset)}
                        </span>
                      );
                    }
                    parts.push(
                      <span
                        key={`highlight-${idx}`}
                        onClick={() => onHighlightClick && onHighlightClick(highlight, artifactContent, label)}
                        style={{
                          backgroundColor: '#fff9c4',
                          padding: '2px 4px',
                          cursor: 'pointer',
                          borderRadius: '2px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#fff59d';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#fff9c4';
                        }}
                        title="Click to view highlight details"
                      >
                        {artifactContent.substring(highlight.startOffset, highlight.endOffset)}
                      </span>
                    );
                    lastIndex = highlight.endOffset;
                  });

                  if (lastIndex < artifactContent.length) {
                    parts.push(
                      <span key="text-end">
                        {artifactContent.substring(lastIndex)}
                      </span>
                    );
                  }

                  return (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                      {parts}
                    </pre>
                  );
                })()
              ) : (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                  {artifactContent}
                </pre>
              )}
            </Paper>
          )}
          {/* Show artifact highlights list if any */}
          {artifactHighlights.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Highlights on this artifact ({artifactHighlights.length}):
              </Typography>
              {artifactHighlights.map((highlight, idx) => (
                <Paper
                  key={idx}
                  onClick={() => onHighlightClick && onHighlightClick(highlight, artifactContent, label)}
                  sx={{
                    mb: 0.5,
                    p: 1.5,
                    bgcolor: '#fff9c4',
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: '#fff59d',
                      transform: 'translateY(-1px)',
                      boxShadow: 2
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Highlight sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                      "{highlight.text}"
                    </Typography>
                  </Box>
                  {highlight.note && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 3 }}>
                      {highlight.note.length > 100 ? `${highlight.note.substring(0, 100)}...` : highlight.note}
                    </Typography>
                  )}
                  {highlight.imageUrl && (
                    <Box sx={{ mt: 0.5, ml: 3 }}>
                      <Chip
                        icon={<Image sx={{ fontSize: 14 }} />}
                        label="Has image"
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  )}
                </Paper>
              ))}
            </Box>
          )}

          {/* Show evaluation tags if any */}
          {artifact.tags && artifact.tags.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                Evaluation Tags:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {artifact.tags.map((tag, idx) => (
                  <Chip
                    key={idx}
                    label={tag}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderEvaluation = (evaluationData) => {
    const { task_type, instructions, answer_type, answer_options, artifact1, artifact2, artifact3, evaluation } = evaluationData;
    const { id: evaluationId, ratings, choice, text, comments, completed_at, annotations } = evaluation;
    const screenshots = annotations?.screenshots || [];
    const highlights = annotations?.highlights || [];
    const artifactHighlights = annotations?.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] };
    const isCompleted = !!completed_at;

    return (
      <Card key={evaluationData.task_id} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {task_type ? task_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Evaluation Task'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip 
                label={new Date(completed_at).toLocaleDateString()} 
                size="small" 
                color="success"
              />
              {isCompleted && evaluationId && (
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, evaluationId)}
                  sx={{ ml: 1 }}
                >
                  <MoreVert />
                </IconButton>
              )}
            </Box>
          </Box>

          {instructions && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {instructions}
            </Typography>
          )}

          {/* Artifacts */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Artifacts Evaluated
            </Typography>
            <Grid container spacing={2}>
              {artifact1 && (
                <Grid item xs={12} md={artifact2 || artifact3 ? 4 : 12}>
                  {renderArtifact(artifact1, artifact1.name, artifactHighlights.artifact1 || [], handleHighlightClick)}
                </Grid>
              )}
              {artifact2 && (
                <Grid item xs={12} md={artifact3 ? 4 : 6}>
                  {renderArtifact(artifact2, artifact2.name, artifactHighlights.artifact2 || [], handleHighlightClick)}
                </Grid>
              )}
              {artifact3 && (
                <Grid item xs={12} md={4}>
                  {renderArtifact(artifact3, artifact3.name, artifactHighlights.artifact3 || [], handleHighlightClick)}
                </Grid>
              )}
            </Grid>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Evaluation Results */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Your Evaluation
            </Typography>

            {/* Ratings */}
            {(answer_type === 'rating' || answer_type === 'rating_required_comments') && ratings && (
              <Box sx={{ mb: 2 }}>
                {ratings.artifact1 !== undefined && ratings.artifact1 !== null && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Artifact 1 Rating:
                    </Typography>
                    <Rating value={ratings.artifact1} readOnly size="large" />
                  </Box>
                )}
                {ratings.artifact2 !== undefined && ratings.artifact2 !== null && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Artifact 2 Rating:
                    </Typography>
                    <Rating value={ratings.artifact2} readOnly size="large" />
                  </Box>
                )}
                {ratings.artifact3 !== undefined && ratings.artifact3 !== null && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Artifact 3 Rating:
                    </Typography>
                    <Rating value={ratings.artifact3} readOnly size="large" />
                  </Box>
                )}
                {/* Handle criteria-based ratings */}
                {Object.keys(ratings)
                  .filter(key => !['artifact1', 'artifact2', 'artifact3'].includes(key))
                  .filter(key => isNaN(Number(key))) // Exclude numeric-only keys like "9"
                  .map(criterionId => (
                  <Box key={criterionId} sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {criterionId}:
                    </Typography>
                    {typeof ratings[criterionId] === 'number' ? (
                      <Rating value={ratings[criterionId]} readOnly size="large" />
                    ) : (
                      <Typography variant="body2">{ratings[criterionId]}</Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* Choice */}
            {(answer_type === 'choice' || answer_type === 'choice_required_text') && choice && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Selected Choice:
                </Typography>
                {answer_options && answer_options.options ? (
                  <Chip 
                    label={answer_options.options.find(opt => opt.value === choice)?.label || choice}
                    color="primary"
                    sx={{ mb: 1 }}
                  />
                ) : (
                  <Typography variant="body2">{choice}</Typography>
                )}
              </Box>
            )}

            {/* Text */}
            {(answer_type === 'text_required' || answer_type === 'choice_required_text') && text && text !== comments && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  {answer_options?.textLabel || 'Your Response'}:
                </Typography>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  <Typography variant="body2">{text}</Typography>
                </Paper>
              </Box>
            )}

            {/* Comments */}
            {comments && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  {(answer_type === 'choice_required_text' && text === comments) ? (answer_options?.textLabel || 'Explanation') : 'Comments'}:
                </Typography>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  <Typography variant="body2">{comments}</Typography>
                </Paper>
              </Box>
            )}

            {/* Screenshots */}
            {screenshots && screenshots.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Screenshots ({screenshots.length}):
                </Typography>
                <Grid container spacing={2}>
                  {screenshots.map((screenshot, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Box>
                        <img
                          src={getImageUrl(screenshot.url)}
                          alt={screenshot.fileName || `Screenshot ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            backgroundColor: '#f5f5f5'
                          }}
                          onError={(e) => {
                            console.error('Failed to load screenshot:', {
                              originalUrl: screenshot.url,
                              processedUrl: getImageUrl(screenshot.url)
                            });
                            e.target.style.display = 'none';
                          }}
                        />
                        {screenshot.fileName && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {screenshot.fileName}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Highlights */}
            {highlights && highlights.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Highlights ({highlights.length}):
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {highlights.map((highlight, index) => (
                    <Paper 
                      key={index}
                      onClick={() => handleHighlightClick(highlight, instructions, 'Task Instructions')}
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        bgcolor: '#fff9c4',
                        borderLeft: '4px solid #ffc107',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: '#fff59d',
                          transform: 'translateY(-1px)',
                          boxShadow: 3
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Highlight sx={{ fontSize: 18, color: '#ffc107' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                          "{highlight.text}"
                        </Typography>
                      </Box>
                      {highlight.note && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {highlight.note.length > 150 ? `${highlight.note.substring(0, 150)}...` : highlight.note}
                        </Typography>
                      )}
                      {highlight.imageUrl && (
                        <Box sx={{ mt: 1 }}>
                          <Chip
                            icon={<Image sx={{ fontSize: 14 }} />}
                            label="Has image attachment"
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      )}
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}

            {/* Instructions with highlights */}
            {instructions && highlights && highlights.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Task Instructions (with highlights):
                </Typography>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50',
                    position: 'relative'
                  }}
                >
                  {(() => {
                    // Render instructions with highlights
                    const sortedHighlights = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
                    const parts = [];
                    let lastIndex = 0;

                    sortedHighlights.forEach((highlight, idx) => {
                      if (highlight.startOffset > lastIndex) {
                        parts.push(
                          <span key={`text-${idx}`}>
                            {instructions.substring(lastIndex, highlight.startOffset)}
                          </span>
                        );
                      }
                      parts.push(
                        <span
                          key={`highlight-${idx}`}
                          onClick={() => handleHighlightClick(highlight, instructions, 'Task Instructions')}
                          style={{
                            backgroundColor: '#fff9c4',
                            padding: '2px 4px',
                            cursor: 'pointer',
                            borderRadius: '2px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#fff59d';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#fff9c4';
                          }}
                          title="Click to view highlight details"
                        >
                          {instructions.substring(highlight.startOffset, highlight.endOffset)}
                        </span>
                      );
                      lastIndex = highlight.endOffset;
                    });

                    if (lastIndex < instructions.length) {
                      parts.push(
                        <span key="text-end">
                          {instructions.substring(lastIndex)}
                        </span>
                      );
                    }

                    return (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {parts}
                      </Typography>
                    );
                  })()}
                </Paper>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Completed Evaluations
          </Typography>
          <Button
            onClick={onClose}
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <Close />
          </Button>
        </Box>
        {studyTitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {studyTitle}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : evaluations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Completed Evaluations
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You haven't completed any evaluations for this study yet.
            </Typography>
          </Box>
        ) : (
          <Box>
            {evaluations.map((evaluation) => renderEvaluation(evaluation))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>

      {/* Highlight Detail Dialog */}
      <Dialog
        open={!!selectedHighlight}
        onClose={() => {
          setSelectedHighlight(null);
          setHighlightContext(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Highlight sx={{ color: '#ffc107' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Highlight Details
              </Typography>
            </Box>
            <Button
              onClick={() => {
                setSelectedHighlight(null);
                setHighlightContext(null);
              }}
              sx={{ minWidth: 'auto', p: 1 }}
            >
              <Close />
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedHighlight && (
            <Box>
              {/* Source Context */}
              {highlightContext && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
                    Source: {highlightContext.label}
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      bgcolor: 'grey.50',
                      maxHeight: '300px',
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      position: 'relative'
                    }}
                  >
                    {(() => {
                      const sourceText = highlightContext.text;
                      const startOffset = selectedHighlight.startOffset || 0;
                      const endOffset = selectedHighlight.endOffset || 0;
                      const contextBefore = Math.max(0, startOffset - 200);
                      const contextAfter = Math.min(sourceText.length, endOffset + 200);
                      const showBeforeEllipsis = contextBefore > 0;
                      const showAfterEllipsis = contextAfter < sourceText.length;
                      
                      const beforeText = sourceText.substring(contextBefore, startOffset);
                      const highlightText = sourceText.substring(startOffset, endOffset);
                      const afterText = sourceText.substring(endOffset, contextAfter);

                      return (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                          {showBeforeEllipsis && <span style={{ color: '#666' }}>...</span>}
                          <span>{beforeText}</span>
                          <span
                            style={{
                              backgroundColor: '#fff9c4',
                              padding: '2px 4px',
                              fontWeight: 600,
                              borderLeft: '3px solid #ffc107'
                            }}
                          >
                            {highlightText}
                          </span>
                          <span>{afterText}</span>
                          {showAfterEllipsis && <span style={{ color: '#666' }}>...</span>}
                        </pre>
                      );
                    })()}
                  </Paper>
                </Box>
              )}

              {/* Highlighted Text */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
                  Highlighted Text:
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: '#fff9c4',
                    borderLeft: '4px solid #ffc107'
                  }}
                >
                  <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                    "{selectedHighlight.text}"
                  </Typography>
                </Paper>
              </Box>

              {/* Note */}
              {selectedHighlight.note && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
                    Note:
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      bgcolor: 'grey.50',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    <Typography variant="body2">
                      {selectedHighlight.note}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {/* Image */}
              {selectedHighlight.imageUrl && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
                    Attached Image:
                  </Typography>
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      bgcolor: 'grey.50'
                    }}
                  >
                    <img
                      src={getImageUrl(selectedHighlight.imageUrl)}
                      alt="Highlight attachment"
                      style={{
                        width: '100%',
                        maxHeight: '400px',
                        objectFit: 'contain',
                        display: 'block'
                      }}
                      onError={(e) => {
                        console.error('Failed to load highlight image:', {
                          originalUrl: selectedHighlight.imageUrl,
                          processedUrl: getImageUrl(selectedHighlight.imageUrl)
                        });
                        e.target.style.display = 'none';
                        const errorDiv = document.createElement('div');
                        errorDiv.textContent = 'Image failed to load';
                        errorDiv.style.cssText = 'padding: 20px; color: red; text-align: center;';
                        e.target.parentElement.appendChild(errorDiv);
                      }}
                    />
                  </Box>
                </Box>
              )}

              {!selectedHighlight.note && !selectedHighlight.imageUrl && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No additional notes or images attached to this highlight.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setSelectedHighlight(null);
              setHighlightContext(null);
            }} 
            variant="contained"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Menu - rendered once outside cards */}
      {menuAnchor && (
        <Menu
          anchorEl={menuAnchor}
          open={menuAnchor !== null}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleDeleteEvaluation} disabled={deleting}>
            <ListItemIcon>
              <Delete fontSize="small" />
            </ListItemIcon>
            <ListItemText>Delete Evaluation</ListItemText>
          </MenuItem>
        </Menu>
      )}
    </Dialog>
  );
};

export default CompletedEvaluationsDialog;

