import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Grid,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  Science,
  AccessTime,
  CheckCircle,
  PlayArrow,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';

/**
 * AssignedStudiesList - Organism Component
 * Displays all current and upcoming studies the participant is enrolled in
 */
const AssignedStudiesList = ({ 
  studies = [], 
  onStudyClick,
  showMoreButton = false,
  showLessButton = false,
  onShowMore,
  onShowLess,
  totalCount
}) => {
  if (studies.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Science sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Assigned Studies
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You haven't been assigned to any studies yet.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'upcoming':
        return 'info';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'upcoming':
        return 'Upcoming';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            Assigned Studies
          </Typography>
          <Chip 
            label={`${totalCount !== undefined ? totalCount : studies.length} ${(totalCount !== undefined ? totalCount : studies.length) === 1 ? 'Study' : 'Studies'}`}
            color="primary"
            variant="outlined"
            size="small"
          />
        </Box>

        <Grid container spacing={2.5}>
          {studies.map((study) => (
            <Grid item xs={12} key={study.id}>
              <Card 
                variant="outlined"
                sx={{
                  transition: 'box-shadow 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
                    cursor: 'pointer',
                  },
                }}
                onClick={() => onStudyClick && onStudyClick(study)}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: '1rem' }}>
                        {study.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.875rem' }}>
                        {study.description || 'No description available'}
                      </Typography>
                    </Box>
                    <Chip
                      label={getStatusLabel(study.status)}
                      color={getStatusColor(study.status)}
                      size="small"
                      sx={{ ml: 2 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTime fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                        {study.deadline ? `Due: ${new Date(study.deadline).toLocaleDateString()}` : 'No deadline'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CheckCircle fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                        {study.completedTasks || 0} / {study.totalTasks || 0} tasks completed
                      </Typography>
                    </Box>
                  </Box>

                  {study.totalTasks > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={(study.completedTasks / study.totalTasks) * 100}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>
                  )}

                  <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      onStudyClick && onStudyClick(study);
                    }}
                    sx={{ mt: 1 }}
                    disabled={study.status === 'cancelled'}
                  >
                    {study.status === 'cancelled' ? 'Study Cancelled' : study.status === 'completed' ? 'View Details' : 'Continue Study'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Show More / Show Less Button */}
        {showMoreButton && onShowMore && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Button
              variant="outlined"
              startIcon={<ExpandMore />}
              onClick={onShowMore}
              sx={{ minWidth: 150 }}
            >
              Show More ({totalCount !== undefined ? totalCount - studies.length : 0} more)
            </Button>
          </Box>
        )}
        {showLessButton && onShowLess && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Button
              variant="outlined"
              startIcon={<ExpandLess />}
              onClick={onShowLess}
              sx={{ minWidth: 150 }}
            >
              Show Less
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AssignedStudiesList;


