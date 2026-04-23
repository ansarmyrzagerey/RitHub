import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  History,
  ExpandMore,
  CheckCircle,
  Science,
  Assessment
} from '@mui/icons-material';

/**
 * StudyHistory - Organism Component
 * Access past completed studies with summary of evaluations they contributed
 */
const StudyHistory = ({ completedStudies = [], onStudyClick }) => {
  if (completedStudies.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <History sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Study History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You haven't completed any studies yet.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            Study History
          </Typography>
          <Chip
            label={`${completedStudies.length} ${completedStudies.length === 1 ? 'Study' : 'Studies'}`}
            color="success"
            variant="outlined"
            size="small"
          />
        </Box>

        <Grid container spacing={2.5}>
          {completedStudies.map((study) => (
            <Grid item xs={12} key={study.id}>
              <Card variant="outlined">
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <Science color="primary" fontSize="small" />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                          {study.title}
                        </Typography>
                        <Chip
                          icon={<CheckCircle />}
                          label="Completed"
                          color="success"
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.875rem' }}>
                        {study.description || 'No description available'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Study Summary */}
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        Evaluation Summary
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Assessment fontSize="small" color="action" />
                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                              <strong>Tasks Completed:</strong> {study.tasksCompleted || 0} / {study.totalTasks || 0}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <CheckCircle fontSize="small" color="action" />
                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                              <strong>Completion Date:</strong>{' '}
                              {study.completedAt 
                                ? new Date(study.completedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })
                                : 'N/A'}
                            </Typography>
                          </Box>
                        </Grid>
                        {study.evaluationsCount !== undefined && (
                          <Grid item xs={12} sm={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Assessment fontSize="small" color="action" />
                              <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                <strong>Evaluations Submitted:</strong> {study.evaluationsCount}
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                        {Number.isFinite(study.avgRating) && (
                          <Grid item xs={12} sm={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Assessment fontSize="small" color="action" />
                              <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                <strong>Average Rating:</strong> {study.avgRating.toFixed(1)} / 5.0
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                      </Grid>

                      {study.summary && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                            <strong>Your Contribution:</strong> {study.summary}
                          </Typography>
                        </>
                      )}
                    </AccordionDetails>
                  </Accordion>

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => onStudyClick && onStudyClick(study)}
                    >
                      View Details
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default StudyHistory;


