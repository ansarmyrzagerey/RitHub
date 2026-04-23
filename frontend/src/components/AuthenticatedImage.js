import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';

/**
 * Component that loads images from authenticated endpoints
 * Uses fetch with Authorization header and converts to blob URL
 */
const AuthenticatedImage = ({ src, alt, style, onLoad, onError, ...props }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset state when src changes
    setImageSrc(null);
    setLoading(true);
    setError(null);

    // If src is a data URL or external URL, use it directly
    if (!src || src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      setImageSrc(src);
      setLoading(false);
      return;
    }

    let objectUrl = null;
    let cancelled = false;

    // For authenticated endpoints, fetch with token
    const loadAuthenticatedImage = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = process.env.REACT_APP_API_URL || '/api';
        
        // Construct the full URL
        let fullUrl;
        if (src.startsWith('http://') || src.startsWith('https://')) {
          // Already a full URL, use as-is
          fullUrl = src;
        } else if (src.startsWith('/api')) {
          // Path already includes /api prefix - use as-is (proxy will handle it)
          // If apiBaseUrl is a full URL, construct full URL
          if (apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://')) {
            // apiBaseUrl is like http://localhost:5000/api
            // src is /api/participant/artifacts/123/image
            // We want http://localhost:5000/api/participant/artifacts/123/image
            try {
              const baseUrlObj = new URL(apiBaseUrl);
              fullUrl = `${baseUrlObj.origin}${src}`;
            } catch (e) {
              // Fallback: use src as-is
              fullUrl = src;
            }
          } else {
            // apiBaseUrl is relative, src already has /api, use src as-is
            fullUrl = src;
          }
        } else if (src.startsWith('/')) {
          // Relative path starting with /, prepend apiBaseUrl
          fullUrl = apiBaseUrl.startsWith('http') ? `${apiBaseUrl}${src}` : `${apiBaseUrl}${src}`;
        } else {
          // Relative path without /, prepend apiBaseUrl/
          fullUrl = `${apiBaseUrl}/${src}`;
        }
        
        console.log('[AuthenticatedImage] Loading image:', { src, apiBaseUrl, fullUrl });

        const headers = {
          'Accept': 'image/*',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: headers,
          credentials: 'include',
        });

        if (cancelled) return;

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Failed to load image: ${response.status} ${response.statusText}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
          } catch (e) {
            // Not JSON, use status text or error text
            if (errorText && errorText.trim()) {
              errorMessage = errorText;
            }
          }
          
          console.error('[AuthenticatedImage] HTTP error:', {
            status: response.status,
            statusText: response.statusText,
            url: fullUrl,
            errorText: errorText.substring(0, 200), // First 200 chars
            hasToken: !!token
          });
          
          throw new Error(errorMessage);
        }

        const blob = await response.blob();
        if (cancelled) {
          URL.revokeObjectURL(URL.createObjectURL(blob));
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[AuthenticatedImage] Error loading image:', err);
        setError(err.message || 'Failed to load image');
        setLoading(false);
        if (onError) {
          onError(err);
        }
      }
    };

    loadAuthenticatedImage();

    // Cleanup function
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, onError]);

  // Cleanup blob URL when component unmounts or imageSrc changes
  useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      </Box>
    );
  }

  if (!imageSrc) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="error" variant="body2">
          No image source available
        </Typography>
      </Box>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt || 'Image'}
      style={style}
      onLoad={onLoad}
      onError={(e) => {
        console.error('[AuthenticatedImage] Image render error:', e);
        setError('Image failed to render');
        if (onError) {
          onError(e);
        }
      }}
      {...props}
    />
  );
};

export default AuthenticatedImage;

