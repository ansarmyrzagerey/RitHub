import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Slider,
  FormControlLabel,
  Switch,
  Chip,
  Paper
} from '@mui/material';
import AuthenticatedImage from './AuthenticatedImage';

/**
 * Component for generating and displaying visual diff between two images
 * Uses Canvas API for pixel-level comparison (browser-compatible)
 */
const ImageDiffViewer = ({ image1Src, image2Src, image1Label, image2Label, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diffImageUrl, setDiffImageUrl] = useState(null);
  const [diffStats, setDiffStats] = useState(null);
  const [threshold, setThreshold] = useState(0.1); // Actual threshold used for calculation
  const [sliderValue, setSliderValue] = useState(0.1); // Immediate slider value for smooth UI
  const [showOriginal, setShowOriginal] = useState(false);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const canvas1Ref = useRef(null);
  const canvas2Ref = useRef(null);
  const diffCanvasRef = useRef(null);
  const resultCanvasRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Load image helper that handles both authenticated and regular images
  const loadImage = async (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // For authenticated endpoints, we need to fetch with credentials
      if (src.startsWith('/api/') || src.includes('/participant/artifacts/')) {
        // Fetch the image with credentials
        fetch(src, {
          credentials: 'include',
          mode: 'cors'
        })
          .then(response => {
            if (!response.ok) throw new Error(`Failed to load image: ${response.statusText}`);
            return response.blob();
          })
          .then(blob => {
            const url = URL.createObjectURL(blob);
            img.onload = () => {
              URL.revokeObjectURL(url);
              resolve(img);
            };
            img.onerror = (e) => {
              URL.revokeObjectURL(url);
              reject(new Error(`Failed to load image: ${e.message || 'Unknown error'}`));
            };
            img.src = url;
          })
          .catch(err => {
            reject(new Error(`Failed to fetch image: ${err.message || 'Unknown error'}`));
          });
      } else {
        // For data URLs or external URLs, try with CORS
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => {
          // If CORS fails, try without CORS (for same-origin images)
          const img2 = new Image();
          img2.onload = () => resolve(img2);
          img2.onerror = () => reject(new Error(`Failed to load image from ${src}`));
          img2.src = src;
        };
        img.src = src;
      }
    });
  };

  // Generate diff image
  useEffect(() => {
    const generateDiff = async () => {
      if (!image1Src || !image2Src) {
        setError('Both images are required for comparison');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Wait a moment to ensure canvas elements are mounted
        await new Promise(resolve => setTimeout(resolve, 50));

        // Load both images
        const [img1, img2] = await Promise.all([
          loadImage(image1Src),
          loadImage(image2Src)
        ]);

        // Get dimensions (use the larger dimensions)
        const width = Math.max(img1.width, img2.width);
        const height = Math.max(img1.height, img2.height);

        // Set up canvases - check if refs are available, create dynamically if not
        let canvas1 = canvas1Ref.current;
        let canvas2 = canvas2Ref.current;
        let diffCanvas = diffCanvasRef.current;
        let resultCanvas = resultCanvasRef.current;

        // If canvases aren't available via refs, create them dynamically
        if (!canvas1) canvas1 = document.createElement('canvas');
        if (!canvas2) canvas2 = document.createElement('canvas');
        if (!diffCanvas) diffCanvas = document.createElement('canvas');
        if (!resultCanvas) resultCanvas = document.createElement('canvas');

        // Set canvas dimensions
        [canvas1, canvas2, diffCanvas, resultCanvas].forEach(canvas => {
          canvas.width = width;
          canvas.height = height;
        });

        // Draw images to canvases
        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');
        const diffCtx = diffCanvas.getContext('2d');
        const resultCtx = resultCanvas.getContext('2d');

        // Fill with white background first
        ctx1.fillStyle = '#FFFFFF';
        ctx1.fillRect(0, 0, width, height);
        ctx2.fillStyle = '#FFFFFF';
        ctx2.fillRect(0, 0, width, height);

        // Draw images (centered if sizes differ)
        const offsetX1 = (width - img1.width) / 2;
        const offsetY1 = (height - img1.height) / 2;
        const offsetX2 = (width - img2.width) / 2;
        const offsetY2 = (height - img2.height) / 2;

        ctx1.drawImage(img1, offsetX1, offsetY1);
        ctx2.drawImage(img2, offsetX2, offsetY2);

        // Get image data
        const imgData1 = ctx1.getImageData(0, 0, width, height);
        const imgData2 = ctx2.getImageData(0, 0, width, height);
        const diffImgData = diffCtx.createImageData(width, height);

        // Compare pixels manually (browser-compatible implementation)
        const data1 = imgData1.data;
        const data2 = imgData2.data;
        const diffData = diffImgData.data;
        let numDiffPixels = 0;

        // Calculate color difference threshold (0-1 maps to 0-255)
        const colorThreshold = threshold * 255;

        for (let i = 0; i < data1.length; i += 4) {
          const r1 = data1[i];
          const g1 = data1[i + 1];
          const b1 = data1[i + 2];
          const a1 = data1[i + 3];

          const r2 = data2[i];
          const g2 = data2[i + 1];
          const b2 = data2[i + 2];
          const a2 = data2[i + 3];

          // Calculate color difference using Euclidean distance in RGB space
          const rDiff = Math.abs(r1 - r2);
          const gDiff = Math.abs(g1 - g2);
          const bDiff = Math.abs(b1 - b2);
          const aDiff = Math.abs(a1 - a2);

          // Calculate total difference (weighted)
          const totalDiff = Math.sqrt(
            rDiff * rDiff * 0.3 +
            gDiff * gDiff * 0.59 +
            bDiff * bDiff * 0.11 +
            aDiff * aDiff * 0.1
          );

          if (totalDiff > colorThreshold) {
            // Pixel is different - highlight it
            numDiffPixels++;
            
            // Alternate between red and magenta for visual variety
            const useAlt = (i / 4) % 2 === 0;
            if (useAlt) {
              diffData[i] = 255;     // R
              diffData[i + 1] = 0;   // G
              diffData[i + 2] = 255; // B (magenta)
            } else {
              diffData[i] = 255;     // R
              diffData[i + 1] = 0;   // G
              diffData[i + 2] = 0;   // B (red)
            }
            diffData[i + 3] = Math.min(255, Math.round(totalDiff * 0.3)); // Alpha based on difference
          } else {
            // Pixel is similar - make it transparent
            diffData[i] = 0;
            diffData[i + 1] = 0;
            diffData[i + 2] = 0;
            diffData[i + 3] = 0;
          }
        }

        // Draw the diff
        diffCtx.putImageData(diffImgData, 0, 0);

        // Create result image (overlay diff on original)
        if (showDiffOnly) {
          // Show only the diff
          resultCtx.putImageData(diffImgData, 0, 0);
        } else {
          // Overlay diff on image2
          resultCtx.drawImage(canvas2, 0, 0);
          resultCtx.globalCompositeOperation = 'multiply';
          resultCtx.drawImage(diffCanvas, 0, 0);
          resultCtx.globalCompositeOperation = 'source-over';
        }

        // Convert to data URL
        const diffUrl = resultCanvas.toDataURL('image/png');

        // Calculate statistics
        const totalPixels = width * height;
        const diffPercentage = (numDiffPixels / totalPixels) * 100;

        setDiffImageUrl(diffUrl);
        setDiffStats({
          numDiffPixels,
          totalPixels,
          diffPercentage: diffPercentage.toFixed(2),
          width,
          height
        });
      } catch (err) {
        console.error('Error generating diff:', err);
        setError(err.message || 'Failed to generate image diff');
      } finally {
        setLoading(false);
      }
    };

    generateDiff();
  }, [image1Src, image2Src, threshold, showDiffOnly]);

  // Debounced threshold update - update actual threshold after user stops sliding
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer to update threshold after 300ms of no changes
    debounceTimerRef.current = setTimeout(() => {
      setThreshold(sliderValue);
    }, 300);

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [sliderValue]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Generating image diff...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Controls */}
      <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={showOriginal}
                onChange={(e) => setShowOriginal(e.target.checked)}
                size="small"
              />
            }
            label="Show Original Images"
          />
          <FormControlLabel
            control={
              <Switch
                checked={showDiffOnly}
                onChange={(e) => setShowDiffOnly(e.target.checked)}
                size="small"
              />
            }
            label="Show Diff Only"
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ minWidth: '100px' }}>
            Sensitivity: {sliderValue.toFixed(2)}
          </Typography>
          <Slider
            value={sliderValue}
            onChange={(e, newValue) => setSliderValue(newValue)}
            min={0}
            max={1}
            step={0.01}
            sx={{ flex: 1, maxWidth: '300px' }}
          />
          <Typography variant="caption" color="text.secondary">
            Lower = more sensitive
          </Typography>
        </Box>

        {diffStats && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`${diffStats.diffPercentage}% different`}
              color={diffStats.diffPercentage > 10 ? 'error' : diffStats.diffPercentage > 5 ? 'warning' : 'success'}
              size="small"
            />
            <Chip
              label={`${diffStats.numDiffPixels.toLocaleString()} / ${diffStats.totalPixels.toLocaleString()} pixels`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${diffStats.width} × ${diffStats.height}`}
              size="small"
              variant="outlined"
            />
          </Box>
        )}
      </Box>

      {/* Image Display */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {showOriginal && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Paper variant="outlined" sx={{ p: 1, flex: 1, minWidth: '300px' }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                {image1Label || 'Image 1'}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
                {image1Src.startsWith('/api/') || image1Src.includes('/participant/artifacts/') ? (
                  <AuthenticatedImage
                    src={image1Src}
                    alt={image1Label || 'Image 1'}
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                ) : (
                  <img
                    src={image1Src}
                    alt={image1Label || 'Image 1'}
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                )}
              </Box>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1, flex: 1, minWidth: '300px' }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                {image2Label || 'Image 2'}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
                {image2Src.startsWith('/api/') || image2Src.includes('/participant/artifacts/') ? (
                  <AuthenticatedImage
                    src={image2Src}
                    alt={image2Label || 'Image 2'}
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                ) : (
                  <img
                    src={image2Src}
                    alt={image2Label || 'Image 2'}
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                )}
              </Box>
            </Paper>
          </Box>
        )}

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Visual Diff
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'grey.50', p: 2, borderRadius: 1, overflow: 'auto' }}>
            {diffImageUrl ? (
              <img
                src={diffImageUrl}
                alt="Image Diff"
                style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
              />
            ) : (
              <Typography color="text.secondary">No diff available</Typography>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Hidden canvases for processing - use position absolute to keep them in DOM but invisible */}
      <Box sx={{ position: 'absolute', left: '-9999px', top: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <canvas ref={canvas1Ref} style={{ display: 'block' }} />
        <canvas ref={canvas2Ref} style={{ display: 'block' }} />
        <canvas ref={diffCanvasRef} style={{ display: 'block' }} />
        <canvas ref={resultCanvasRef} style={{ display: 'block' }} />
      </Box>
    </Box>
  );
};

export default ImageDiffViewer;

