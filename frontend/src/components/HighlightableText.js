import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Chip
} from '@mui/material';
import {
  Highlight,
  Close,
  Image as ImageIcon,
  Delete
} from '@mui/icons-material';

// Helper function to construct image URL (same as in ParticipantStudyTasks)
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

const HighlightableText = ({
  text,
  highlights = [],
  onHighlightAdd,
  onHighlightUpdate,
  onHighlightDelete,
  taskId,
  onImageUpload,
  zoomLevel = 100
}) => {
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState(null);
  const [showHighlightDialog, setShowHighlightDialog] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [highlightNote, setHighlightNote] = useState('');
  const [highlightImage, setHighlightImage] = useState(null);
  const [highlightImageUrl, setHighlightImageUrl] = useState(null);
  const [editingHighlight, setEditingHighlight] = useState(null);
  const textRef = useRef(null);
  const fileInputRef = useRef(null);
  const popupRef = useRef(null);

  // Generate unique ID for highlights
  const generateHighlightId = () => {
    return `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Handle text selection
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = selection.toString().trim();
        
        // Check if selection is within our text container
        if (textRef.current && textRef.current.contains(range.commonAncestorContainer)) {
          setSelectedText(selectedText);
          setSelectionRange(range.cloneRange());
          
          // Calculate popup position above the selected text (using viewport coordinates)
          const rect = range.getBoundingClientRect();
          
          setPopupPosition({
            top: rect.top - 40, // Position above the selection (viewport-relative)
            left: rect.left + (rect.width / 2) - 50 // Center horizontally (viewport-relative)
          });
          
          // Show small popup first
          setShowPopup(true);
        } else {
          setShowPopup(false);
        }
      } else {
        setShowPopup(false);
      }
    };

    // Close popup when clicking outside
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target) && 
          textRef.current && !textRef.current.contains(event.target)) {
        setShowPopup(false);
        window.getSelection().removeAllRanges();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle image upload for highlight
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB');
      return;
    }

    setHighlightImage(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setHighlightImageUrl(url);

    // Upload image if we have a highlight ID
    if (editingHighlight?.id) {
      try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('highlightId', editingHighlight.id);

        const response = await onImageUpload(taskId, formData);
        if (response && response.image) {
          setHighlightImageUrl(response.image.url);
        }
      } catch (error) {
        console.error('Failed to upload highlight image:', error);
        alert('Failed to upload image. Please try again.');
      }
    }
  };

  // Calculate text offset relative to the full text string
  const calculateTextOffset = (range, isStart) => {
    if (!textRef.current || !range) return 0;
    
    // Get all text nodes within our container
    const textNode = textRef.current;
    const rangeNode = isStart ? range.startContainer : range.endContainer;
    const rangeOffset = isStart ? range.startOffset : range.endOffset;
    
    // If the range is within a text node, calculate offset from start of text
    if (rangeNode.nodeType === Node.TEXT_NODE) {
      // Find the position of this text node in the full text
      let offset = 0;
      const walker = document.createTreeWalker(
        textNode,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node === rangeNode) {
          offset += rangeOffset;
          break;
        }
        offset += node.textContent.length;
      }
      
      return offset;
    }
    
    // Fallback: use the text content up to the selection
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const testRange = range.cloneRange();
      testRange.selectNodeContents(textRef.current);
      testRange.setEnd(isStart ? range.startContainer : range.endContainer, rangeOffset);
      return testRange.toString().length;
    }
    
    return 0;
  };

  // Handle opening highlight dialog from popup
  const handleOpenHighlightDialog = () => {
    setShowPopup(false);
    setShowHighlightDialog(true);
    setHighlightNote('');
    setHighlightImage(null);
    setHighlightImageUrl(null);
    setEditingHighlight(null);
  };

  // Handle adding highlight
  const handleAddHighlight = () => {
    if (!selectionRange || !selectedText.trim()) return;

    const highlightId = generateHighlightId();
    const startOffset = calculateTextOffset(selectionRange, true);
    const endOffset = calculateTextOffset(selectionRange, false);
    
    const highlight = {
      id: highlightId,
      text: selectedText,
      startOffset: startOffset,
      endOffset: endOffset,
      note: highlightNote.trim() || null,
      imageUrl: highlightImageUrl || null
    };

    // Upload image if provided
    if (highlightImage && onImageUpload) {
      const formData = new FormData();
      formData.append('image', highlightImage);
      formData.append('highlightId', highlightId);

      onImageUpload(taskId, formData)
        .then(response => {
          if (response && response.image) {
            highlight.imageUrl = response.image.url;
          }
          onHighlightAdd(highlight);
        })
        .catch(error => {
          console.error('Failed to upload image:', error);
          // Still add highlight without image
          onHighlightAdd(highlight);
        });
    } else {
      onHighlightAdd(highlight);
    }

    // Clear selection
    window.getSelection().removeAllRanges();
    setShowHighlightDialog(false);
    setShowPopup(false);
    setSelectedText('');
    setSelectionRange(null);
    setHighlightNote('');
    setHighlightImage(null);
    setHighlightImageUrl(null);
  };

  // Handle editing highlight
  const handleEditHighlight = (highlight) => {
    setEditingHighlight(highlight);
    setHighlightNote(highlight.note || '');
    setHighlightImageUrl(highlight.imageUrl || null);
    setShowHighlightDialog(true);
  };

  // Handle updating highlight
  const handleUpdateHighlight = () => {
    if (!editingHighlight) return;

    const updatedHighlight = {
      ...editingHighlight,
      note: highlightNote.trim() || null,
      imageUrl: highlightImageUrl || editingHighlight.imageUrl
    };

    // Upload new image if provided
    if (highlightImage && onImageUpload) {
      const formData = new FormData();
      formData.append('image', highlightImage);
      formData.append('highlightId', editingHighlight.id);

      onImageUpload(taskId, formData)
        .then(response => {
          if (response && response.image) {
            updatedHighlight.imageUrl = response.image.url;
          }
          onHighlightUpdate(updatedHighlight);
        })
        .catch(error => {
          console.error('Failed to upload image:', error);
          onHighlightUpdate(updatedHighlight);
        });
    } else {
      onHighlightUpdate(updatedHighlight);
    }

    setShowHighlightDialog(false);
    setEditingHighlight(null);
    setHighlightNote('');
    setHighlightImage(null);
    setHighlightImageUrl(null);
  };

  // Handle cancel
  const handleCancel = () => {
    window.getSelection().removeAllRanges();
    setShowHighlightDialog(false);
    setShowPopup(false);
    setSelectedText('');
    setSelectionRange(null);
    setHighlightNote('');
    setHighlightImage(null);
    setHighlightImageUrl(null);
    setEditingHighlight(null);
  };

  // Handle cancel popup
  const handleCancelPopup = () => {
    window.getSelection().removeAllRanges();
    setShowPopup(false);
    setSelectedText('');
    setSelectionRange(null);
  };

  // Render text with highlights
  const renderHighlightedText = () => {
    if (!text) return null;

    // Sort highlights by start offset
    const sortedHighlights = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
    
    if (sortedHighlights.length === 0) {
      return <Typography component="div" ref={textRef} sx={{ whiteSpace: 'pre-wrap', userSelect: 'text', fontSize: `${1 * (zoomLevel / 100)}rem` }}>{text}</Typography>;
    }

    const parts = [];
    let lastIndex = 0;

    sortedHighlights.forEach((highlight, index) => {
      // Add text before highlight
      if (highlight.startOffset > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {text.substring(lastIndex, highlight.startOffset)}
          </span>
        );
      }

      // Add highlighted text
      parts.push(
        <span
          key={`highlight-${highlight.id}`}
          style={{
            backgroundColor: '#fff9c4',
            cursor: 'pointer',
            position: 'relative'
          }}
          onClick={() => handleEditHighlight(highlight)}
          title={highlight.note || 'Click to edit'}
        >
          {text.substring(highlight.startOffset, highlight.endOffset)}
        </span>
      );

      lastIndex = highlight.endOffset;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-end`}>
          {text.substring(lastIndex)}
        </span>
      );
    }

    return (
      <Typography component="div" ref={textRef} sx={{ whiteSpace: 'pre-wrap', userSelect: 'text', fontSize: `${1 * (zoomLevel / 100)}rem` }}>
        {parts}
      </Typography>
    );
  };

  return (
    <Box>
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 2, 
          bgcolor: 'grey.50',
          position: 'relative'
        }}
      >
        {renderHighlightedText()}
      </Paper>

      {/* Small popup above selected text */}
      {showPopup && (
        <Paper
          ref={popupRef}
          elevation={4}
          sx={{
            position: 'fixed',
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            zIndex: 10000,
            p: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            borderRadius: 1,
            bgcolor: 'primary.main',
            color: 'white',
            minWidth: '100px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <Button
            size="small"
            onClick={handleOpenHighlightDialog}
            sx={{
              color: 'white',
              textTransform: 'none',
              fontSize: '0.75rem',
              minWidth: 'auto',
              px: 1,
              py: 0.5,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
            startIcon={<Highlight sx={{ fontSize: 16 }} />}
          >
            Add Highlight
          </Button>
        </Paper>
      )}

      {/* Highlights list */}
      {highlights.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Highlights ({highlights.length})
          </Typography>
          {highlights.map((highlight) => (
            <Chip
              key={highlight.id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Highlight sx={{ fontSize: 16 }} />
                  <Typography variant="caption">
                    {highlight.text.length > 30 ? `${highlight.text.substring(0, 30)}...` : highlight.text}
                  </Typography>
                  {highlight.note && <Typography variant="caption" color="text.secondary">•</Typography>}
                  {highlight.imageUrl && <ImageIcon sx={{ fontSize: 14 }} />}
                </Box>
              }
              onClick={() => handleEditHighlight(highlight)}
              onDelete={() => onHighlightDelete(highlight.id)}
              sx={{ mr: 1, mb: 1 }}
              color="warning"
              variant="outlined"
            />
          ))}
        </Box>
      )}

      {/* Highlight Dialog */}
      <Dialog 
        open={showHighlightDialog} 
        onClose={handleCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {editingHighlight ? 'Edit Highlight' : 'Add Highlight'}
            </Typography>
            <IconButton onClick={handleCancel} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Selected text:
            </Typography>
            <Paper variant="outlined" sx={{ p: 1, bgcolor: '#fff9c4' }}>
              <Typography variant="body2">{selectedText || editingHighlight?.text}</Typography>
            </Paper>
          </Box>

          <TextField
            label="Note (optional)"
            multiline
            rows={3}
            fullWidth
            value={highlightNote}
            onChange={(e) => setHighlightNote(e.target.value)}
            placeholder="Add a note about this highlight..."
            sx={{ mb: 2 }}
          />

          <Box sx={{ mb: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              startIcon={<ImageIcon />}
              onClick={() => fileInputRef.current?.click()}
              fullWidth
              sx={{ mb: 1 }}
            >
              {highlightImageUrl ? 'Change Image' : 'Attach Image (optional)'}
            </Button>
            {highlightImageUrl && (
              <Box sx={{ mt: 2 }}>
                <img
                  src={getImageUrl(highlightImageUrl)}
                  alt="Highlight attachment"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    borderRadius: '4px',
                    backgroundColor: '#f5f5f5'
                  }}
                  onError={(e) => {
                    console.error('Failed to load highlight image:', {
                      originalUrl: highlightImageUrl,
                      processedUrl: getImageUrl(highlightImageUrl)
                    });
                    e.target.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('Highlight image loaded successfully:', getImageUrl(highlightImageUrl));
                  }}
                />
                <Button
                  size="small"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => {
                    setHighlightImage(null);
                    setHighlightImageUrl(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  sx={{ mt: 1 }}
                >
                  Remove Image
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button
            onClick={editingHighlight ? handleUpdateHighlight : handleAddHighlight}
            variant="contained"
            color="primary"
          >
            {editingHighlight ? 'Update' : 'Add Highlight'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HighlightableText;

