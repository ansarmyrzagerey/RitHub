import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  InputAdornment,
  IconButton,
  Link
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Email, 
  Lock,
  ArrowForward
} from '@mui/icons-material';

// Import constants and utilities
import { ROUTES } from '../../constants';
import { isValidEmail, validatePassword } from '../../utils';

const LoginForm = ({ onSubmit, isLoading, errors, onInputChange, formData, onNavigateToSignUp }) => {
  const [showPassword, setShowPassword] = useState(false);

  // Event handlers
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Box>
      {/* Error Message */}
      {errors.general && (
        <Box
          sx={{
            backgroundColor: 'error.50',
            color: 'error.main',
            p: 2,
            borderRadius: 1,
            mb: 2,
            textAlign: 'center',
          }}
        >
          {errors.general}
        </Box>
      )}

      {/* Login Form */}
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Email or username"
          type="text"
          value={formData.email}
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
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
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

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          endIcon={<ArrowForward />}
          disabled={isLoading}
          sx={{
            mt: 3,
            mb: 2,
            py: 1.5,
            background: 'linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #0d7a5f 0%, #1a7f64 100%)',
              transform: 'translateY(-1px)',
            },
            '&:disabled': {
              background: '#d1d5db',
              transform: 'none',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>

        <Box textAlign="center" mt={2}>
          <Link
            component="button"
            variant="body2"
            onClick={() => window.location.href = ROUTES.FORGOT_PASSWORD}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
              cursor: 'pointer',
            }}
          >
            Forgot your password?
          </Link>
        </Box>

        <Box textAlign="center" mt={2}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            Don't have an account?
            <Link
              component="button"
              variant="body2"
              onClick={onNavigateToSignUp}
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                padding: 0,
                lineHeight: 1.5,
                '&:hover': {
                  textDecoration: 'underline',
                },
                cursor: 'pointer',
              }}
            >
              Sign up
            </Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginForm;