import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Rating,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Chip,
  IconButton
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Code,
  Image,
  Description,
  CameraAlt,
  Delete
} from '@mui/icons-material';

// Import services
import ParticipantService from '../services/participantService';
import api from '../services/api';

// Import styles
import '../styles/globals.css';
import '../styles/components.css';
import SynchronizedArtifactComparison from '../components/SynchronizedArtifactComparison';
import HighlightableText from '../components/HighlightableText';
import AuthenticatedImage from '../components/AuthenticatedImage';
import plantumlEncoder from 'plantuml-encoder';

// Helper function to construct image URL
const getImageUrl = (url) => {
  if (!url) return '';
  console.log('[getImageUrl] Original URL:', url);
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const apiBaseUrl = process.env.REACT_APP_API_URL || '/api';
    if (apiBaseUrl.startsWith('/')) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        console.log('[getImageUrl] Converted absolute URL to pathname:', pathname);
        return pathname;
      } catch (e) {
        const match = url.match(/https?:\/\/[^\/]+(\/.*)/);
        if (match) {
          const pathname = match[1];
          console.log('[getImageUrl] Extracted pathname from URL:', pathname);
          return pathname;
        }
      }
    }
    console.log('[getImageUrl] Using absolute URL as-is:', url);
    return url;
  }
  
  if (url.startsWith('/uploads')) {
    console.log('[getImageUrl] Using /uploads URL as-is:', url);
    return url;
  }
  
  console.log('[getImageUrl] Returning URL as-is:', url);
  return url;
};

const ParticipantTaskEvaluation = () => {
  const { id: studyId, taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [evaluationData, setEvaluationData] = useState({
    ratings: {},
    choice: '',
    text: '',
    comments: '',
    annotations: {}
  });
  const [artifactTags, setArtifactTags] = useState({}); // { taskId: { artifactId: [tags] } }
  const [newTagInputs, setNewTagInputs] = useState({}); // { taskId-artifactId: 'tag text' }

  useEffect(() => {
    loadTaskDetails();
  }, [taskId]);

  const loadTaskDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch task details from backend
      const response = await api.get(`/participant/tasks/${taskId}`);
      const taskData = response.data;
      
      // Debug logging for task data
      console.log('[ParticipantTaskEvaluation] Loaded task data:', {
        taskId,
        answerType: taskData.answer_type,
        answerOptions: taskData.answer_options,
        answerOptionsCriteria: taskData.answer_options?.criteria,
        taskCriteria: taskData.criteria,
        taskCriteriaLength: taskData.criteria?.length || 0,
        artifact1: taskData.artifact1 ? {
          id: taskData.artifact1.id,
          name: taskData.artifact1.name,
          type: taskData.artifact1.type,
          storage_type: taskData.artifact1.storage_type,
          hasContent: !!taskData.artifact1.content,
          hasFilePath: !!taskData.artifact1.file_path
        } : null,
        artifact2: taskData.artifact2 ? {
          id: taskData.artifact2.id,
          name: taskData.artifact2.name,
          type: taskData.artifact2.type
        } : null,
        artifact3: taskData.artifact3 ? {
          id: taskData.artifact3.id,
          name: taskData.artifact3.name,
          type: taskData.artifact3.type
        } : null
      });
      
      setTask(taskData);
      
      // Initialize evaluation data based on answer type
      const initialRatings = {};
      if (taskData.criteria && taskData.criteria.length > 0) {
        taskData.criteria.forEach(criterion => {
          initialRatings[criterion.id] = 0;
        });
      }
      // Initialize ratings for artifacts if answer type is rating-based
      if (taskData.answer_type === 'rating' || taskData.answer_type === 'rating_required_comments') {
        if (taskData.artifact1) initialRatings.artifact1 = 0;
        if (taskData.artifact2) initialRatings.artifact2 = 0;
        if (taskData.artifact3) initialRatings.artifact3 = 0;
      }
      setEvaluationData(prev => ({
        ...prev,
        ratings: initialRatings
      }));
    } catch (error) {
      console.error('Failed to load task details:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to load task details. Please try again later.';
      setError(errorMessage);
      // Log more details for debugging
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Error status:', error.response.status);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (criterionId, value) => {
    setEvaluationData(prev => ({
      ...prev,
      ratings: {
        ...prev.ratings,
        [criterionId]: value
      }
    }));
  };

  const handleChoiceChange = (value) => {
    setEvaluationData(prev => ({
      ...prev,
      choice: value
    }));
  };

  const handleTextChange = (value) => {
    setEvaluationData(prev => ({
      ...prev,
      text: value
    }));
  };

  const handleCommentsChange = (value) => {
    setEvaluationData(prev => ({
      ...prev,
      comments: value
    }));
  };

  const handleHighlightAdd = (taskId, highlight, artifactKey = null) => {
    setEvaluationData(prev => {
      const taskData = prev[taskId] || {};
      const artifactHighlights = taskData.artifactHighlights || {};
      const artifactKeyHighlights = artifactHighlights[artifactKey] || [];

      return {
        ...prev,
        [taskId]: {
          ...taskData,
          artifactHighlights: {
            ...artifactHighlights,
            [artifactKey]: [...artifactKeyHighlights, highlight]
          }
        }
      };
    });
  };

  const handleHighlightUpdate = (taskId, highlight, artifactKey = null) => {
    setEvaluationData(prev => {
      const taskData = prev[taskId] || {};
      const artifactHighlights = taskData.artifactHighlights || {};
      const artifactKeyHighlights = artifactHighlights[artifactKey] || [];

      return {
        ...prev,
        [taskId]: {
          ...taskData,
          artifactHighlights: {
            ...artifactHighlights,
            [artifactKey]: artifactKeyHighlights.map(h =>
              h.id === highlight.id ? highlight : h
            )
          }
        }
      };
    });
  };

  const handleHighlightDelete = (taskId, highlightId, artifactKey = null) => {
    setEvaluationData(prev => {
      const taskData = prev[taskId] || {};
      const artifactHighlights = taskData.artifactHighlights || {};
      const artifactKeyHighlights = artifactHighlights[artifactKey] || [];

      return {
        ...prev,
        [taskId]: {
          ...taskData,
          artifactHighlights: {
            ...artifactHighlights,
            [artifactKey]: artifactKeyHighlights.filter(h => h.id !== highlightId)
          }
        }
      };
    });
  };

  const handleHighlightImageUpload = async (taskId, formData) => {
    try {
      const response = await ParticipantService.uploadHighlightImage(taskId, formData);
      return response;
    } catch (error) {
      console.error('Failed to upload highlight image:', error);
      throw error;
    }
  };

  const handleScreenshotUpload = async (taskId, file) => {
    try {
      const formData = new FormData();
      formData.append('screenshot', file);

      const response = await ParticipantService.uploadScreenshot(taskId, formData);
      if (response && response.image) {
        const newScreenshot = {
          id: response.image.id,
          url: response.image.url,
          fileName: response.image.fileName
        };

        setEvaluationData(prev => {
          const taskData = prev[taskId] || {};
          return {
            ...prev,
            [taskId]: {
              ...taskData,
              screenshots: [...(taskData.screenshots || []), newScreenshot]
            }
          };
        });

        return newScreenshot;
      }
    } catch (error) {
      console.error('Failed to upload screenshot:', error);
      throw error;
    }
  };

  const handleScreenshotDelete = (taskId, screenshotId) => {
    setEvaluationData(prev => {
      const taskData = prev[taskId] || {};
      return {
        ...prev,
        [taskId]: {
          ...taskData,
          screenshots: (taskData.screenshots || []).filter(s => s.id !== screenshotId)
        }
      };
    });
  };

  const handleTagChange = async (taskId, artifactId, tags) => {
    // Update local state immediately
    setArtifactTags(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [artifactId]: tags
      }
    }));

    // Clear input for this artifact
    const inputKey = `${taskId}-${artifactId}`;
    setNewTagInputs(prev => ({
      ...prev,
      [inputKey]: ''
    }));

    // In a real implementation, you might want to save this to the server
    // For now, we'll just keep it in local state
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      // Validate based on answer type
      const answerType = task.answer_type || 'rating';
      const answerOptions = task.answer_options || {};

      if (answerType === 'rating' || answerType === 'rating_required_comments') {
        // Validate ratings for all artifacts
        const missingRatings = [];
        if (task.artifact1 && (!evaluationData.ratings.artifact1 || evaluationData.ratings.artifact1 === 0)) {
          missingRatings.push('Artifact 1');
        }
        if (task.artifact2 && (!evaluationData.ratings.artifact2 || evaluationData.ratings.artifact2 === 0)) {
          missingRatings.push('Artifact 2');
        }
        if (task.artifact3 && (!evaluationData.ratings.artifact3 || evaluationData.ratings.artifact3 === 0)) {
          missingRatings.push('Artifact 3');
        }
        if (missingRatings.length > 0) {
          setError(`Please provide ratings for: ${missingRatings.join(', ')}`);
          setSubmitting(false);
          return;
        }
        // Validate required comments
        if (answerType === 'rating_required_comments' && !evaluationData.comments?.trim()) {
          setError('Comments are required for this task.');
          setSubmitting(false);
          return;
        }
      } else if (answerType === 'choice' || answerType === 'choice_required_text') {
        // Validate choice selection
        if (!evaluationData.choice) {
          setError('Please select an option.');
          setSubmitting(false);
          return;
        }
        // Validate required text
        if (answerType === 'choice_required_text' && !evaluationData.text?.trim()) {
          setError('Explanation is required for this task.');
          setSubmitting(false);
          return;
        }
      } else if (answerType === 'text_required') {
        // Validate required text
        if (!evaluationData.text?.trim()) {
          setError('Please provide your evaluation.');
          setSubmitting(false);
          return;
        }
      }

      // Submit evaluation
      // Get task-specific data from evaluationData (data is stored by taskId)
      const taskData = evaluationData[taskId] || {};
      const submissionData = {
        ratings: taskData.ratings || evaluationData.ratings || {},
        choice: taskData.choice || evaluationData.choice || '',
        text: taskData.text || evaluationData.text || '',
        comments: taskData.comments || evaluationData.comments || '',
        annotations: taskData.annotations || evaluationData.annotations || {},
        screenshots: taskData.screenshots || [],
        artifactHighlights: taskData.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }
      };

      // Check if submit endpoint exists, otherwise use a placeholder
      try {
        await api.post(`/participant/tasks/${taskId}/evaluate`, submissionData);
      } catch (submitError) {
        // If endpoint doesn't exist, we'll just update the task progress
        console.log('Submit endpoint not available, updating task progress only');
      }

      // Update task progress to completed
      await api.post(`/participant/tasks/${taskId}/complete`).catch(() => {
        // If complete endpoint doesn't exist, that's okay
        console.log('Complete endpoint not available');
      });

      // Navigate back to study details
      navigate(`/participant/studies/${studyId}`);
    } catch (error) {
      console.error('Failed to submit evaluation:', error);
      setError(error.response?.data?.error || 'Failed to submit evaluation. Please try again.');
    } finally {
      setSubmitting(false);
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

  const renderArtifact = (artifact, label) => {
    if (!artifact) return null;

    const artifactType = artifact.type?.toLowerCase() || '';
    // Normalize artifact type for more flexible matching (remove extra spaces, normalize separators)
    const normalizedType = artifactType.trim().replace(/[-_\s]+/g, ' ');
    
    // Helper to check if type is UI snapshot (handles variations like 'ui_snapshot', 'ui snapshot', 'ui-snapshot', etc.)
    const isUISnapshotType = (type) => {
      if (!type) return false;
      const normalized = type.trim().replace(/[-_\s]+/g, ' ').toLowerCase();
      // Check for exact match or if it starts with "ui snapshot" (handles variations)
      return normalized === 'ui snapshot' || normalized.startsWith('ui snapshot');
    };
    
    // Check if it's an image type (including ui_snapshot)
    const isImageType = artifactType.includes('image') || 
                       isUISnapshotType(artifactType) ||
                       (artifact.name && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(artifact.name));
    
    console.log('[renderArtifact] Artifact type check:', {
      artifactType,
      normalizedType,
      originalType: artifact.type,
      isImageType,
      artifactName: artifact.name
    });

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
          {/* Render image for ui_snapshot and image types */}
          {isImageType ? (() => {
            // Determine image source - prioritize in this order:
            // 1. Valid data URLs (already formatted)
            // 2. Valid base64 content in artifact.content (only if NOT database storage)
            // 3. Filesystem file_path (if available)
            // 4. Participant artifact image endpoint (for database storage or as fallback)
            
            let imageSrc = null;
            
            console.log('[renderArtifact] Determining image source for artifact:', {
              id: artifact.id,
              name: artifact.name,
              type: artifact.type,
              storageType: artifact.storage_type,
              hasImageUrl: !!artifact.image_url,
              hasContent: !!artifact.content,
              contentLength: artifact.content?.length,
              hasFilePath: !!artifact.file_path
            });
            
            // For ui_snapshot or database storage, prefer the endpoint
            // Use flexible check to handle variations in type string
            const isUISnapshot = isUISnapshotType(artifactType);
            const isDatabaseStorage = artifact.storage_type === 'database';
            
            console.log('[renderArtifact] Storage check:', {
              isUISnapshot,
              isDatabaseStorage,
              storageType: artifact.storage_type,
              artifactId: artifact.id,
              hasImageUrl: !!artifact.image_url,
              hasContent: !!artifact.content,
              hasFilePath: !!artifact.file_path
            });
            
            // Check for valid data URL
            if (artifact.image_url && (artifact.image_url.startsWith('data:') || artifact.image_url.startsWith('http'))) {
              imageSrc = artifact.image_url;
              console.log('[renderArtifact] Using image_url:', imageSrc);
            }
            // UI snapshots ALWAYS use the endpoint (regardless of storage type)
            // The endpoint handles both database and filesystem storage
            else if (isUISnapshot) {
              if (!artifact.id) {
                console.error('[renderArtifact] Artifact ID is missing for ui_snapshot:', {
                  artifact,
                  artifactType,
                  originalType: artifact.type
                });
                return (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography color="error">Artifact ID is missing. Cannot load UI snapshot.</Typography>
                  </Box>
                );
              }
              imageSrc = `/api/participant/artifacts/${artifact.id}/image`;
              console.log('[renderArtifact] Using participant image endpoint (ui_snapshot):', imageSrc);
            }
            // For database storage, use endpoint (skip base64 check)
            else if (isDatabaseStorage) {
              if (!artifact.id) {
                console.error('[renderArtifact] Artifact ID is missing for database storage:', artifact);
                return (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography color="error">Artifact ID is missing</Typography>
                  </Box>
                );
              }
              imageSrc = `/api/participant/artifacts/${artifact.id}/image`;
              console.log('[renderArtifact] Using participant image endpoint (database storage):', imageSrc);
            }
            // Check for base64 content (only if NOT database storage and NOT ui_snapshot)
            else if (artifact.content && typeof artifact.content === 'string' && 
                     artifact.content.length > 100 && 
                     /^[A-Za-z0-9+/=\s]+$/.test(artifact.content.trim()) &&
                     !artifact.content.startsWith('http') &&
                     !artifact.content.startsWith('/')) {
              // Looks like base64 - convert to data URL
              const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : (artifact.metadata || {});
              const imageFormat = metadata.format || metadata.mimeType?.split('/')[1] || artifact.mime_type?.split('/')[1] || 'png';
              imageSrc = `data:image/${imageFormat};base64,${artifact.content.trim()}`;
              console.log('[renderArtifact] Using base64 content');
            }
            // Check for filesystem path (only if NOT ui_snapshot - ui_snapshots should use endpoint)
            else if (artifact.storage_type === 'filesystem' && artifact.file_path && !isUISnapshot) {
              const filePath = artifact.file_path.replace(/\\/g, '/');
              const uploadsPath = filePath.startsWith('/uploads') ? filePath : `/uploads/${filePath}`;
              imageSrc = getImageUrl(uploadsPath);
              console.log('[renderArtifact] Using filesystem path:', imageSrc);
            }
            // Default: use participant artifact image endpoint
            else {
              if (!artifact.id) {
                console.error('[renderArtifact] Artifact ID is missing (fallback):', {
                  artifact,
                  artifactType,
                  storageType: artifact.storage_type
                });
                return (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography color="error">Artifact ID is missing. Cannot load image.</Typography>
                  </Box>
                );
              }
              imageSrc = `/api/participant/artifacts/${artifact.id}/image`;
              console.log('[renderArtifact] Using participant image endpoint (fallback):', imageSrc);
            }

            if (!imageSrc) {
              console.error('[renderArtifact] No image source determined');
              return (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography color="error">Unable to load image</Typography>
                </Box>
              );
            }

            // Always use AuthenticatedImage for /api endpoints
            const isAuthenticatedEndpoint = imageSrc.startsWith('/api/') || imageSrc.includes('/participant/artifacts/');
            console.log('[renderArtifact] Image source determined:', { imageSrc, isAuthenticatedEndpoint });

            return (
              <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                p: 2,
                maxHeight: '500px',
                overflow: 'auto',
                minHeight: '200px'
              }}>
                {isAuthenticatedEndpoint ? (
                  <AuthenticatedImage
                    src={imageSrc}
                    alt={artifact.name || 'Artifact'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      borderRadius: '4px'
                    }}
                    onError={(e) => {
                      console.error('[renderArtifact] AuthenticatedImage error:', {
                        src: imageSrc,
                        artifactId: artifact.id,
                        artifactName: artifact.name,
                        artifactType: artifact.type,
                        storageType: artifact.storage_type,
                        filePath: artifact.file_path,
                        isUISnapshot: isUISnapshotType(artifactType),
                        error: e
                      });
                    }}
                    onLoad={() => {
                      console.log('[renderArtifact] Image loaded successfully:', {
                        artifactId: artifact.id,
                        artifactName: artifact.name,
                        artifactType: artifact.type,
                        imageSrc
                      });
                    }}
                  />
                ) : (
                  <img
                    src={imageSrc}
                    alt={artifact.name || 'Artifact'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      borderRadius: '4px'
                    }}
                    onError={(e) => {
                      console.error('[renderArtifact] Image load error:', {
                        src: imageSrc,
                        artifactId: artifact.id,
                        artifactName: artifact.name,
                        storageType: artifact.storage_type,
                        filePath: artifact.file_path
                      });
                    }}
                    onLoad={() => {
                      console.log('[renderArtifact] Image loaded successfully:', artifact.id);
                    }}
                  />
                )}
              </Box>
            );
          })() : (() => {
            // Check if it's a UML diagram - show both visual and text
            const isUMLDiagram = artifactType === 'uml_diagram' || artifactType.includes('uml');
            
            if (isUMLDiagram && artifact.content) {
              // Get image URL from metadata OR generate it from content
              const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : (artifact.metadata || {});
              let umlImageUrl = metadata.renderedImage;

              // If no image URL in metadata but it's a UML diagram, generate it from content
              if (!umlImageUrl && artifact.content) {
                try {
                  const encoded = plantumlEncoder.encode(artifact.content);
                  umlImageUrl = `http://www.plantuml.com/plantuml/png/${encoded}`;
                } catch (error) {
                  console.error('[renderArtifact] Error encoding PlantUML:', error);
                }
              }

              return (
                <Box>
                  {/* UML Visual Preview */}
                  {umlImageUrl && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Rendered Diagram:
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          bgcolor: 'white',
                          borderRadius: 1,
                          p: 2,
                          border: 1,
                          borderColor: 'grey.300'
                        }}
                      >
                        <img
                          src={umlImageUrl}
                          alt="UML Diagram"
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                          onError={(e) => {
                            console.error('[renderArtifact] Error loading UML image');
                            e.target.style.display = 'none';
                          }}
                        />
                      </Box>
                    </Box>
                  )}

                  {/* PlantUML Source Code / Text Content */}
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'grey.50', 
                      maxHeight: '400px', 
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }}
                  >
                    {umlImageUrl && (
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        PlantUML Source Code:
                      </Typography>
                    )}
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                      {typeof artifact.content === 'string' 
                        ? artifact.content 
                        : JSON.stringify(artifact.content, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              );
            }

            // For non-UML text content
            if (artifact.content) {
              return (
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50', 
                    maxHeight: '400px', 
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                    {typeof artifact.content === 'string' 
                      ? artifact.content 
                      : JSON.stringify(artifact.content, null, 2)}
                  </pre>
                </Paper>
              );
            }

            return null;
          })()}
          {artifact.metadata && Object.keys(artifact.metadata).length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Metadata: {JSON.stringify(artifact.metadata)}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !task) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/participant/studies/${studyId}`)}
          sx={{ mb: 2 }}
        >
          Back to Study
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!task) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/participant/studies/${studyId}`)}
          sx={{ mb: 2 }}
        >
          Back to Study
        </Button>
        <Alert severity="warning">Task not found</Alert>
      </Box>
    );
  }

  const hasMultipleArtifacts = (task.artifact1 ? 1 : 0) + (task.artifact2 ? 1 : 0) + (task.artifact3 ? 1 : 0) > 1;

  return (
    <Box>
        {/* Back Button */}
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/participant/studies/${studyId}`)}
          sx={{ mb: 3 }}
        >
          Back to Study
        </Button>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Task Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          {task.task_type ? task.task_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Evaluation Task'}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {task.instructions || 'Please evaluate the artifacts below.'}
        </Typography>
        {task.study_title && (
          <Chip 
            label={task.study_title} 
            size="small" 
            sx={{ mb: 2 }}
          />
        )}
      </Box>

      {/* Artifacts Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
          Artifacts to Evaluate
        </Typography>

        {/* Use synchronized comparison for multiple artifacts */}
        {hasMultipleArtifacts ? (
          <SynchronizedArtifactComparison
            artifacts={[task.artifact1, task.artifact2, task.artifact3].filter(Boolean)}
            taskId={taskId}
            evaluationData={evaluationData}
            artifactTags={artifactTags}
            newTagInputs={newTagInputs}
            onTagChange={handleTagChange}
            onHighlightAdd={handleHighlightAdd}
            onHighlightUpdate={handleHighlightUpdate}
            onHighlightDelete={handleHighlightDelete}
            onHighlightImageUpload={handleHighlightImageUpload}
            setNewTagInputs={setNewTagInputs}
          />
        ) : (
          /* Fallback to single artifact view for single artifact tasks */
          <Grid container spacing={3}>
            {task.artifact1 ? (
              <Grid item xs={12}>
                {renderArtifact(task.artifact1, task.artifact1.name || 'Artifact 1')}
              </Grid>
            ) : (
              <Grid item xs={12}>
                <Alert severity="warning">No artifact found for this task.</Alert>
              </Grid>
            )}
          </Grid>
        )}
      </Box>

      {/* Evaluation Form */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
            Your Evaluation
          </Typography>

          {(() => {
            const answerType = task.answer_type || 'rating';
            const answerOptions = task.answer_options || {};

            // Rating-based answer types
            if (answerType === 'rating' || answerType === 'rating_required_comments') {
              return (
                <>
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      Rate the Artifacts
                    </Typography>
                    {task.artifact1 && (
                      <Box sx={{ mb: 3 }}>
                        <FormLabel component="legend" sx={{ mb: 1, display: 'block' }}>
                          Artifact 1
                        </FormLabel>
                        <Rating
                          value={evaluationData.ratings.artifact1 || 0}
                          onChange={(event, newValue) => handleRatingChange('artifact1', newValue)}
                          max={5}
                          size="large"
                        />
                      </Box>
                    )}
                    {task.artifact2 && (
                      <Box sx={{ mb: 3 }}>
                        <FormLabel component="legend" sx={{ mb: 1, display: 'block' }}>
                          Artifact 2
                        </FormLabel>
                        <Rating
                          value={evaluationData.ratings.artifact2 || 0}
                          onChange={(event, newValue) => handleRatingChange('artifact2', newValue)}
                          max={5}
                          size="large"
                        />
                      </Box>
                    )}
                    {task.artifact3 && (
                      <Box sx={{ mb: 3 }}>
                        <FormLabel component="legend" sx={{ mb: 1, display: 'block' }}>
                          Artifact 3
                        </FormLabel>
                        <Rating
                          value={evaluationData.ratings.artifact3 || 0}
                          onChange={(event, newValue) => handleRatingChange('artifact3', newValue)}
                          max={5}
                          size="large"
                        />
                      </Box>
                    )}
                  </Box>
                  {/* Comments for rating types */}
                  {(answerType === 'rating' || answerType === 'rating_required_comments') && (
                    <Box sx={{ mb: 3 }}>
                      <TextField
                        label={answerOptions.textLabel || 'Comments'}
                        multiline
                        rows={4}
                        fullWidth
                        required={answerType === 'rating_required_comments'}
                        value={evaluationData.comments}
                        onChange={(e) => handleCommentsChange(e.target.value)}
                        placeholder={answerOptions.textPlaceholder || (answerType === 'rating' ? 'Add any additional comments (optional)...' : 'Please provide your comments...')}
                      />
                    </Box>
                  )}
                </>
              );
            }

            // Choice-based answer types
            if (answerType === 'choice' || answerType === 'choice_required_text') {
              // Get criteria from answerOptions or task as fallback
              const criteria = answerOptions.criteria || task.criteria || [];
              
              // Helper function to get artifact name from option value
              const getArtifactName = (optionValue) => {
                // Handle both artifact1 and artifact_1 formats
                if (optionValue === 'artifact1' || optionValue === 'artifact_1') {
                  return task.artifact1?.name || null;
                }
                if (optionValue === 'artifact2' || optionValue === 'artifact_2') {
                  return task.artifact2?.name || null;
                }
                if (optionValue === 'artifact3' || optionValue === 'artifact_3') {
                  return task.artifact3?.name || null;
                }
                return null;
              };
              
              // Helper function to format label with artifact name
              const formatLabel = (option) => {
                const artifactName = getArtifactName(option.value);
                if (artifactName) {
                  // Add artifact name in parentheses after the label
                  return `${option.label} (${artifactName})`;
                }
                return option.label;
              };
              
              // Debug logging
              console.log('[ParticipantTaskEvaluation] Choice task criteria:', {
                answerType,
                answerOptions,
                answerOptionsCriteria: answerOptions?.criteria,
                taskCriteria: task.criteria,
                finalCriteria: criteria,
                criteriaLength: criteria.length
              });
              
              return (
                <>
                  {/* Display the question */}
                  <Box sx={{ mb: 4 }}>
                    <FormControl component="fieldset" fullWidth>
                      <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
                        <Typography component="div" sx={{ whiteSpace: 'pre-line' }}>
                          {answerOptions.question || 'Select your choice'}
                        </Typography>
                      </FormLabel>
                      <RadioGroup
                        value={evaluationData.choice}
                        onChange={(e) => handleChoiceChange(e.target.value)}
                      >
                        {answerOptions.options && answerOptions.options.map((option, index) => (
                          <FormControlLabel
                            key={index}
                            value={option.value}
                            control={<Radio />}
                            label={formatLabel(option)}
                            sx={{ mb: 1 }}
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </Box>
                  {/* Display criteria after the question if they exist */}
                  {criteria && criteria.length > 0 && (
                    <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                        Evaluation Criteria
                      </Typography>
                      {criteria.map((criterion) => (
                        <Box key={criterion.id || criterion.name} sx={{ mb: 2 }}>
                          <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {criterion.name}
                          </Typography>
                          {criterion.description && (
                            <Typography variant="body2" color="text.secondary">
                              {criterion.description}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                  {/* Optional or required text field */}
                  {(answerOptions.textOptional !== false) && (
                    <Box sx={{ mb: 3 }}>
                      <TextField
                        label={answerOptions.textLabel || 'Additional Comments'}
                        multiline
                        rows={4}
                        fullWidth
                        required={answerType === 'choice_required_text'}
                        value={evaluationData.text}
                        onChange={(e) => handleTextChange(e.target.value)}
                        placeholder={answerOptions.textPlaceholder || (answerType === 'choice' ? 'Add any additional comments (optional)...' : 'Please explain your choice...')}
                      />
                    </Box>
                  )}
                </>
              );
            }

            // Text required answer type
            if (answerType === 'text_required') {
              return (
                <Box sx={{ mb: 3 }}>
                  <TextField
                    label={answerOptions.textLabel || 'Your Evaluation'}
                    multiline
                    rows={8}
                    fullWidth
                    required
                    value={evaluationData.text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder={answerOptions.textPlaceholder || 'Please provide your detailed evaluation...'}
                  />
                </Box>
              );
            }

            // Fallback for legacy criteria-based tasks
            if (task.criteria && task.criteria.length > 0) {
              return (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Rate the Artifacts
                  </Typography>
                  {task.criteria.map((criterion) => (
                    <Box key={criterion.id} sx={{ mb: 3 }}>
                      <FormLabel component="legend" sx={{ mb: 1, display: 'block' }}>
                        {criterion.name}
                        {criterion.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {criterion.description}
                          </Typography>
                        )}
                      </FormLabel>
                      {criterion.scale === 'stars_5' || criterion.scale === 'likert_5' ? (
                        <Rating
                          value={evaluationData.ratings[criterion.id] || 0}
                          onChange={(event, newValue) => handleRatingChange(criterion.id, newValue)}
                          max={5}
                          size="large"
                        />
                      ) : criterion.scale === 'binary' ? (
                        <RadioGroup
                          value={evaluationData.ratings[criterion.id] || ''}
                          onChange={(e) => handleRatingChange(criterion.id, e.target.value)}
                          row
                        >
                          <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                          <FormControlLabel value="no" control={<Radio />} label="No" />
                        </RadioGroup>
                      ) : (
                        <TextField
                          type="number"
                          value={evaluationData.ratings[criterion.id] || ''}
                          onChange={(e) => handleRatingChange(criterion.id, parseFloat(e.target.value))}
                          inputProps={{ min: 0, step: 0.1 }}
                          fullWidth
                        />
                      )}
                    </Box>
                  ))}
                </Box>
              );
            }

            return null;
          })()}

          {/* Screenshots Section */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Screenshots (Optional)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Attach screenshots to support your evaluation
              </Typography>
              
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                id={`screenshot-upload-${taskId}`}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    try {
                      await handleScreenshotUpload(taskId, file);
                    } catch (error) {
                      setError(`Failed to upload screenshot: ${error.message || 'Unknown error'}`);
                    }
                  }
                  e.target.value = ''; // Reset input
                }}
              />
              <label htmlFor={`screenshot-upload-${taskId}`}>
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CameraAlt />}
                  sx={{ mb: 2 }}
                >
                  Add Screenshot
                </Button>
              </label>

              {/* Display Screenshots */}
              {evaluationData[taskId]?.screenshots && evaluationData[taskId].screenshots.length > 0 && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {evaluationData[taskId].screenshots.map((screenshot) => (
                    <Grid item xs={12} sm={6} md={4} key={screenshot.id}>
                      <Box sx={{ position: 'relative' }}>
                        <img
                          src={getImageUrl(screenshot.url)}
                          alt={screenshot.fileName}
                          style={{
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            backgroundColor: '#f5f5f5'
                          }}
                          onError={(e) => {
                            console.error('Failed to load image:', {
                              originalUrl: screenshot.url,
                              processedUrl: getImageUrl(screenshot.url)
                            });
                            e.target.style.display = 'none';
                            const errorDiv = document.createElement('div');
                            errorDiv.textContent = 'Image failed to load';
                            errorDiv.style.cssText = 'padding: 10px; color: red; text-align: center;';
                            e.target.parentElement.appendChild(errorDiv);
                          }}
                          onLoad={() => {
                            console.log('Image loaded successfully:', getImageUrl(screenshot.url));
                          }}
                        />
                        <IconButton
                          size="small"
                          color="error"
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            bgcolor: 'rgba(255, 255, 255, 0.9)'
                          }}
                          onClick={() => handleScreenshotDelete(taskId, screenshot.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/participant/studies/${studyId}`)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckCircle />}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Evaluation'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ParticipantTaskEvaluation;

