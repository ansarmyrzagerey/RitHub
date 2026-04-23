import React from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { 
  Person, 
  Email, 
  Phone,
  Business
} from '@mui/icons-material';

const PersonalInfoSection = ({ formData, errors, onInputChange, isLoading }) => {
  return (
    <Box>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          color: 'text.primary',
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Person color="primary" />
        Personal Information
      </Typography>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          fullWidth
          label="First Name"
          type="text"
          value={formData.firstName || ''}
          onChange={onInputChange('firstName')}
          error={!!errors.firstName}
          helperText={errors.firstName}
          margin="normal"
          required
          disabled={isLoading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Person color="action" />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            },
          }}
        />

        <TextField
          fullWidth
          label="Last Name"
          type="text"
          value={formData.lastName || ''}
          onChange={onInputChange('lastName')}
          error={!!errors.lastName}
          helperText={errors.lastName}
          margin="normal"
          required
          disabled={isLoading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Person color="action" />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            },
          }}
        />
      </Box>

      <TextField
        fullWidth
        label="Email Address"
        type="email"
        value={formData.email || ''}
        onChange={onInputChange('email')}
        error={!!errors.email}
        helperText={errors.email}
        margin="normal"
        required
        disabled={isLoading}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Email color="action" />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          },
        }}
      />

      <TextField
        fullWidth
        label="Phone Number (Optional)"
        type="tel"
        value={formData.phone || ''}
        onChange={onInputChange('phone')}
        error={!!errors.phone}
        helperText={errors.phone}
        margin="normal"
        disabled={isLoading}
        placeholder="+90 (530) 300 74 74"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Phone color="action" />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          },
        }}
      />

      <TextField
        fullWidth
        label="Organization/Institution (Optional)"
        type="text"
        value={formData.organization || ''}
        onChange={onInputChange('organization')}
        error={!!errors.organization}
        helperText={errors.organization}
        margin="normal"
        disabled={isLoading}
        placeholder="University, Company, etc."
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Business color="action" />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          },
        }}
      />
    </Box>
  );
};

export default PersonalInfoSection;
