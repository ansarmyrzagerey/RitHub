// Layout components
export { default as Navbar } from './layout/Navbar';

// UI components
export { default as LoadingSpinner } from './ui/LoadingSpinner';
export { default as ErrorBoundary } from './ui/ErrorBoundary';
export { default as Breadcrumb } from './ui/Breadcrumb';

// Home page components
export { default as HeroSection } from './home/HeroSection';
export { default as FeaturesSection } from './home/FeaturesSection';
export { default as BenefitsSection } from './home/BenefitsSection';
export { default as UseCasesSection } from './home/UseCasesSection';
export { default as CTASection } from './home/CTASection';

// Dashboard components
export { default as StatsCards } from './dashboard/StatsCards';
export { default as RecentStudies } from './dashboard/RecentStudies';
export { default as QuickActions } from './dashboard/QuickActions';
export { default as RecentActivity } from './dashboard/RecentActivity';

// Auth components
export { default as LoginHeader } from './auth/LoginHeader';
export { default as SignUpHeader } from './auth/SignUpHeader';
export { default as LoginForm } from './auth/LoginForm';
export { default as SignUpForm } from './auth/SignUpForm';
export { default as PersonalInfoSection } from './auth/PersonalInfoSection';
export { default as AccountInfoSection } from './auth/AccountInfoSection';
export { default as PasswordStrengthIndicator } from './auth/PasswordStrengthIndicator';
export { default as TermsAndConditions } from './auth/TermsAndConditions';
export { default as AuthTransition } from './auth/AuthTransition';
export { default as LoginFooter } from './auth/LoginFooter';

// Artifact components
export { default as UploadForm } from './artifacts/UploadForm';
export { default as ArtifactList } from './artifacts/ArtifactList';
export { default as EditForm } from './artifacts/EditForm';
export { default as ArtifactDetails } from './artifacts/ArtifactDetails';
export { default as ExportDialog } from './artifacts/ExportDialog';
export { default as BulkImportDialog } from './artifacts/BulkImportDialog';

// Participant components
export * from './participant';