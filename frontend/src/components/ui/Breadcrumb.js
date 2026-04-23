import React from 'react';
import { Breadcrumbs, Link, Typography, Box } from '@mui/material';
import { NavigateNext, Home } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Breadcrumb component for navigation
 * @param {Array} items - Array of breadcrumb items with { label, path } structure
 */
const Breadcrumb = ({ items = [] }) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Breadcrumbs
        separator={<NavigateNext fontSize="small" />}
        aria-label="breadcrumb"
        sx={{
          '& .MuiBreadcrumbs-separator': {
            mx: 1,
          },
        }}
      >
        {/* Home icon as first breadcrumb */}
        <Link
          component={RouterLink}
          to="/dashboard"
          underline="hover"
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main',
            },
          }}
        >
          <Home sx={{ mr: 0.5, fontSize: 20 }} />
          Dashboard
        </Link>

        {/* Render breadcrumb items */}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          if (isLast) {
            // Last item is not clickable
            return (
              <Typography
                key={index}
                color="text.primary"
                sx={{ fontWeight: 600 }}
              >
                {item.label}
              </Typography>
            );
          }

          // Other items are clickable links
          return (
            <Link
              key={index}
              component={RouterLink}
              to={item.path}
              underline="hover"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                },
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
};

export default Breadcrumb;
