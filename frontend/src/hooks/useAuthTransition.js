import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';

const useAuthTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTo, setTransitionTo] = useState(null);
  const navigate = useNavigate();

  const startTransition = useCallback((route) => {
    setIsTransitioning(true);
    setTransitionTo(route);
    
    // Navigate after transition starts
    setTimeout(() => {
      navigate(route);
    }, 100);
  }, [navigate]);

  const completeTransition = useCallback(() => {
    setIsTransitioning(false);
    setTransitionTo(null);
  }, []);

  const navigateToSignUp = useCallback(() => {
    startTransition(ROUTES.SIGNUP);
  }, [startTransition]);

  const navigateToLogin = useCallback(() => {
    startTransition(ROUTES.LOGIN);
  }, [startTransition]);

  return {
    isTransitioning,
    transitionTo,
    navigateToSignUp,
    navigateToLogin,
    completeTransition,
  };
};

export default useAuthTransition;
