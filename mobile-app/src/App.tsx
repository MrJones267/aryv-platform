/**
 * @fileoverview Main App component for ARYV mobile application
 * @author Oabona-Majoko
 * @created 2025-01-26
 * @lastModified 2025-01-25
 */

import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { theme } from './theme';
import AppNavigator from './navigation/AppNavigator';
import LoadingScreen from './components/common/LoadingScreen';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { initializeAuth } from './store/slices/authSlice';
import SocketService from './services/SocketService';
import { CallIntegrationService } from './services/CallIntegrationService';
import authService from './services/AuthService';

// Internal App component with Redux access
const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isLoading, isAuthenticated, accessToken, refreshToken } = useAppSelector((state) => state.auth);
  const { profile: user } = useAppSelector((state) => state.user);
  const navigationRef = useRef<any>(null);
  
  // Debug auth state
  console.log('App: Auth state - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  useEffect(() => {
    console.log('App: Starting auth initialization...');
    
    // Safety timeout to prevent infinite loading
    const authTimeout = setTimeout(() => {
      console.log('App: Auth initialization timeout - forcing completion');
      dispatch({ type: 'auth/initializeAuth/rejected', payload: 'Timeout' });
    }, 5000);
    
    dispatch(initializeAuth())
      .then(() => {
        console.log('App: Auth initialization completed successfully');
        clearTimeout(authTimeout);
      })
      .catch((error) => {
        console.log('App: Auth initialization failed:', error);
        clearTimeout(authTimeout);
      });
      
    return () => clearTimeout(authTimeout);
  }, [dispatch]);

  // Sync AuthService with Redux auth state changes
  useEffect(() => {
    if (isAuthenticated && accessToken && refreshToken) {
      console.log('App: Syncing AuthService with Redux auth state');
      // Map Redux user to AuthService user format
      const authUser = user ? {
        ...user,
        userType: user.role === 'courier' ? 'courier' as const : 'user' as const,
        profileImage: user.profilePicture
      } : null;
      authService.syncWithReduxState(accessToken, refreshToken, authUser);
    }
  }, [isAuthenticated, accessToken, refreshToken, user]);

  // Initialize socket services after authentication
  useEffect(() => {
    let socketService: SocketService | null = null;
    let callIntegrationService: CallIntegrationService | null = null;

    const initializeServices = async () => {
      if (isAuthenticated && navigationRef.current) {
        try {
          console.log('Initializing real-time services...');
          
          // Initialize SocketService
          socketService = SocketService.getInstance();
          await socketService.connect();
          console.log('SocketService connected successfully');
          
          // Initialize CallIntegrationService
          callIntegrationService = CallIntegrationService.getInstance();
          await callIntegrationService.initialize(navigationRef.current);
          console.log('CallIntegrationService initialized successfully');
          
        } catch (error) {
          console.warn('Failed to initialize real-time services:', error);
          // App should still work without real-time features
        }
      }
    };

    const cleanupServices = () => {
      if (socketService) {
        socketService.disconnect();
      }
      if (callIntegrationService) {
        callIntegrationService.destroy();
      }
    };

    if (isAuthenticated) {
      initializeServices();
    } else {
      cleanupServices();
    }

    return cleanupServices;
  }, [isAuthenticated]);

  // Temporary fix: Don't show loading screen indefinitely
  // if (isLoading) {
  //   return <LoadingScreen />;
  // }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
      </NavigationContainer>
    </>
  );
};

// Main App component with providers
const App: React.FC = () => {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={<LoadingScreen />} persistor={persistor}>
        <PaperProvider theme={theme}>
          <AppContent />
        </PaperProvider>
      </PersistGate>
    </ReduxProvider>
  );
};

export default App;