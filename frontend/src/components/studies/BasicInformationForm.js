import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  FormHelperText,
} from '@mui/material';

const BasicInformationForm = ({ data, onChange, onNext }) => {
  const [formData, setFormData] = useState({
    title: data.title || '',
    description: data.description || '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Update parent component when form data changes
    onChange(formData);
  }, [formData]);

  const validateTitle = (value) => {
    if (!value || value.trim() === '') {
      return 'Title is required';
    }
    if (value.length > 255) {
      return 'Title must be 255 characters or less';
    }
    return null;
  };

  const validateDescription = (value) => {
    if (!value || value.trim() === '') {
      return 'Description is required';
    }
    return null;
  };

  const handleTitleChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, title: value }));
    
    const error = validateTitle(value);
    setErrors((prev) => ({ ...prev, title: error }));
  };

  const handleDescriptionChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, description: value }));
    
    const error = validateDescription(value);
    setErrors((prev) => ({ ...prev, description: error }));
  };

  const handleBlur = (field) => {
    if (field === 'title') {
      const error = validateTitle(formData.title);
      setErrors((prev) => ({ ...prev, title: error }));
    } else if (field === 'description') {
      const error = validateDescription(formData.description);
      setErrors((prev) => ({ ...prev, description: error }));
    }
  };

  const isValid = () => {
    const titleError = validateTitle(formData.title);
    const descriptionError = validateDescription(formData.description);
    return !titleError && !descriptionError;
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
        Basic Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Provide a title and description for your study
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Title Field */}
        <Box>
          <TextField
            fullWidth
            label="Study Title"
            placeholder="e.g., Code Readability Comparison Study"
            value={formData.title}
            onChange={handleTitleChange}
            onBlur={() => handleBlur('title')}
            error={!!errors.title}
            helperText={errors.title || `${formData.title.length}/255 characters`}
            required
            inputProps={{ maxLength: 255 }}
          />
        </Box>

        {/* Description Field */}
        <Box>
          <TextField
            fullWidth
            label="Study Description"
            placeholder="Describe the purpose and goals of your study..."
            value={formData.description}
            onChange={handleDescriptionChange}
            onBlur={() => handleBlur('description')}
            error={!!errors.description}
            helperText={errors.description || 'Provide a detailed description of your study'}
            required
            multiline
            rows={6}
          />
        </Box>

        {/* Validation Summary */}
        {!isValid() && (formData.title || formData.description) && (
          <FormHelperText error>
            Please fix the errors above before proceeding
          </FormHelperText>
        )}
      </Box>
    </Box>
  );
};

export default BasicInformationForm;
