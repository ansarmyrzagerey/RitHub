import React from 'react';
import { Alert, AlertTitle, Box, List, ListItem, ListItemText } from '@mui/material';
import { Error as ErrorIcon } from '@mui/icons-material';

/**
 * ValidationSummary component displays a summary of validation errors
 * @param {object} props - Component props
 * @param {object} props.errors - Object containing validation errors
 * @param {string} props.title - Optional title for the summary
 * @param {string} props.severity - Alert severity (default: 'error')
 */
const ValidationSummary = ({ errors, title = 'Please fix the following errors', severity = 'error' }) => {
  // Convert errors object to array
  const errorList = Object.entries(errors || {})
    .filter(([_, value]) => value) // Filter out null/undefined values
    .map(([key, value]) => ({
      field: key,
      message: value
    }));

  // Don't render if no errors
  if (errorList.length === 0) {
    return null;
  }

  return (
    <Alert severity={severity} icon={<ErrorIcon />} sx={{ mb: 2 }}>
      <AlertTitle>{title}</AlertTitle>
      <List dense disablePadding>
        {errorList.map((error, index) => (
          <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
            <ListItemText
              primary={error.message}
              primaryTypographyProps={{
                variant: 'body2'
              }}
            />
          </ListItem>
        ))}
      </List>
    </Alert>
  );
};

export default ValidationSummary;
