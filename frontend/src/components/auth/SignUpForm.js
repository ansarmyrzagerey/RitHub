import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Link,
  Divider,
  Alert
} from '@mui/material';
import { 
  ArrowForward,
  CheckCircle
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Import atomic components
import PersonalInfoSection from './PersonalInfoSection';
import AccountInfoSection from './AccountInfoSection';
import TermsAndConditions from './TermsAndConditions';

// Import constants and utilities
import { ROUTES } from '../../constants';

const SignUpForm = ({ onSubmit, isLoading, errors, onInputChange, formData, onNavigateToLogin }) => {

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handleSignInClick = () => {
    onNavigateToLogin();
  };

  const handleTermsChange = (event) => {
    onInputChange('acceptTerms')(event);
  };

  return (
    <Box>
      {/* Success Message */}
      {formData.success && (
        <Alert 
          severity="success" 
          icon={<CheckCircle />}
          sx={{ mb: 3 }}
        >
          Account created successfully! Welcome to our platform.
        </Alert>
      )}

      {/* Error Message */}
      {errors.general && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
        >
          {errors.general}
        </Alert>
      )}

      {/* Sign Up Form */}
      <Box component="form" onSubmit={handleSubmit}>
        {/* Personal Information Section */}
        <PersonalInfoSection 
          formData={formData}
          errors={errors}
          onInputChange={onInputChange}
          isLoading={isLoading}
        />

        <Divider sx={{ my: 3 }} />

        {/* Account Information Section */}
        <AccountInfoSection 
          formData={formData}
          errors={errors}
          onInputChange={onInputChange}
          isLoading={isLoading}
        />

        <Divider sx={{ my: 3 }} />

        {/* Terms and Conditions */}
        <Box mb={3}>
          <TermsAndConditions
            checked={formData.acceptTerms || false}
            onChange={handleTermsChange}
            error={errors.acceptTerms}
            disabled={isLoading}
          />
        </Box>

        {/* Submit Button */}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          endIcon={<ArrowForward />}
          disabled={isLoading || !formData.acceptTerms}
          sx={{
            mt: 2,
            mb: 3,
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
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </Button>

        {/* Sign In Link */}
        <Box textAlign="center">
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            Already have an account?
            <Link
              component="button"
              variant="body2"
              onClick={handleSignInClick}
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                padding: 0,
                lineHeight: 1.5,
                '&:hover': {
                  textDecoration: 'underline',
                },
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Sign in
            </Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default SignUpForm;
