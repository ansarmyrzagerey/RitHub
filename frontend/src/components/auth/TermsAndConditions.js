import React from 'react';
import { 
  Box, 
  Typography, 
  FormControlLabel,
  Checkbox,
  Link
} from '@mui/material';
import { 
  Gavel 
} from '@mui/icons-material';

const TermsAndConditions = ({ checked, onChange, error, disabled }) => {
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
        <Gavel color="primary" />
        Terms & Conditions
      </Typography>

      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            color="primary"
          />
        }
        label={
          <Typography variant="body2" color="text.secondary">
            I agree to the{' '}
            <Link
              href="#"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link
              href="#"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Privacy Policy
            </Link>
            . I understand that my data will be used in accordance with these policies.
          </Typography>
        }
        sx={{
          alignItems: 'flex-start',
          '& .MuiFormControlLabel-label': {
            mt: 0.5,
          },
        }}
      />

      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 4, display: 'block' }}>
          {error}
        </Typography>
      )}

      <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          <strong>Data Usage Notice:</strong> By creating an account, you consent to the collection and processing of your personal data for research purposes. Your data will be handled securely and in compliance with applicable privacy laws.
        </Typography>
      </Box>
    </Box>
  );
};

export default TermsAndConditions;
