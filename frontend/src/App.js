import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Container, Box, CircularProgress } from '@mui/material';
import { Toaster } from 'react-hot-toast';

// Import components
import { Navbar } from './components';
import ReviewerDashboard from './pages/ReviewerDashboard';
import ErrorBoundary from './components/ui/ErrorBoundary';
import GlobalLoadingIndicator from './components/ui/LoadingIndicator';
import { useAuth } from './hooks/useAuth';

// Import pages
// Home page removed
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ResearcherStudyDetails from './pages/ResearcherStudyDetails';
import ResearcherQuizResults from './pages/ResearcherQuizResults';
import Studies from './pages/Studies';
import CreateStudy from './pages/CreateStudy';
import StudyDetailView from './pages/StudyDetailView';
import Artifacts from './pages/Artifacts';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import ParticipantDashboard from './pages/ParticipantDashboard';
import ParticipantStudies from './pages/ParticipantStudies';
import ParticipantStudyDetails from './pages/ParticipantStudyDetails';
import ParticipantTaskEvaluation from './pages/ParticipantTaskEvaluation';
import ParticipantStudyTasks from './pages/ParticipantStudyTasks';
import ParticipantQuizzes from './pages/ParticipantQuizzes';
import ParticipantBadges from './pages/ParticipantBadges';
import TakeQuiz from './pages/TakeQuiz';
import EnrollmentPage from './pages/EnrollmentPage';
import EvaluationTrashBin from './pages/EvaluationTrashBin';
import QuizTrashBin from './pages/QuizTrashBin';
import CompletedStudiesTrashBin from './pages/CompletedStudiesTrashBin';
import CompletedStudies from './pages/CompletedStudies';
import Quizzes from './pages/Quizzes';
import QuizGradingList from './pages/QuizGradingList';
import GradeQuizAttempt from './pages/GradeQuizAttempt';
import AdminDashboard from './pages/AdminDashboard';
import AdminControls from './pages/AdminControls';
import AdminStudyDetails from './pages/AdminStudyDetails';
import StudyTrashBin from './pages/StudyTrashBin';

// Import constants
import { ROUTES } from './constants';

// Import styles
import './styles/globals.css';
import './styles/components.css';

// Protected Route Component
const ProtectedRoute = ({ children, requireRole = null }) => {
  const { isAuthenticated, isParticipant, isResearcher, isReviewer, isAdmin, user, loading, rolesLoading } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute check:', {
    path: location.pathname,
    requireRole,
    isAuthenticated,
    isResearcher,
    isParticipant,
    isReviewer,
    isAdmin,
    userRole: user?.role,
    loading
  });

  // Consider roles unresolved as loading (add rolesLoading in your hook if you can).
  const rolesResolved = isParticipant || isResearcher || isReviewer || isAdmin;
  if (loading || (isAuthenticated && requireRole && !rolesResolved)) {
    console.log('ProtectedRoute: Showing loading spinner');
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: Not authenticated, redirecting to login');
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  // helper to avoid redirecting to the same path
  const safeNavigate = (to, fallback = ROUTES.PROFILE) =>
    location.pathname === to ? <Navigate to={fallback} replace /> : <Navigate to={to} replace />;

  if (requireRole === 'participant' && !isParticipant) {
    console.log('ProtectedRoute: Participant role required but user is not participant');
    if (isAdmin) return safeNavigate('/admin');
    if (isResearcher) return safeNavigate(ROUTES.DASHBOARD);
    if (isReviewer) return safeNavigate(ROUTES.PROFILE); // Reviewers go to profile for now
    // authenticated but no clear role yet -> send to a neutral page (not /dashboard)
    return safeNavigate(ROUTES.PROFILE);
  }

  if (requireRole === 'researcher' && !isResearcher) {
    console.log('ProtectedRoute: Researcher role required but user is not researcher, redirecting');
    if (isAdmin) return safeNavigate('/admin');
    if (isParticipant) return safeNavigate(ROUTES.PARTICIPANT_DASHBOARD);
    if (isReviewer) return safeNavigate(ROUTES.PROFILE); // Reviewers go to profile for now
    return safeNavigate(ROUTES.PROFILE);
  }

  if (requireRole === 'admin' && !isAdmin) {
    console.log('ProtectedRoute: Admin role required but user is not admin, redirecting');
    if (isResearcher) return safeNavigate(ROUTES.DASHBOARD);
    if (isParticipant) return safeNavigate(ROUTES.PARTICIPANT_DASHBOARD);
    if (isReviewer) return safeNavigate(ROUTES.PROFILE); // Reviewers go to profile for now
    return safeNavigate(ROUTES.PROFILE);
  }

  if (requireRole === 'reviewer' && !isReviewer) {
    console.log('ProtectedRoute: Reviewer role required but user is not reviewer, redirecting');
    if (isAdmin) return safeNavigate('/admin');
    if (isResearcher) return safeNavigate(ROUTES.DASHBOARD);
    if (isParticipant) return safeNavigate(ROUTES.PARTICIPANT_DASHBOARD);
    return safeNavigate(ROUTES.PROFILE);
  }

  console.log('ProtectedRoute: Access granted, rendering children');
  return children;
};

// Dashboard Router Component
const DashboardRouter = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Route to appropriate dashboard based on user role
  if (user?.role === 'admin') {
    return <AdminDashboard />;
  } else if (user?.role === 'researcher') {
    return <Dashboard />;
  } else if (user?.role === 'reviewer') {
    return <Navigate to={ROUTES.REVIEWER_DASHBOARD} replace />;
  } else {
    // Fallback for other roles
    return <Dashboard />;
  }
};

// Layout Wrapper Component
const LayoutWrapper = ({ children }) => (
  <>
    <Navbar />
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {children}
    </Container>
  </>
);

function App() {
  return (
    <ErrorBoundary>
      <GlobalLoadingIndicator />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4caf50',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#f44336',
              secondary: '#fff',
            },
          },
        }}
      />
      <div
        className="App"
        style={{
          scrollbarGutter: 'stable',
          overflowY: 'auto',
          minHeight: '100vh',
        }}
      >
        <Routes>
          {/* Default route - show login page */}
          <Route path={ROUTES.HOME} element={<Login />} />

          {/* Auth pages */}
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route path={ROUTES.SIGNUP} element={<SignUp />} />
          <Route path={ROUTES.VERIFY_EMAIL} element={<VerifyEmail />} />
          {/* Reviewer dashboard */}
          <Route
            path={ROUTES.REVIEWER_DASHBOARD}
            element={
              <ProtectedRoute requireRole="reviewer">
                <LayoutWrapper>
                  <ReviewerDashboard />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          {/* Reviewer study analytics - same as researcher */}
          <Route
            path="/reviewer/studies/:id"
            element={
              <ProtectedRoute requireRole="reviewer">
                <LayoutWrapper>
                  <ResearcherStudyDetails />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />

          <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
          <Route path={ROUTES.CHANGE_PASSWORD} element={<ChangePassword />} />
          
          {/* Public enrollment page without navbar */}
          <Route path={ROUTES.ENROLL} element={<EnrollmentPage />} />

          {/* Researcher pages with navbar */}
          <Route
            path={ROUTES.DASHBOARD}
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <DashboardRouter />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/researcher/studies/:id"
            element={
              <ProtectedRoute requireRole="researcher|admin">
                <LayoutWrapper>
                  <ResearcherStudyDetails />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/studies/:id"
            element={
              <ProtectedRoute requireRole="admin">
                <LayoutWrapper>
                  <ResearcherStudyDetails />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/researcher/studies/:id/quiz-results"
            element={
              <ProtectedRoute requireRole="researcher|admin">
                <LayoutWrapper>
                  <ResearcherQuizResults />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          {/* Home route removed */}
          <Route
            path={ROUTES.STUDIES}
            element={
              <ProtectedRoute requireRole="researcher">
                <LayoutWrapper>
                  <Studies />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.STUDIES_CREATE}
            element={
              <ProtectedRoute requireRole="researcher">
                <LayoutWrapper>
                  <CreateStudy />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.STUDIES_EDIT}
            element={
              <ProtectedRoute requireRole="researcher">
                <LayoutWrapper>
                  <CreateStudy />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.STUDIES_DETAIL}
            element={
              <ProtectedRoute requireRole="researcher">
                <LayoutWrapper>
                  <StudyDetailView />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/studies/trash"
            element={
              <ProtectedRoute requireRole="researcher">
                <LayoutWrapper>
                  <StudyTrashBin />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.ARTIFACTS}
            element={
              <ProtectedRoute requireRole="researcher">
                <LayoutWrapper>
                  <Artifacts />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.QUIZZES}
            element={
              <ProtectedRoute requireRole="researcher">
                <LayoutWrapper>
                  <Quizzes />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes/:id/grade"
            element={
              <ProtectedRoute requireRole="researcher">
                <LayoutWrapper>
                  <QuizGradingList />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes/:id/grade/:attemptId"
            element={
              <ProtectedRoute requireRole="researcher">
                <LayoutWrapper>
                  <GradeQuizAttempt />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />

          {/* Participant pages with navbar */}
          <Route
            path={ROUTES.PARTICIPANT_DASHBOARD}
            element={
              <ProtectedRoute requireRole="participant">
                <LayoutWrapper>
                  <ParticipantDashboard />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.PARTICIPANT_STUDIES}
            element={
              <ProtectedRoute requireRole="participant">
                <LayoutWrapper>
                  <ParticipantStudies />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/participant/studies/:id"
            element={
              <ProtectedRoute requireRole="participant|admin">
                <LayoutWrapper>
                  <ParticipantStudyDetails />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/participant/studies/:id/tasks"
            element={
              <ProtectedRoute requireRole="participant">
                <LayoutWrapper>
                  <ParticipantStudyTasks />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/participant/studies/:id/tasks/:taskId"
            element={
              <ProtectedRoute requireRole="participant">
                <LayoutWrapper>
                  <ParticipantTaskEvaluation />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.PARTICIPANT_QUIZZES}
            element={
              <ProtectedRoute requireRole="participant">
                <LayoutWrapper>
                  <ParticipantQuizzes />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/participant/badges"
            element={
              <ProtectedRoute requireRole="participant">
                <LayoutWrapper>
                  <ParticipantBadges />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route 
            path="/participant/studies/completed" 
            element={
              <ProtectedRoute requireRole="participant">
                <LayoutWrapper>
                  <CompletedStudies />
                </LayoutWrapper>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/participant/studies/completed/trash" 
            element={
              <ProtectedRoute requireRole="participant">
                <LayoutWrapper>
                  <CompletedStudiesTrashBin />
                </LayoutWrapper>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/participant/evaluations/trash" 
            element={
              <ProtectedRoute requireRole="participant">
                <LayoutWrapper>
                  <EvaluationTrashBin />
                </LayoutWrapper>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/participant/quizzes/trash" 
            element={
              <ProtectedRoute requireRole="participant">
                <LayoutWrapper>
                  <QuizTrashBin />
                </LayoutWrapper>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/quiz/take/:id" 
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <TakeQuiz />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />

          {/* Admin pages */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireRole="admin">
                <LayoutWrapper>
                  <AdminControls />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/studies/:id"
            element={
              <ProtectedRoute requireRole="admin">
                <LayoutWrapper>
                  <AdminStudyDetails />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />

          {/* Common pages (accessible by all authenticated users) */}
          <Route
            path={ROUTES.PROFILE}
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <Profile />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />

          {/* Catch-all route - redirect to login */}
          <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}

export default App;
