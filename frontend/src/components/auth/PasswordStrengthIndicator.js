import React from 'react';
import { 
  Box, 
  Typography, 
  LinearProgress,
  Chip
} from '@mui/material';
import { 
  CheckCircle, 
  Error 
} from '@mui/icons-material';

const PasswordStrengthIndicator = ({ password }) => {
  const getPasswordStrength = (password) => {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      
    };

    Object.values(checks).forEach(check => {
      if (check) score++;
    });

    return { score, checks };
  };

  const getStrengthColor = (score) => {
    if (score <= 2) return 'error';
    if (score <= 3) return 'warning';
    return 'success';
  };

  const getStrengthLabel = (score) => {
    if (score <= 2) return 'Weak';
    if (score <= 3) return 'Medium';
    return 'Strong';
  };

  const { score, checks } = getPasswordStrength(password);

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Password Strength:
        </Typography>
        <Chip
          label={getStrengthLabel(score)}
          size="small"
          color={getStrengthColor(score)}
          variant="outlined"
        />
      </Box>
      
      <LinearProgress
        variant="determinate"
        value={(score / 5) * 100}
        color={getStrengthColor(score)}
        sx={{ mb: 1, height: 6, borderRadius: 3 }}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {Object.entries(checks).map(([key, isValid]) => (
          <Box
            key={key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            {isValid ? (
              <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
            ) : (
              <Error sx={{ fontSize: 16, color: 'error.main' }} />
            )}
            <Typography
              variant="caption"
              sx={{
                color: isValid ? 'success.main' : 'error.main',
                textTransform: 'capitalize',
              }}
            >
              {key === 'length' && 'At least 8 characters'}
              {key === 'lowercase' && 'Contains lowercase letter'}
              {key === 'uppercase' && 'Contains uppercase letter'}
              {key === 'number' && 'Contains number'}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default PasswordStrengthIndicator;
