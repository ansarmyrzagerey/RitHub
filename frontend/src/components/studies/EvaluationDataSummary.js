import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Assessment,
  People,
  Assignment,
  Warning,
} from '@mui/icons-material';
import { studyService } from '../../services/studyService';

const EvaluationDataSummary = ({ studyId, studyStatus }) => {
  const [evaluationData, setEvaluationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvaluationData();
  }, [studyId]);

  const fetchEvaluationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await studyService.getEvaluationData(studyId);
      setEvaluationData(response.evaluation_data);
    } catch (err) {
      console.error('Error fetching evaluation data:', err);
      setError('Failed to load evaluation data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!evaluationData || !evaluationData.has_evaluation_data) {
    return null; // Don't show if no evaluation data exists
  }

  const isCancelled = studyStatus === 'cancelled';

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Assessment color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Evaluation Data
          </Typography>
          {isCancelled && (
            <Chip 
              label="Preserved" 
              color="warning" 
              size="small"
              icon={<Warning />}
            />
          )}
        </Box>

        {isCancelled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This study was cancelled, but all evaluation data has been preserved for analysis.
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Assignment sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 600, color: 'primary.main' }}>
                {evaluationData.total_evaluations}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Evaluations
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <People sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                {evaluationData.unique_participants}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Participants
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Assignment sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 600, color: 'info.main' }}>
                {evaluationData.total_tasks}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Evaluation Tasks
              </Typography>
            </Box>
          </Grid>

          {isCancelled && evaluationData.cancelled_study_evaluations > 0 && (
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                <Warning sx={{ fontSize: 40, color: 'warning.dark', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, color: 'warning.dark' }}>
                  {evaluationData.cancelled_study_evaluations}
                </Typography>
                <Typography variant="body2" color="warning.dark">
                  From Cancelled Study
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>

        {isCancelled && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="body2" color="warning.dark">
              <strong>Note:</strong> All evaluation data from this cancelled study has been marked 
              and preserved. This data can still be viewed and analyzed, but is clearly identified 
              as coming from a cancelled study.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default EvaluationDataSummary;
