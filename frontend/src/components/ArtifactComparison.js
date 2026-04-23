import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  Button, 
  TextField,
  Rating,
  Chip
} from '@mui/material';

const ArtifactComparison = ({ artifact1, artifact2, onSubmitEvaluation }) => {
  const [ratings, setRatings] = useState({
    readability: 0,
    correctness: 0,
    maintainability: 0
  });
  const [comments, setComments] = useState('');
  const [annotations, setAnnotations] = useState([]);

  const handleRatingChange = (criterion, value) => {
    setRatings(prev => ({
      ...prev,
      [criterion]: value
    }));
  };

  const handleSubmit = () => {
    const evaluation = {
      ratings,
      comments,
      annotations,
      timestamp: new Date().toISOString()
    };
    onSubmitEvaluation(evaluation);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Artifact Comparison
      </Typography>
      
      {/* Side-by-side comparison */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6}>
          <Paper elevation={2} sx={{ p: 2, height: '400px', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              {artifact1?.name || 'Artifact A'}
              <Chip label={artifact1?.type} size="small" sx={{ ml: 1 }} />
            </Typography>
            <Box component="pre" sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
              {artifact1?.content || 'Loading...'}
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={6}>
          <Paper elevation={2} sx={{ p: 2, height: '400px', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              {artifact2?.name || 'Artifact B'}
              <Chip label={artifact2?.type} size="small" sx={{ ml: 1 }} />
            </Typography>
            <Box component="pre" sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
              {artifact2?.content || 'Loading...'}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Rating section */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Rate the Artifacts
        </Typography>
        
        {Object.entries(ratings).map(([criterion, value]) => (
          <Box key={criterion} sx={{ mb: 2 }}>
            <Typography component="legend" sx={{ textTransform: 'capitalize' }}>
              {criterion}
            </Typography>
            <Rating
              value={value}
              onChange={(event, newValue) => handleRatingChange(criterion, newValue)}
              size="large"
            />
          </Box>
        ))}
      </Paper>

      {/* Comments section */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Additional Comments
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Share your thoughts about these artifacts..."
        />
      </Paper>

      {/* Submit button */}
      <Box sx={{ textAlign: 'center' }}>
        <Button 
          variant="contained" 
          size="large" 
          onClick={handleSubmit}
          disabled={Object.values(ratings).some(rating => rating === 0)}
        >
          Submit Evaluation
        </Button>
      </Box>
    </Box>
  );
};

export default ArtifactComparison;