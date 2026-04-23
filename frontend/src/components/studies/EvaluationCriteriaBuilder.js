import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Paper,
} from '@mui/material';
import {
  Add,
  Delete,
  DragIndicator,
  Visibility,
  Star,
  ThumbUp,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

// Predefined criteria templates
const PREDEFINED_CRITERIA = [
  {
    name: 'Readability',
    description: 'How easy is it to read and understand the code?',
    type: 'predefined',
    scale: 'likert_5',
  },
  {
    name: 'Correctness',
    description: 'Does the code correctly implement the intended functionality?',
    type: 'predefined',
    scale: 'likert_5',
  },
  {
    name: 'Completeness',
    description: 'Is the implementation complete and thorough?',
    type: 'predefined',
    scale: 'likert_5',
  },
  {
    name: 'Efficiency',
    description: 'How efficient is the code in terms of performance?',
    type: 'predefined',
    scale: 'likert_5',
  },
];

const SCALE_TYPES = [
  { value: 'likert_5', label: '5-Point Likert Scale', icon: <ThumbUp /> },
  { value: 'stars_5', label: '5-Star Rating', icon: <Star /> },
  { value: 'binary', label: 'Yes/No', icon: <ThumbUp /> },
  { value: 'numeric', label: 'Numeric (0-100)', icon: null },
];

const EvaluationCriteriaBuilder = ({ data, onChange, onNext, onBack }) => {
  const [criteria, setCriteria] = useState(data.criteria || []);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [newCriterion, setNewCriterion] = useState({
    name: '',
    description: '',
    type: 'custom',
    scale: 'likert_5',
  });

  useEffect(() => {
    onChange({ criteria });
  }, [criteria]);

  const handleAddPredefined = (predefined) => {
    const exists = criteria.some((c) => c.name === predefined.name);
    if (exists) {
      toast.error('This criterion is already added');
      return;
    }

    setCriteria([...criteria, { ...predefined, id: Date.now() }]);
    toast.success('Criterion added');
  };

  const handleAddCustom = () => {
    if (!newCriterion.name.trim()) {
      toast.error('Please enter a criterion name');
      return;
    }

    if (!newCriterion.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setCriteria([...criteria, { ...newCriterion, id: Date.now() }]);
    setNewCriterion({
      name: '',
      description: '',
      type: 'custom',
      scale: 'likert_5',
    });
    setShowAddDialog(false);
    toast.success('Custom criterion added');
  };

  const handleRemove = (id) => {
    setCriteria(criteria.filter((c) => c.id !== id));
  };

  const handleReorder = (index, direction) => {
    const newCriteria = [...criteria];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= criteria.length) return;

    [newCriteria[index], newCriteria[targetIndex]] = [
      newCriteria[targetIndex],
      newCriteria[index],
    ];

    setCriteria(newCriteria);
  };

  const getScaleLabel = (scale) => {
    const scaleType = SCALE_TYPES.find((s) => s.value === scale);
    return scaleType ? scaleType.label : scale;
  };

  const renderScalePreview = (scale) => {
    switch (scale) {
      case 'likert_5':
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'].map((label) => (
              <Chip key={label} label={label} size="small" />
            ))}
          </Box>
        );
      case 'stars_5':
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[1, 2, 3, 4, 5].map((num) => (
              <Star key={num} sx={{ color: 'gold' }} />
            ))}
          </Box>
        );
      case 'binary':
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip label="Yes" size="small" color="success" />
            <Chip label="No" size="small" color="error" />
          </Box>
        );
      case 'numeric':
        return <Typography variant="body2">0 - 100</Typography>;
      default:
        return null;
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
        Evaluation Criteria
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Define the criteria participants will use to evaluate artifacts
      </Typography>

      {/* Predefined Criteria */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
          Predefined Criteria
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {PREDEFINED_CRITERIA.map((predefined) => {
            const isAdded = criteria.some((c) => c.name === predefined.name);
            return (
              <Chip
                key={predefined.name}
                label={predefined.name}
                onClick={() => !isAdded && handleAddPredefined(predefined)}
                color={isAdded ? 'default' : 'primary'}
                variant={isAdded ? 'filled' : 'outlined'}
                disabled={isAdded}
                sx={{ cursor: isAdded ? 'default' : 'pointer' }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Custom Criteria */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Selected Criteria ({criteria.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Visibility />}
              onClick={() => setShowPreviewDialog(true)}
              disabled={criteria.length === 0}
            >
              Preview
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              onClick={() => setShowAddDialog(true)}
            >
              Add Custom
            </Button>
          </Box>
        </Box>

        {criteria.length === 0 ? (
          <Alert severity="info">
            No criteria selected. Add predefined criteria or create custom ones.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {criteria.map((criterion, index) => (
              <Card key={criterion.id} variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'start', gap: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleReorder(index, 'up')}
                        disabled={index === 0}
                      >
                        <DragIndicator />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleReorder(index, 'down')}
                        disabled={index === criteria.length - 1}
                      >
                        <DragIndicator />
                      </IconButton>
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {criterion.name}
                        </Typography>
                        <Chip
                          label={criterion.type}
                          size="small"
                          color={criterion.type === 'predefined' ? 'primary' : 'secondary'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {criterion.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Scale: {getScaleLabel(criterion.scale)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemove(criterion.id)}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Box>

      {/* Add Custom Criterion Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Custom Criterion</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Criterion Name"
              value={newCriterion.name}
              onChange={(e) => setNewCriterion({ ...newCriterion, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={newCriterion.description}
              onChange={(e) => setNewCriterion({ ...newCriterion, description: e.target.value })}
              multiline
              rows={3}
              required
              fullWidth
              helperText="Explain what participants should evaluate"
            />
            <FormControl fullWidth>
              <InputLabel>Rating Scale</InputLabel>
              <Select
                value={newCriterion.scale}
                onChange={(e) => setNewCriterion({ ...newCriterion, scale: e.target.value })}
                label="Rating Scale"
              >
                {SCALE_TYPES.map((scale) => (
                  <MenuItem key={scale.value} value={scale.value}>
                    {scale.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddCustom} variant="contained">
            Add Criterion
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onClose={() => setShowPreviewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Criteria Preview</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This is how participants will see the evaluation criteria
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {criteria.map((criterion, index) => (
              <Paper key={criterion.id} sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  {index + 1}. {criterion.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {criterion.description}
                </Typography>
                {renderScalePreview(criterion.scale)}
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreviewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EvaluationCriteriaBuilder;
