import React from 'react';
import { Box, Container } from '@mui/material';

// Import atomic components
import { 
  HeroSection, 
  FeaturesSection, 
  BenefitsSection, 
  UseCasesSection, 
  CTASection 
} from '../components';

// Import styles
import '../styles/globals.css';
import '../styles/components.css';

const Home = () => {
  return (
    <Box>
      <HeroSection />
      <Container maxWidth="lg">
        <FeaturesSection />
        <BenefitsSection />
        <UseCasesSection />
        <CTASection />
      </Container>
    </Box>
  );
};

export default Home;