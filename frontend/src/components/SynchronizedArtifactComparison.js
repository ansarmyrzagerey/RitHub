import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  Paper,
  Chip,
  Divider,
  Switch,
  FormControlLabel,
  ButtonGroup,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid
} from '@mui/material';
import {
  Sync,
  SyncDisabled,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  ViewSidebar,
  Contrast,
  Close,
  Add,
  Delete,
  Code,
  Difference,
  Fullscreen,
  FullscreenExit
} from '@mui/icons-material';
import HighlightableText from './HighlightableText';
import GithubTextChangeViewer from './GithubTextChangeViewer';
import SmartArtifactLayout from './SmartArtifactLayout';
import AuthenticatedImage from './AuthenticatedImage';
import ImageDiffViewer from './ImageDiffViewer';
import plantumlEncoder from 'plantuml-encoder';

// Helper function to construct image URL
const getImageUrl = (url) => {
  if (!url) return '';
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const apiBaseUrl = process.env.REACT_APP_API_URL || '/api';
    if (apiBaseUrl.startsWith('/')) {
      try {
        const urlObj = new URL(url);
        return urlObj.pathname;
      } catch (e) {
        const match = url.match(/https?:\/\/[^\/]+(\/.*)/);
        if (match) {
          return match[1];
        }
      }
    }
    return url;
  }
  
  if (url.startsWith('/uploads')) {
    return url;
  }
  
  return url;
};

const SynchronizedArtifactComparison = ({
  artifacts,
  taskId,
  evaluationData,
  artifactTags,
  newTagInputs,
  onTagChange,
  onHighlightAdd,
  onHighlightUpdate,
  onHighlightDelete,
  onHighlightImageUpload,
  setNewTagInputs
}) => {
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const [syncMode, setSyncMode] = useState('horizontal'); // 'vertical', 'horizontal', 'both'
  const [comparisonMode, setComparisonMode] = useState('side-by-side'); // 'side-by-side', 'overlay', 'diff'
  const [zoomLevel, setZoomLevel] = useState(100);
  const [comparisonDialog, setComparisonDialog] = useState(null); // null, 'github-text', 'image-diff'
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewingImages, setViewingImages] = useState([]); // Array of { artifact, imageSrc, label }
  const [diffImages, setDiffImages] = useState(null); // { image1Src, image2Src, image1Label, image2Label }
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRefs = useRef({});

  // Get artifact content area reference
  const getScrollRef = useCallback((artifactId) => {
    if (!scrollRefs.current[artifactId]) {
      scrollRefs.current[artifactId] = React.createRef();
    }
    return scrollRefs.current[artifactId];
  }, []);

  // Handle synchronized scrolling
  const handleScroll = useCallback((sourceArtifactId, event) => {
    if (!scrollSyncEnabled) return;

    const sourceElement = event.target;
    const { scrollTop, scrollLeft } = sourceElement;

    artifacts.forEach(artifact => {
      if (artifact.id !== sourceArtifactId) {
        const targetRef = scrollRefs.current[artifact.id];
        if (targetRef?.current) {
          const targetElement = targetRef.current;

          // Apply scroll based on sync mode
          if (syncMode === 'vertical' || syncMode === 'both') {
            targetElement.scrollTop = scrollTop;
          }
          if (syncMode === 'horizontal' || syncMode === 'both') {
            targetElement.scrollLeft = scrollLeft;
          }
        }
      }
    });
  }, [artifacts, scrollSyncEnabled, syncMode]);

  // Get optimal layout for artifact type
  const getArtifactLayout = (artifact) => {
    const type = artifact.type?.toLowerCase() || '';

    const layouts = {
      'image': {
        minWidth: '350px',
        maxHeight: '500px',
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center'
      },
      'ui_snapshot': {
        minWidth: '350px',
        maxHeight: '500px',
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center'
      },
      'code': {
        minWidth: '400px',
        maxHeight: '500px',
        fontFamily: 'monospace',
        fontSize: `${0.875 * (zoomLevel / 100)}rem`,
        whiteSpace: 'pre',
        overflow: 'auto'
      },
      'code_clone': {
        minWidth: '400px',
        maxHeight: '500px',
        fontFamily: 'monospace',
        fontSize: `${0.875 * (zoomLevel / 100)}rem`,
        whiteSpace: 'pre-wrap',
        overflow: 'auto'
      },
      'bug_report': {
        minWidth: '350px',
        maxHeight: '500px',
        fontSize: `${1 * (zoomLevel / 100)}rem`,
        whiteSpace: 'pre-wrap',
        overflow: 'auto'
      },
      'text': {
        minWidth: '350px',
        maxHeight: '500px',
        fontSize: `${1 * (zoomLevel / 100)}rem`,
        overflow: 'auto'
      },
      'uml_diagram': {
        minWidth: '350px',
        maxHeight: '500px',
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center'
      }
    };

    // Check for image types (including ui_snapshot) - use flexible matching
    const normalizedType = type?.toLowerCase().trim().replace(/[-_\s]+/g, ' ') || '';
    if (type?.toLowerCase().includes('image') || normalizedType === 'ui snapshot' || normalizedType.startsWith('ui snapshot')) {
      return layouts.ui_snapshot || layouts.image;
    }

    return layouts[type] || layouts.text;
  };

  // Get artifact icon based on type
  const getArtifactIcon = (type) => {
    if (!type) return '';
    const lowerType = type.toLowerCase();
    const normalizedType = lowerType.trim().replace(/[-_\s]+/g, ' ');
    if (lowerType.includes('image') || lowerType.includes('png') || lowerType.includes('jpg') || 
        normalizedType === 'ui snapshot' || normalizedType.startsWith('ui snapshot')) {
      return '';
    }
    if (lowerType.includes('code') || lowerType.includes('javascript') || lowerType.includes('python') || lowerType === 'code_clone') {
      return '';
    }
    if (lowerType.includes('text') || lowerType.includes('document') || lowerType === 'bug_report') {
      return '';
    }
    if (lowerType.includes('uml') || lowerType.includes('diagram')) {
      return '';
    }
    return '';
  };

  // Helper to check if artifact is an image
  const isImageArtifact = (artifact) => {
    if (!artifact) return false;
    const artifactType = artifact.type?.toLowerCase() || '';
    const normalizedType = artifactType.trim().replace(/[-_\s]+/g, ' ');
    return artifactType.includes('image') || 
           normalizedType === 'ui snapshot' || normalizedType.startsWith('ui snapshot') ||
           (artifact.name && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(artifact.name));
  };

  // Helper to check if artifact is a UI snapshot
  const isUISnapshotArtifact = (artifact) => {
    if (!artifact) return false;
    const artifactType = artifact.type?.toLowerCase() || '';
    const normalizedType = artifactType.trim().replace(/[-_\s]+/g, ' ');
    return normalizedType === 'ui snapshot' || normalizedType.startsWith('ui snapshot') ||
           artifactType.includes('ui_snapshot');
  };

  // Get image source for an artifact (reusable logic)
  const getImageSource = (artifact) => {
    if (!artifact || !artifact.id) return null;
    
    const artifactType = artifact.type?.toLowerCase() || '';
    const isUISnapshot = isUISnapshotArtifact(artifact);
    const isDatabaseStorage = artifact.storage_type === 'database';
    
    // Check for valid data URL
    if (artifact.image_url && (artifact.image_url.startsWith('data:') || artifact.image_url.startsWith('http'))) {
      return artifact.image_url;
    }
    // UI snapshots and database storage use endpoint
    else if (isUISnapshot || isDatabaseStorage) {
      return `/api/participant/artifacts/${artifact.id}/image`;
    }
    // Check for base64 content
    else if (artifact.content && typeof artifact.content === 'string' && 
             artifact.content.length > 100 && 
             /^[A-Za-z0-9+/=\s]+$/.test(artifact.content.trim()) &&
             !artifact.content.startsWith('http') &&
             !artifact.content.startsWith('/')) {
      const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : (artifact.metadata || {});
      const imageFormat = metadata.format || metadata.mimeType?.split('/')[1] || artifact.mime_type?.split('/')[1] || 'png';
      return `data:image/${imageFormat};base64,${artifact.content.trim()}`;
    }
    // Check for filesystem path
    else if (artifact.storage_type === 'filesystem' && artifact.file_path && !isUISnapshot) {
      const filePath = artifact.file_path.replace(/\\/g, '/');
      const uploadsPath = filePath.startsWith('/uploads') ? filePath : `/uploads/${filePath}`;
      return getImageUrl(uploadsPath);
    }
    // Default: use participant artifact image endpoint
    else {
      return `/api/participant/artifacts/${artifact.id}/image`;
    }
  };

  // Open image diff viewer from image viewer dialog
  const handleOpenImageDiffFromViewer = () => {
    if (viewingImages.length >= 2) {
      // Use first two images from the viewer
      const image1 = viewingImages[0];
      const image2 = viewingImages[1];
      
      if (image1.imageSrc && image2.imageSrc) {
        setDiffImages({
          image1Src: image1.imageSrc,
          image2Src: image2.imageSrc,
          image1Label: image1.label || 'Image 1',
          image2Label: image2.label || 'Image 2'
        });
        // Close image viewer and open diff dialog
        setImageViewerOpen(false);
        setComparisonDialog('image-diff');
      } else {
        console.error('Failed to get image sources for diff:', {
          image1: image1,
          image2: image2
        });
      }
    }
  };

  // Check if we can show diff in image viewer (need exactly 2 images)
  const canShowDiffInViewer = () => {
    return viewingImages.length >= 2;
  };

  // Get image source for an artifact (reuse the logic from renderArtifactContent)
  const getImageSourceForViewer = (artifact, imageSrc) => {
    // imageSrc is already determined in renderArtifactContent, so we can use it directly
    return imageSrc;
  };

  // Open image viewer with all images from artifacts for comparison
  const handleOpenImageViewer = (clickedArtifact, clickedImageSrc) => {
    const images = [];
    
    // Collect all image artifacts
    artifacts.forEach((artifact, index) => {
      if (isImageArtifact(artifact)) {
        // Determine image source using the same logic as renderArtifactContent
        let imageSrc = null;
        const artifactType = artifact.type?.toLowerCase() || '';
        const isUISnapshot = artifactType.includes('ui_snapshot') || 
                            artifactType.replace(/[-_\s]+/g, ' ') === 'ui snapshot' ||
                            artifactType.replace(/[-_\s]+/g, ' ').startsWith('ui snapshot');
        const isDatabaseStorage = artifact.storage_type === 'database';
        
        if (artifact.image_url && (artifact.image_url.startsWith('data:') || artifact.image_url.startsWith('http'))) {
          imageSrc = artifact.image_url;
        } else if (isUISnapshot) {
          imageSrc = artifact.id ? `/api/participant/artifacts/${artifact.id}/image` : null;
        } else if (isDatabaseStorage) {
          imageSrc = artifact.id ? `/api/participant/artifacts/${artifact.id}/image` : null;
        } else if (artifact.content && typeof artifact.content === 'string' && 
                   artifact.content.length > 100 && 
                   /^[A-Za-z0-9+/=\s]+$/.test(artifact.content.trim()) &&
                   !artifact.content.startsWith('http') &&
                   !artifact.content.startsWith('/')) {
          const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : (artifact.metadata || {});
          const imageFormat = metadata.format || metadata.mimeType?.split('/')[1] || artifact.mime_type?.split('/')[1] || 'png';
          imageSrc = `data:image/${imageFormat};base64,${artifact.content.trim()}`;
        } else if (artifact.storage_type === 'filesystem' && artifact.file_path && !isUISnapshot) {
          const filePath = artifact.file_path.replace(/\\/g, '/');
          const uploadsPath = filePath.startsWith('/uploads') ? filePath : `/uploads/${filePath}`;
          imageSrc = getImageUrl(uploadsPath);
        } else {
          imageSrc = artifact.id ? `/api/participant/artifacts/${artifact.id}/image` : null;
        }
        
        if (imageSrc) {
          images.push({ 
            artifact, 
            imageSrc, 
            label: artifact.name || `Artifact ${index + 1}` 
          });
        }
      }
    });
    
    // If no images found, just show the clicked one
    if (images.length === 0 && clickedImageSrc) {
      images.push({ 
        artifact: clickedArtifact, 
        imageSrc: clickedImageSrc, 
        label: clickedArtifact?.name || 'Artifact' 
      });
    }
    
    setViewingImages(images);
    setImageViewerOpen(true);
  };

  // Render artifact content
  const renderArtifactContent = (artifact) => {
    if (!artifact) {
      console.error('[SynchronizedArtifactComparison] Artifact is null or undefined');
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="error">Artifact data is missing</Typography>
        </Box>
      );
    }

    const layout = getArtifactLayout(artifact);
    const artifactType = artifact.type?.toLowerCase() || '';
    const originalType = artifact.type || '';

    // Helper to check if type is UI snapshot (handles variations like 'ui_snapshot', 'ui snapshot', 'ui-snapshot', etc.)
    const isUISnapshotType = (type) => {
      if (!type) return false;
      const normalized = type.trim().replace(/[-_\s]+/g, ' ').toLowerCase();
      // Check for exact match or if it starts with "ui snapshot" (handles variations)
      return normalized === 'ui snapshot' || normalized.startsWith('ui snapshot');
    };
    
    // UI snapshots are ALWAYS images - render them simply, just like source_code renders code
    const isUISnapshotArtifact = isUISnapshotType(artifactType) || isUISnapshotType(originalType);
    
    if (isUISnapshotArtifact) {
      if (!artifact.id) {
        return (
          <Box sx={{ ...layout, alignItems: 'center', p: 2 }}>
            <Typography color="error">Artifact ID is missing. Cannot load UI snapshot.</Typography>
          </Box>
        );
      }

      // Simple: UI snapshots always use the endpoint to display the image
      const uiSnapshotSrc = `/api/participant/artifacts/${artifact.id}/image`;
      return (
        <Box 
          sx={{
            ...layout,
            alignItems: 'center',
            p: 2,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.02)',
              boxShadow: 2
            },
            transition: 'all 0.2s ease'
          }}
          onClick={() => handleOpenImageViewer(artifact, uiSnapshotSrc)}
        >
          <AuthenticatedImage
            src={uiSnapshotSrc}
            alt={artifact.name || 'UI Snapshot'}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '4px'
            }}
            onError={(e) => {
              console.error('[SynchronizedArtifactComparison] UI snapshot image load error:', {
                artifactId: artifact.id,
                artifactName: artifact.name,
                error: e
              });
            }}
            onLoad={() => {
              console.log('[SynchronizedArtifactComparison] UI snapshot loaded successfully:', artifact.id);
            }}
          />
        </Box>
      );
    }

    // Check if it's a UML diagram - show both visual and text (check BEFORE image type to ensure both are shown)
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
          console.error('[SynchronizedArtifactComparison] Error encoding PlantUML:', error);
        }
      }

      return (
        <Box
          ref={getScrollRef(artifact.id)}
          onScroll={(e) => handleScroll(artifact.id, e)}
          sx={{
            ...layout,
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'grey.50',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflow: 'auto',
            maxHeight: '100%'
          }}
        >
          {/* UML Visual Preview */}
          {umlImageUrl && (
            <Box sx={{ 
              position: 'relative',
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'flex-start',
              bgcolor: 'white',
              borderRadius: 1,
              p: 2,
              border: 1,
              borderColor: 'grey.300',
              maxHeight: '40%',
              overflow: 'auto',
              flexShrink: 0,
              '&:hover .fullscreen-button': {
                opacity: 1
              }
            }}>
              <img
                src={umlImageUrl}
                alt="UML Diagram"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  height: 'auto',
                  width: 'auto',
                  objectFit: 'contain',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
                onError={(e) => {
                  console.error('[SynchronizedArtifactComparison] Error loading UML image');
                  e.target.style.display = 'none';
                }}
              />
              <IconButton
                className="fullscreen-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingImages([{ artifact, imageSrc: umlImageUrl, label: artifact.name || 'UML Diagram' }]);
                  setImageViewerOpen(true);
                }}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  bgcolor: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.8)'
                  }
                }}
                size="small"
              >
                <Fullscreen fontSize="small" />
              </IconButton>
            </Box>
          )}

          {/* PlantUML Source Code / Text Content */}
          <Box sx={{ 
            flex: 1, 
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {umlImageUrl && (
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, flexShrink: 0 }}>
                PlantUML Source Code:
              </Typography>
            )}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <HighlightableText
                text={typeof artifact.content === 'string'
                  ? artifact.content
                  : JSON.stringify(artifact.content, null, 2)}
                highlights={evaluationData?.[taskId]?.artifactHighlights?.[`artifact${artifacts.indexOf(artifact) + 1}`] || []}
                onHighlightAdd={(highlight) => onHighlightAdd?.(taskId, highlight, `artifact${artifacts.indexOf(artifact) + 1}`)}
                onHighlightUpdate={(highlight) => onHighlightUpdate?.(taskId, highlight, `artifact${artifacts.indexOf(artifact) + 1}`)}
                onHighlightDelete={(highlightId) => onHighlightDelete?.(taskId, highlightId, `artifact${artifacts.indexOf(artifact) + 1}`)}
                taskId={taskId}
                onImageUpload={(formData) => onHighlightImageUpload?.(taskId, formData)}
                zoomLevel={zoomLevel}
              />
            </Box>
          </Box>
        </Box>
      );
    }

    // Check if it's an image type (excluding ui_snapshot and uml_diagram which we already handled)
    const isImageType = artifactType.includes('image') || 
                       (artifact.name && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(artifact.name));
    
    if (isImageType) {
      // Debug logging
      console.log('[SynchronizedArtifactComparison] Rendering image artifact:', {
        id: artifact.id,
        name: artifact.name,
        type: artifact.type,
        artifactType: artifactType,
        isImageType: isImageType,
        hasImageUrl: !!artifact.image_url,
        hasContent: !!artifact.content,
        contentType: typeof artifact.content,
        contentLength: artifact.content?.length,
        storageType: artifact.storage_type,
        filePath: artifact.file_path,
        metadata: artifact.metadata
      });
      
      // Determine image source - prioritize in this order:
      // 1. Valid data URLs (already formatted)
      // 2. UI snapshots ALWAYS use endpoint (regardless of storage type)
      // 3. Database storage uses endpoint
      // 4. Valid base64 content in artifact.content (only if NOT database storage and NOT ui_snapshot)
      // 5. Filesystem file_path (if available and NOT ui_snapshot)
      // 6. Participant artifact image endpoint (fallback for all cases)
      
      let imageSrc = null;
      // Compute isUISnapshot - check both lowercased and original type (originalType already declared above)
      const isUISnapshot = isUISnapshotType(artifactType) || isUISnapshotType(originalType);
      const isDatabaseStorage = artifact.storage_type === 'database';
      
      console.log('[SynchronizedArtifactComparison] Storage check:', {
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
        console.log('[SynchronizedArtifactComparison] Using image_url:', imageSrc);
      }
      // UI snapshots ALWAYS use the endpoint (regardless of storage type)
      // The endpoint handles both database and filesystem storage
      else if (isUISnapshot) {
        if (!artifact.id) {
          console.error('[SynchronizedArtifactComparison] Artifact ID is missing for ui_snapshot:', {
            artifact,
            artifactType,
            originalType: artifact.type
          });
          return (
            <Box sx={{ ...layout, alignItems: 'center', p: 2 }}>
              <Typography color="error">Artifact ID is missing. Cannot load UI snapshot.</Typography>
            </Box>
          );
        }
        imageSrc = `/api/participant/artifacts/${artifact.id}/image`;
        console.log('[SynchronizedArtifactComparison] Using participant image endpoint (ui_snapshot):', imageSrc);
      }
      // For database storage, use endpoint (skip base64 check)
      else if (isDatabaseStorage) {
        if (!artifact.id) {
          console.error('[SynchronizedArtifactComparison] Artifact ID is missing for database storage:', artifact);
          return (
            <Box sx={{ ...layout, alignItems: 'center', p: 2 }}>
              <Typography color="error">Artifact ID is missing</Typography>
            </Box>
          );
        }
        imageSrc = `/api/participant/artifacts/${artifact.id}/image`;
        console.log('[SynchronizedArtifactComparison] Using participant image endpoint (database storage):', imageSrc);
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
        console.log('[SynchronizedArtifactComparison] Using base64 content');
      }
      // Check for filesystem path (only if NOT ui_snapshot - ui_snapshots should use endpoint)
      else if (artifact.storage_type === 'filesystem' && artifact.file_path && !isUISnapshot) {
        const filePath = artifact.file_path.replace(/\\/g, '/');
        const uploadsPath = filePath.startsWith('/uploads') ? filePath : `/uploads/${filePath}`;
        imageSrc = getImageUrl(uploadsPath);
        console.log('[SynchronizedArtifactComparison] Using filesystem path:', imageSrc);
      }
      // Default: use participant artifact image endpoint
      else {
        if (!artifact.id) {
          console.error('[SynchronizedArtifactComparison] Artifact ID is missing (fallback):', {
            artifact,
            artifactType,
            storageType: artifact.storage_type
          });
          return (
            <Box sx={{ ...layout, alignItems: 'center', p: 2 }}>
              <Typography color="error">Artifact ID is missing. Cannot load image.</Typography>
            </Box>
          );
        }
        imageSrc = `/api/participant/artifacts/${artifact.id}/image`;
        console.log('[SynchronizedArtifactComparison] Using participant image endpoint (fallback):', imageSrc);
      }
      
      console.log('[SynchronizedArtifactComparison] Final image source:', imageSrc);

      // Safety check: ensure we never use the old download endpoint
      if (imageSrc && imageSrc.includes('/artifacts/') && imageSrc.includes('/download')) {
        console.warn('[SynchronizedArtifactComparison] Detected old download endpoint, replacing with participant endpoint');
        imageSrc = `/api/participant/artifacts/${artifact.id}/image`;
      }

      // Ensure we have a valid image source
      if (!imageSrc) {
        console.error('[SynchronizedArtifactComparison] No valid image source found for artifact:', artifact.id);
        return (
          <Box sx={{ ...layout, alignItems: 'center', p: 2 }}>
            <Typography color="error">Unable to load image</Typography>
          </Box>
        );
      }

      // Use AuthenticatedImage for authenticated endpoints, regular img for data URLs and external URLs
      const isAuthenticatedEndpoint = imageSrc.startsWith('/api/') || imageSrc.includes('/participant/artifacts/');

      return (
        <Box 
          sx={{
            ...layout,
            position: 'relative',
            alignItems: 'center',
            p: 2,
            cursor: 'pointer',
            overflow: 'auto',
            maxHeight: '100%',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.02)',
              boxShadow: 2,
              '& .fullscreen-button': {
                opacity: 1
              }
            },
            transition: 'all 0.2s ease'
          }}
          onClick={() => handleOpenImageViewer(artifact, imageSrc)}
        >
          {isAuthenticatedEndpoint ? (
            <AuthenticatedImage
              src={imageSrc}
              alt={artifact.name || 'Artifact'}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
              onError={(e) => {
                console.error('[SynchronizedArtifactComparison] Image load error:', {
                  src: imageSrc,
                  artifactId: artifact.id,
                  artifactName: artifact.name,
                  storageType: artifact.storage_type,
                  filePath: artifact.file_path
                });
              }}
              onLoad={() => {
                console.log('[SynchronizedArtifactComparison] Image loaded successfully:', artifact.id);
              }}
            />
          ) : (
            <img
              src={imageSrc}
              alt={artifact.name || 'Artifact'}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
              onError={(e) => {
                console.error('[SynchronizedArtifactComparison] Image load error:', {
                  src: imageSrc,
                  artifactId: artifact.id,
                  artifactName: artifact.name,
                  storageType: artifact.storage_type,
                  filePath: artifact.file_path
                });
              }}
              onLoad={() => {
                console.log('[SynchronizedArtifactComparison] Image loaded successfully:', artifact.id);
              }}
            />
          )}
          <IconButton
            className="fullscreen-button"
            onClick={(e) => {
              e.stopPropagation();
              setViewingImages([{ artifact, imageSrc, label: artifact.name || 'Artifact' }]);
              setImageViewerOpen(true);
            }}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              opacity: 0,
              transition: 'opacity 0.2s',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.8)'
              }
            }}
            size="small"
          >
            <Fullscreen fontSize="small" />
          </IconButton>
        </Box>
      );
    }

    // IMPORTANT: If we reach here, isImageType was false
    // But if it's a UI snapshot, we should have rendered an image above
    // Log a warning if we detect a UI snapshot falling through to text rendering
    if (isUISnapshotType(artifactType)) {
      console.error('[SynchronizedArtifactComparison] UI snapshot detected but isImageType was false!', {
        artifactId: artifact.id,
        artifactType: artifact.type,
        artifactTypeLower: artifactType,
        isImageType,
        artifactName: artifact.name
      });
      // Force render as image even if detection failed
      if (artifact.id) {
        return (
          <Box sx={{ ...layout, alignItems: 'center', p: 2 }}>
            <AuthenticatedImage
              src={`/api/participant/artifacts/${artifact.id}/image`}
              alt={artifact.name || 'UI Snapshot'}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
              onError={(e) => {
                console.error('[SynchronizedArtifactComparison] Forced UI snapshot image load error:', e);
              }}
            />
          </Box>
        );
      }
    }

    // For text/code artifacts, use HighlightableText with tagging
    return (
      <Box
        ref={getScrollRef(artifact.id)}
        onScroll={(e) => handleScroll(artifact.id, e)}
        sx={{
          ...layout,
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'grey.50',
          overflow: 'auto',
          maxHeight: '100%'
        }}
      >
        {/* Highlightable Text */}
        <HighlightableText
          text={typeof artifact.content === 'string'
            ? artifact.content
            : JSON.stringify(artifact.content, null, 2)}
          highlights={evaluationData?.[taskId]?.artifactHighlights?.[`artifact${artifacts.indexOf(artifact) + 1}`] || []}
          onHighlightAdd={(highlight) => onHighlightAdd?.(taskId, highlight, `artifact${artifacts.indexOf(artifact) + 1}`)}
          onHighlightUpdate={(highlight) => onHighlightUpdate?.(taskId, highlight, `artifact${artifacts.indexOf(artifact) + 1}`)}
          onHighlightDelete={(highlightId) => onHighlightDelete?.(taskId, highlightId, `artifact${artifacts.indexOf(artifact) + 1}`)}
          taskId={taskId}
          onImageUpload={(formData) => onHighlightImageUpload?.(taskId, formData)}
          zoomLevel={zoomLevel}
        />
      </Box>
    );
  };

  // Render tags section for an artifact
  const renderTagsSection = (artifact) => {
    // Only show tags for text/code artifacts, not images
    const artifactType = artifact.type?.toLowerCase() || '';
    const normalizedType = artifactType.trim().replace(/[-_\s]+/g, ' ');
    const isUISnapshot = normalizedType === 'ui snapshot' || normalizedType.startsWith('ui snapshot');
    const isImageType = artifactType.includes('image') || 
                       isUISnapshot ||
                       (artifact.name && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(artifact.name));
    
    // Don't show tags for image artifacts
    if (isImageType) {
      return null;
    }

    return (
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Evaluation Tags {artifactTags?.[taskId]?.[artifact.id]?.length > 0 && `(${artifactTags[taskId][artifact.id].length}/5)`}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          {artifactTags?.[taskId]?.[artifact.id]?.map((tag, index) => (
            <Chip
              key={index}
              label={tag}
              onDelete={() => {
                const currentTags = artifactTags[taskId][artifact.id];
                onTagChange?.(taskId, artifact.id, currentTags.filter(t => t !== tag));
              }}
              size="small"
            />
          ))}
        </Box>
        {(!artifactTags?.[taskId]?.[artifact.id] || artifactTags[taskId][artifact.id].length < 5) && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Add tag..."
              value={newTagInputs?.[`${taskId}-${artifact.id}`] || ''}
              onChange={(e) => {
                // Update newTagInputs state
                const newInputs = { ...newTagInputs };
                newInputs[`${taskId}-${artifact.id}`] = e.target.value;
                setNewTagInputs?.(newInputs);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const tagText = newTagInputs?.[`${taskId}-${artifact.id}`]?.trim();
                  if (tagText && (!artifactTags?.[taskId]?.[artifact.id] || artifactTags[taskId][artifact.id].length < 5)) {
                    const currentTags = artifactTags?.[taskId]?.[artifact.id] || [];
                    if (!currentTags.includes(tagText)) {
                      onTagChange?.(taskId, artifact.id, [...currentTags, tagText]);
                    }
                  }
                }
              }}
              sx={{ flex: 1 }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add />}
              onClick={() => {
                const tagText = newTagInputs?.[`${taskId}-${artifact.id}`]?.trim();
                if (tagText && (!artifactTags?.[taskId]?.[artifact.id] || artifactTags[taskId][artifact.id].length < 5)) {
                  const currentTags = artifactTags?.[taskId]?.[artifact.id] || [];
                  if (!currentTags.includes(tagText)) {
                    onTagChange?.(taskId, artifact.id, [...currentTags, tagText]);
                  }
                }
              }}
              disabled={!newTagInputs?.[`${taskId}-${artifact.id}`]?.trim() ||
                       (artifactTags?.[taskId]?.[artifact.id]?.length >= 5)}
            >
              Add
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  const getGridColumns = () => {
    const count = artifacts.length;
    if (count === 1) return '1fr';
    if (count === 2) return '1fr 1fr';
    if (count === 3) return '1fr 1fr 1fr';
    return '1fr';
  };

  return (
    <Box 
      sx={{ 
        width: '100%',
        filter: highContrastMode ? 'contrast(1.5) brightness(1.1)' : 'none',
        transition: 'filter 0.3s ease',
        ...(highContrastMode && {
          '& .MuiCard-root': {
            border: '2px solid',
            borderColor: 'primary.main',
            bgcolor: 'background.paper'
          },
          '& .MuiTypography-root': {
            fontWeight: highContrastMode ? 600 : 'inherit'
          },
          '& pre, & code': {
            bgcolor: 'grey.900',
            color: 'grey.100',
            padding: '8px',
            borderRadius: '4px'
          }
        })
      }}
    >
      {/* Control Panel */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Artifact Comparison Controls
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {/* Scroll Sync Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={scrollSyncEnabled}
                      onChange={(e) => setScrollSyncEnabled(e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {scrollSyncEnabled ? <Sync color="primary" /> : <SyncDisabled />}
                      <Typography variant="body2">Sync Scroll</Typography>
                    </Box>
                  }
                />
              </Box>

              {/* Sync Mode */}
              {scrollSyncEnabled && (
                <ButtonGroup size="small" variant="outlined">
                  <Button
                    variant={syncMode === 'horizontal' ? 'contained' : 'outlined'}
                    onClick={() => setSyncMode('horizontal')}
                  >
                    Horizontal
                  </Button>
                  <Button
                    variant={syncMode === 'vertical' ? 'contained' : 'outlined'}
                    onClick={() => setSyncMode('vertical')}
                  >
                    Vertical
                  </Button>
                  <Button
                    variant={syncMode === 'both' ? 'contained' : 'outlined'}
                    onClick={() => setSyncMode('both')}
                  >
                    Both
                  </Button>
                </ButtonGroup>
              )}

              {/* Zoom Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))}
                  disabled={zoomLevel <= 50}
                >
                  <ZoomOut />
                </IconButton>
                <Typography variant="body2" sx={{ minWidth: '60px', textAlign: 'center' }}>
                  {zoomLevel}%
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                  disabled={zoomLevel >= 200}
                >
                  <ZoomIn />
                </IconButton>
              </Box>

              {/* View Mode */}
              <ButtonGroup size="small" variant="outlined">
                <Button
                  variant={comparisonMode === 'side-by-side' ? 'contained' : 'outlined'}
                  onClick={() => setComparisonMode('side-by-side')}
                  startIcon={<ViewSidebar />}
                >
                  Side-by-Side
                </Button>
                <Button
                  variant={highContrastMode ? 'contained' : 'outlined'}
                  onClick={() => setHighContrastMode(!highContrastMode)}
                  startIcon={<Contrast />}
                >
                  Contrast Mode
                </Button>
                <Button
                  onClick={() => setComparisonDialog('github-text')}
                  startIcon={<Code />}
                >
                  Compare 
                </Button>
              </ButtonGroup>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Artifacts Comparison Area */}
      <SmartArtifactLayout artifacts={artifacts} taskId={taskId}>
        {artifacts.map((artifact, index) => (
          <Card key={artifact.id} variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <CardContent sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
                  {getArtifactIcon(artifact.type)} {artifact.name}
                </Typography>
                <Chip
                  label={`#${index + 1}`}
                  size="small"
                  sx={{ ml: 1 }}
                  color="primary"
                  variant="outlined"
                />
              </Box>
              {artifact.type && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Type: {artifact.type}
                </Typography>
              )}
            </CardContent>

            <Divider />

            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {renderArtifactContent(artifact)}
            </Box>

            {/* Tags section - always at the bottom */}
            {renderTagsSection(artifact)}
          </Card>
        ))}
      </SmartArtifactLayout>

      {/* Comparison Tools Dialog */}
      <Dialog
        open={!!comparisonDialog}
        onClose={() => {
          setComparisonDialog(null);
          setDiffImages(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            {comparisonDialog === 'image-diff' ? 'Image Diff Viewer' : 'Text Change Viewer'}
          </Typography>
          <IconButton 
            onClick={() => {
              setComparisonDialog(null);
              setDiffImages(null);
            }} 
            size="small"
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {comparisonDialog === 'image-diff' && diffImages ? (
            <ImageDiffViewer
              image1Src={diffImages.image1Src}
              image2Src={diffImages.image2Src}
              image1Label={diffImages.image1Label}
              image2Label={diffImages.image2Label}
              onClose={() => {
                setComparisonDialog(null);
                setDiffImages(null);
              }}
            />
          ) : (
          <GithubTextChangeViewer artifacts={artifacts} />
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setComparisonDialog(null);
              setDiffImages(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog
        open={imageViewerOpen}
        onClose={() => {
          setImageViewerOpen(false);
          setIsFullscreen(false);
        }}
        maxWidth={viewingImages.length > 1 ? 'xl' : false}
        fullWidth={viewingImages.length > 1}
        fullScreen={isFullscreen || viewingImages.length === 1}
        PaperProps={{
          sx: {
            maxHeight: isFullscreen ? '100vh' : '95vh',
            m: (isFullscreen || viewingImages.length === 1) ? 0 : 2,
            height: isFullscreen ? '100vh' : 'auto'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6">
            {viewingImages.length > 1 
              ? `Image Comparison (${viewingImages.length} images)`
              : viewingImages[0]?.label || 'Image Viewer'
            }
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              size="small"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
            <IconButton onClick={() => {
              setImageViewerOpen(false);
              setIsFullscreen(false);
            }} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2, overflow: 'auto' }}>
          {viewingImages.length > 1 ? (
            // Side-by-side comparison for multiple images
            <Grid container spacing={2}>
              {viewingImages.map((imgData, index) => (
                <Grid 
                  item 
                  xs={12} 
                  sm={viewingImages.length === 2 ? 6 : viewingImages.length === 3 ? 4 : 12}
                  key={index}
                >
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      {imgData.label}
                    </Typography>
                    <Box sx={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                      p: 2,
                      minHeight: '400px',
                      maxHeight: '75vh',
                      overflow: 'auto'
                    }}>
                      {imgData.imageSrc.startsWith('/api/') || imgData.imageSrc.includes('/participant/artifacts/') ? (
                        <AuthenticatedImage
                          src={imgData.imageSrc}
                          alt={imgData.label}
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            width: 'auto',
                            objectFit: 'contain',
                            borderRadius: '4px',
                            display: 'block'
                          }}
                        />
                      ) : (
                        <img
                          src={imgData.imageSrc}
                          alt={imgData.label}
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            width: 'auto',
                            objectFit: 'contain',
                            borderRadius: '4px',
                            display: 'block'
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          ) : viewingImages.length === 1 ? (
            // Full-size single image view
            <Box sx={{
              width: '100%',
              height: isFullscreen ? 'calc(100vh - 120px)' : '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: 'grey.900',
              p: isFullscreen ? 1 : 2
            }}>
              {viewingImages[0].imageSrc.startsWith('/api/') || viewingImages[0].imageSrc.includes('/participant/artifacts/') ? (
                <AuthenticatedImage
                  src={viewingImages[0].imageSrc}
                  alt={viewingImages[0].label}
                  style={{
                    maxWidth: '100%',
                    maxHeight: isFullscreen ? 'calc(100vh - 120px)' : '90vh',
                    height: 'auto',
                    width: 'auto',
                    objectFit: 'contain',
                    borderRadius: '4px',
                    display: 'block'
                  }}
                />
              ) : (
                <img
                  src={viewingImages[0].imageSrc}
                  alt={viewingImages[0].label}
                  style={{
                    maxWidth: '100%',
                    maxHeight: isFullscreen ? 'calc(100vh - 120px)' : '90vh',
                    height: 'auto',
                    width: 'auto',
                    objectFit: 'contain',
                    borderRadius: '4px',
                    display: 'block'
                  }}
                />
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          {canShowDiffInViewer() && (
            <Button
              onClick={handleOpenImageDiffFromViewer}
              startIcon={<Difference />}
              color="primary"
              variant="outlined"
            >
              Image Diff
            </Button>
          )}
          <Button onClick={() => setImageViewerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SynchronizedArtifactComparison;
