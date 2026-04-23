import React, { useState, useEffect } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';

const SmartArtifactLayout = ({
  artifacts,
  children,
  taskId
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const [layoutConfig, setLayoutConfig] = useState({});

  // Track container width for responsive layouts
  useEffect(() => {
    const handleResize = () => {
      setContainerWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate optimal layout based on artifacts and screen size
  useEffect(() => {
    const config = calculateOptimalLayout(artifacts, containerWidth, isMobile, isTablet, isDesktop);
    setLayoutConfig(config);
  }, [artifacts, containerWidth, isMobile, isTablet, isDesktop]);

  const calculateOptimalLayout = (artifacts, width, isMobile, isTablet, isDesktop) => {
    const count = artifacts.length;
    const avgComplexity = artifacts.reduce((sum, artifact) => sum + getComplexityScore(artifact), 0) / count;

    // Base configurations
    const configs = {
      mobile: {
        layout: 'stacked',
        columns: 1,
        gap: 2,
        maxArtifactHeight: '600px',
        fontSize: '0.875rem'
      },
      tablet: {
        layout: count <= 2 ? 'side-by-side' : 'grid',
        columns: Math.min(count, 2),
        gap: 2,
        maxArtifactHeight: '800px',
        fontSize: '0.9rem'
      },
      desktop: {
        layout: count <= 3 ? 'optimal' : 'grid',
        columns: Math.min(count, 3),
        gap: 3,
        maxArtifactHeight: '1000px',
        fontSize: '1rem'
      }
    };

    // Adjust based on complexity and content types
    let baseConfig;
    if (isMobile) {
      baseConfig = configs.mobile;
    } else if (isTablet) {
      baseConfig = configs.tablet;
    } else {
      baseConfig = configs.desktop;
    }

    // Special handling for different artifact types
    const hasImages = artifacts.some(a => a.type?.toLowerCase().includes('image'));
    const hasCode = artifacts.some(a => a.type?.toLowerCase().includes('code'));
    const hasLargeText = artifacts.some(a => a.content?.length > 10000);

    if (hasImages && !hasCode) {
      // Image-focused layout - prioritize visual comparison
      baseConfig.maxArtifactHeight = '900px';
      baseConfig.layout = 'balanced';
    } else if (hasCode) {
      // Code-focused layout - ensure readability
      baseConfig.fontSize = '0.875rem';
      baseConfig.maxArtifactHeight = '900px';
    } else if (hasLargeText) {
      // Text-heavy layout - maximize reading space
      baseConfig.maxArtifactHeight = '1000px';
      baseConfig.fontSize = '1rem';
    }

    // Adjust columns based on content similarity
    if (count === 2 && areSimilarTypes(artifacts)) {
      baseConfig.columns = 2; // Side-by-side for similar content
      baseConfig.layout = 'comparison';
    }

    return baseConfig;
  };

  const getComplexityScore = (artifact) => {
    let score = 1; // Base complexity

    // Type-based complexity
    const type = artifact.type?.toLowerCase() || '';
    if (type.includes('code') || type.includes('json')) score += 2;
    if (type.includes('image') || type.includes('diagram')) score += 1;
    if (type.includes('video') || type.includes('audio')) score += 3;

    // Content length complexity
    const contentLength = artifact.content?.length || 0;
    if (contentLength > 5000) score += 1;
    if (contentLength > 20000) score += 2;

    // Metadata complexity
    if (artifact.metadata && Object.keys(artifact.metadata).length > 3) score += 1;

    return Math.min(score, 5); // Cap at 5
  };

  const areSimilarTypes = (artifacts) => {
    if (artifacts.length < 2) return false;

    const types = artifacts.map(a => {
      const type = a.type?.toLowerCase() || '';
      if (type.includes('code') || type.includes('javascript') || type.includes('python')) return 'code';
      if (type.includes('image') || type.includes('png') || type.includes('jpg')) return 'image';
      if (type.includes('text') || type.includes('document')) return 'text';
      return 'other';
    });

    return types.every(type => type === types[0]);
  };

  const getGridTemplate = () => {
    const { layout, columns } = layoutConfig;

    switch (layout) {
      case 'stacked':
        return '1fr';
      case 'side-by-side':
      case 'comparison':
        return `repeat(${Math.min(columns, artifacts.length)}, 1fr)`;
      case 'grid':
        return `repeat(auto-fit, minmax(300px, 1fr))`;
      case 'optimal':
      case 'balanced':
      default:
        // Smart distribution based on artifact count
        if (artifacts.length === 2) return '1fr 1fr';
        if (artifacts.length === 3) return '1fr 1fr 1fr';
        return `repeat(auto-fit, minmax(350px, 1fr))`;
    }
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: getGridTemplate(),
        gap: layoutConfig.gap || 2,
        width: '100%',
        minHeight: '600px',
        '& > *': {
          maxHeight: layoutConfig.maxArtifactHeight || '1000px',
          fontSize: layoutConfig.fontSize || '1rem'
        }
      }}
    >
      {children}
    </Box>
  );
};

export default SmartArtifactLayout;

