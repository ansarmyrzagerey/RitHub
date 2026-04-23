import React, { useState } from 'react';
import { 
  Container,
  Card,
  CardContent
} from '@mui/material';

// Import atomic components
import { 
  SignUpForm, 
  LoginFooter 
} from '../components';
import SignUpHeader from '../components/auth/SignUpHeader';
import AuthTransition from '../components/auth/AuthTransition';
import useAuthTransition from '../hooks/useAuthTransition';

// Import constants and utilities
import { ROUTES } from '../constants';
import { isValidEmail, validatePassword } from '../utils';
import { authService } from '../services/api';

// Import styles
import '../styles/globals.css';
import '../styles/components.css';

const SignUp = () => {
  // State management
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organization: '',
    username: '',
    role: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    success: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Transition management
  const { navigateToLogin } = useAuthTransition();

  // Event handlers
  const handleInputChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // First name validation
    if (!formData.firstName) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    // Last name validation
    if (!formData.lastName) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation (optional but if provided, should be valid)
    if (formData.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Organization validation (optional)
    if (formData.organization && formData.organization.trim().length < 2) {
      newErrors.organization = 'Organization name must be at least 2 characters';
    }

    // Username validation
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = 'Please select your role';
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        newErrors.password = passwordValidation.message;
      }
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Terms acceptance validation
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Ensure the role matches DB allowed values; use what the user selects
      const allowedRoles = ['researcher', 'participant', 'admin', 'reviewer'];
      const payload = {
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        username: formData.username || null, // Optional username
        organization: formData.organization || null, // Make it explicitly optional
        role: allowedRoles.includes(formData.role) ? formData.role : 'participant',
      };

      const res = await authService.register(payload);
      if (res && res.token) {
        // Redirect based on user role
        if (payload.role === 'researcher') {
          window.location.href = ROUTES.DASHBOARD;
        } else if (payload.role === 'participant') {
          window.location.href = ROUTES.PARTICIPANT_DASHBOARD;
        } else if (payload.role === 'reviewer') {
          window.location.href = ROUTES.PROFILE; // Reviewers go to profile for now
        } else {
          window.location.href = ROUTES.PROFILE; // Default fallback
        }
      } else {
        setErrors({ general: 'Registration failed' });
      }
    } catch (error) {
      console.error('Sign up error:', error);
      const message = error?.response?.data?.message || error?.response?.data?.error || error.message || 'Sign up failed. Please try again.';
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthTransition isSignUp={true}>
      <Container maxWidth="sm">
        <Card
          sx={{
            maxWidth: 600,
            mx: 'auto',
            borderRadius: 3,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <SignUpHeader />
            <SignUpForm 
              onSubmit={handleSubmit}
              isLoading={isLoading}
              errors={errors}
              onInputChange={handleInputChange}
              formData={formData}
              onNavigateToLogin={navigateToLogin}
            />
          </CardContent>
        </Card>

        <LoginFooter />
      </Container>
    </AuthTransition>
  );
};

export default SignUp;
