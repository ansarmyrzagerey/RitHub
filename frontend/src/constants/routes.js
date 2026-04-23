// Route constants
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  CHANGE_PASSWORD: '/change-password',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  HOME_PAGE: '/home',
  STUDIES: '/studies',
  STUDIES_CREATE: '/studies/create',
  STUDIES_DETAIL: '/studies/:id',
  STUDIES_EDIT: '/studies/:id/edit',
  QUIZZES: '/quizzes',
  ARTIFACTS: '/artifacts',
  VERIFY_EMAIL: '/verify-email',
  // Reviewer-specific routes
  REVIEWER_DASHBOARD: '/reviewer/dashboard',
  // Participant-specific routes
  PARTICIPANT_DASHBOARD: '/participant/dashboard',
  PARTICIPANT_STUDIES: '/participant/studies',
  PARTICIPANT_QUIZZES: '/participant/quizzes',
  // Researcher-specific routes
  RESEARCHER_DASHBOARD: '/researcher/dashboard',
  // Enrollment route
  ENROLL: '/enroll/:token',
};

// Navigation items configuration for Researchers
export const RESEARCHER_NAV_ITEMS = [
  { 
    label: 'Dashboard', 
    path: ROUTES.DASHBOARD, 
    icon: 'Dashboard',
    description: 'Overview of your studies and activities'
  },
  { 
    label: 'Studies', 
    path: ROUTES.STUDIES, 
    icon: 'Science',
    description: 'Manage your research studies'
  },
  { 
    label: 'Quizzes', 
    path: ROUTES.QUIZZES, 
    icon: 'Quiz',
    description: 'Create and manage quizzes'
  },
  { 
    label: 'Artifacts', 
    path: ROUTES.ARTIFACTS, 
    icon: 'Code',
    description: 'Upload and manage artifacts'
  },
];

// Navigation items configuration for Participants
export const PARTICIPANT_NAV_ITEMS = [
  { 
    label: 'Dashboard', 
    path: ROUTES.PARTICIPANT_DASHBOARD, 
    icon: 'Dashboard',
    description: 'View your assigned studies and progress'
  },
  { 
    label: 'Studies', 
    path: ROUTES.PARTICIPANT_STUDIES, 
    icon: 'Science',
    description: 'Evaluate studies and complete tasks'
  },
  { 
    label: 'Quizzes', 
    path: ROUTES.PARTICIPANT_QUIZZES, 
    icon: 'Quiz',
    description: 'Take quizzes to demonstrate your knowledge'
  },
];

// Navigation items for Reviewers: only Dashboard
export const REVIEWER_NAV_ITEMS = [
  {
    label: 'Dashboard',
    path: ROUTES.REVIEWER_DASHBOARD,
    icon: 'Dashboard',
    description: 'Reviewer dashboard'
  },
];

// Legacy NAV_ITEMS for backward compatibility (defaults to researcher)
export const NAV_ITEMS = RESEARCHER_NAV_ITEMS;
