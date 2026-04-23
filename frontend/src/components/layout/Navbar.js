import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Home,
  Science,
  Code,
  Assessment,
  AccountCircle,
  Logout,
  Settings,
  Quiz,
  AdminPanelSettings
} from '@mui/icons-material';
import { Link, useNavigate, useLocation } from 'react-router-dom';

// Import constants and utilities
import { RESEARCHER_NAV_ITEMS, PARTICIPANT_NAV_ITEMS, REVIEWER_NAV_ITEMS, ROUTES, APP_CONFIG } from '../../constants';
import { isActivePath } from '../../utils';
import { useAuth } from '../../hooks/useAuth';

// Import styles
import '../../styles/globals.css';
import '../../styles/components.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isResearcher, isParticipant, isReviewer, isAdmin, logout } = useAuth();

  // Get navigation items based on role
  let navItems = RESEARCHER_NAV_ITEMS;
  if (isParticipant) navItems = PARTICIPANT_NAV_ITEMS;
  else if (isReviewer) navItems = REVIEWER_NAV_ITEMS;
  
  // Filter out specific items for admin users
  if (isAdmin) {
    const itemsToRemove = ['Home', 'Studies', 'Quizzes', 'Artifacts', 'Analytics'];
    navItems = navItems.filter(item => !itemsToRemove.includes(item.label));
  }

  // State
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Events
  const handleMobileMenuOpen = (event) => setMobileMenuAnchor(event.currentTarget);
  const handleMobileMenuClose = () => setMobileMenuAnchor(null);
  const handleProfileMenuOpen = (event) => setProfileMenuAnchor(event.currentTarget);
  const handleProfileMenuClose = () => setProfileMenuAnchor(null);

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const handleLogoClick = () => {
    if (isParticipant) navigate(ROUTES.PARTICIPANT_DASHBOARD);
    else navigate(ROUTES.DASHBOARD);
  };

  // Fetch user role
  useEffect(() => {
    try {
      const { authService } = require('../../services/api');
      authService.getCurrentUser()
        .then(res => {
          const user = res.data?.user ?? null;
          if (user?.role) setUserRole(user.role);
        })
        .catch(() => { });
    } catch (err) { }
  }, []);

  // Icon mapping
  const iconMap = {
    Dashboard,
    Home,
    Science,
    Code,
    Assessment,
    Quiz,
  };

  return (
    <AppBar
      position="sticky"
      sx={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        zIndex: theme.zIndex.appBar,
        overflow: 'visible',
      }}
    >
      <Toolbar sx={{ px: { xs: 2, md: 3 }, overflow: 'visible', position: 'relative' }}>

        {/* Logo */}
        <Box
          display="flex"
          alignItems="center"
          sx={{ flexGrow: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          onClick={handleLogoClick}
        >
          <Avatar sx={{ backgroundColor: 'primary.main', width: 40, height: 40, mr: 2 }}>
            <Science />
          </Avatar>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #10a37f 0%, #6366f1 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            {APP_CONFIG.NAME}
          </Typography>
        </Box>

        {/* Desktop Navigation */}
        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 1, mr: 3 }}>
            {navItems.map((item) => {
              const IconComponent = iconMap[item.icon];
              const isActive = isActivePath(location.pathname, item.path);

              return (
                <Button
                  key={item.path}
                  component={Link}
                  to={item.path}
                  startIcon={<IconComponent />}
                  sx={{
                    color: isActive ? 'primary.main' : 'text.primary',
                    backgroundColor: isActive ? 'primary.50' : 'transparent',
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    textTransform: 'none',
                    fontWeight: isActive ? 600 : 500,
                    '&:hover': {
                      backgroundColor: isActive ? 'primary.100' : 'action.hover',
                    },
                  }}
                >
                  {item.label}
                </Button>
              );
            })}

            {/* Reviewer-specific extra button removed; dashboard is in navItems */}

            {/* Admin Dashboard (FIXED) */}
            {userRole === 'admin' && (
              <Button
                component={Link}
                to="/admin/dashboard"
                startIcon={<AdminPanelSettings />}
                sx={{
                  color: location.pathname.startsWith('/admin') ? 'primary.main' : 'text.primary',
                  backgroundColor: location.pathname.startsWith('/admin') ? 'primary.50' : 'transparent',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: location.pathname.startsWith('/admin') ? 600 : 500,
                }}
              >
                Control Panel
              </Button>
            )}
          </Box>
        )}

        {/* Right Side: Profile + Mobile Menu */}
        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            label="Online"
            size="small"
            color="success"
            variant="outlined"
            sx={{ display: { xs: 'none', sm: 'flex' }, fontSize: '0.75rem' }}
          />

          {/* Profile */}
          <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0.5, '&:hover': { backgroundColor: 'action.hover' } }}>
            <Avatar sx={{ width: 36, height: 36, backgroundColor: 'primary.main' }}>
              <AccountCircle />
            </Avatar>
          </IconButton>

          {/* Mobile Menu Button */}
          {isMobile && (
            <IconButton onClick={handleMobileMenuOpen} sx={{ ml: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
        </Box>

        {/* Profile Menu */}
        <Menu
          anchorEl={profileMenuAnchor}
          open={Boolean(profileMenuAnchor)}
          onClose={handleProfileMenuClose}
        >
          <MenuItem onClick={() => { navigate(ROUTES.PROFILE); handleProfileMenuClose(); }}>
            <AccountCircle sx={{ mr: 2 }} /> Profile
          </MenuItem>
          <MenuItem onClick={() => { navigate(ROUTES.PROFILE); handleProfileMenuClose(); }}>
            <Settings sx={{ mr: 2 }} /> Settings
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <Logout sx={{ mr: 2 }} /> Logout
          </MenuItem>
        </Menu>

        {/* Mobile Menu */}
        <Menu
          anchorEl={mobileMenuAnchor}
          open={Boolean(mobileMenuAnchor)}
          onClose={handleMobileMenuClose}
        >
          {navItems.map((item) => {
            const IconComponent = iconMap[item.icon];
            const isActive = isActivePath(location.pathname, item.path);

            return (
              <MenuItem
                key={item.path}
                onClick={() => { navigate(item.path); handleMobileMenuClose(); }}
                sx={{
                  backgroundColor: isActive ? 'primary.50' : 'transparent',
                  color: isActive ? 'primary.main' : 'text.primary',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <IconComponent />
                <Typography sx={{ ml: 2 }}>{item.label}</Typography>
              </MenuItem>
            );
          })}

          {/* Participant */}
          {userRole === 'participant' && (
            <MenuItem onClick={() => { navigate(ROUTES.PARTICIPANT_DASHBOARD); handleMobileMenuClose(); }}>
              <Dashboard />
              <Typography sx={{ ml: 2 }}>Participant</Typography>
            </MenuItem>
          )}
          {/* Researcher link in mobile menu */}
          {userRole === 'researcher' && (
            <MenuItem onClick={() => { navigate(ROUTES.RESEARCHER_DASHBOARD); handleMobileMenuClose(); }}>
              <Assessment />
              <Typography sx={{ ml: 2 }}>Researcher</Typography>
            </MenuItem>
          )}

          {/* Reviewer */}
          {userRole === 'reviewer' && (
            <MenuItem onClick={() => { navigate(ROUTES.REVIEWER_DASHBOARD); handleMobileMenuClose(); }}>
              <Assessment />
              <Typography sx={{ ml: 2 }}>Reviewer</Typography>
            </MenuItem>
          )}

          {/* Admin (FIXED — one clean MenuItem) */}
          {userRole === 'admin' && (
            <MenuItem onClick={() => { navigate('/admin/dashboard'); handleMobileMenuClose(); }}>
              <AdminPanelSettings />
              <Typography sx={{ ml: 2 }}>Control Panel</Typography>
            </MenuItem>
          )}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
