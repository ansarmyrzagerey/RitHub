import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Lock,
  Person,
  Security
} from '@mui/icons-material';

// Import password strength indicator
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

const AccountInfoSection = ({ formData, errors, onInputChange, isLoading }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

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
        <Security color="primary" />
        Account Information
      </Typography>

      <TextField
        fullWidth
        label="Username"
        type="text"
        value={formData.username || ''}
        onChange={onInputChange('username')}
        error={!!errors.username}
        helperText={errors.username || 'Choose a unique username (3-20 characters)'}
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

      <FormControl
        fullWidth
        margin="normal"
        required
        disabled={isLoading}
        error={!!errors.role}
      >
        <InputLabel>Role</InputLabel>
        <Select
          value={formData.role || ''}
          onChange={onInputChange('role')}
          label="Role"
        >
          <MenuItem value="researcher">Researcher</MenuItem>
          <MenuItem value="reviewer">Reviewer</MenuItem>
          <MenuItem value="participant">Participant</MenuItem>
        </Select>
        {errors.role && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
            {errors.role}
          </Typography>
        )}
      </FormControl>

      <TextField
        fullWidth
        label="Password"
        type={showPassword ? 'text' : 'password'}
        value={formData.password || ''}
        onChange={onInputChange('password')}
        error={!!errors.password}
        helperText={errors.password}
        margin="normal"
        required
        disabled={isLoading}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Lock color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={handleTogglePasswordVisibility}
                edge="end"
                disabled={isLoading}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          },
        }}
      />

      {/* Password Strength Indicator */}
      {formData.password && (
        <PasswordStrengthIndicator password={formData.password} />
      )}

      <TextField
        fullWidth
        label="Confirm Password"
        type={showConfirmPassword ? 'text' : 'password'}
        value={formData.confirmPassword || ''}
        onChange={onInputChange('confirmPassword')}
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword}
        margin="normal"
        required
        disabled={isLoading}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Lock color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={handleToggleConfirmPasswordVisibility}
                edge="end"
                disabled={isLoading}
              >
                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
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

export default AccountInfoSection;
