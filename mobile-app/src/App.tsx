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
import ErrorBoundary from './components/common/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider } from './i18n/I18nContext';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { initializeAuth } from './store/slices/authSlice';
import SocketService from './services/SocketService';
import { CallIntegrationService } from './services/CallIntegrationService';
import CallService from './services/CallService';
import notificationService from './services/NotificationService';
import authService from './services/AuthService';
import logger from './services/LoggingService';
// Crashlytics service removed for production build

const log = logger.createLogger('App');

// Internal App component with Redux access
const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isLoading, isAuthenticated, accessToken, refreshToken } = useAppSelector((state) => state.auth);
  const { profile: user } = useAppSelector((state) => state.user);
  const navigationRef = useRef<any>(null);
  
  // Debug auth state
  log.info('App: Auth state', { isLoading, isAuthenticated });

  useEffect(() => {
    log.info('App: Starting app initialization...');
    
    // Initialize Crashlytics first - TEMPORARILY DISABLED
    const initializeApp = async () => {
      try {
        // Initialize Crashlytics - DISABLED FOR BUILD
        // await crashlyticsService.initialize();
        log.info('App: Crashlytics disabled for build');
      } catch (error) {
        log.warn('App: Crashlytics initialization failed:', error);
      }
    };
    
    initializeApp();
    
    // Safety timeout to prevent infinite loading
    const authTimeout = setTimeout(() => {
      log.info('App: Auth initialization timeout - forcing completion');
      dispatch({ type: 'auth/initializeAuth/rejected', payload: 'Timeout' });
    }, 5000);
    
    dispatch(initializeAuth())
      .then(() => {
        log.info('App: Auth initialization completed successfully');
        clearTimeout(authTimeout);
      })
      .catch((error) => {
        log.info('App: Auth initialization failed:', error);
        // Record auth initialization errors - DISABLED FOR BUILD
        // crashlyticsService.recordError(
        //   error instanceof Error ? error : new Error(String(error)),
        //   { screen: 'App', action: 'initializeAuth' }
        // );
        clearTimeout(authTimeout);
      });
      
    return () => clearTimeout(authTimeout);
  }, [dispatch]);

  // Sync AuthService with Redux auth state changes
  useEffect(() => {
    if (isAuthenticated && accessToken && refreshToken) {
      log.info('App: Syncing AuthService with Redux auth state');
      // Map Redux user to AuthService user format
      const authUser = user ? {
        ...user,
        userType: user.primaryRole === 'courier' ? 'courier' as const : 'user' as const,
        profileImage: user.profilePicture
      } : null;
      authService.syncWithReduxState(accessToken, refreshToken, authUser);

      // Set user context for Crashlytics - DISABLED FOR BUILD
      // if (user) {
      //   crashlyticsService.setUserContext({
      //     userId: user.id,
      //     userEmail: user.email,
      //     userRole: user.primaryRole || 'user',
      //     appVersion: '1.0.0',
      //   });
      // }
    }
  }, [isAuthenticated, accessToken, refreshToken, user]);

  // Initialize socket services after authentication
  useEffect(() => {
    let socketService: SocketService | null = null;
    let callIntegrationService: CallIntegrationService | null = null;

    const initializeServices = async () => {
      if (isAuthenticated && navigationRef.current) {
        try {
          log.info('Initializing real-time services...');
          
          // Initialize SocketService
          socketService = SocketService.getInstance();
          await socketService.connect();
          log.info('SocketService connected successfully');
          
          // Initialize CallService (WebRTC)
          await CallService.initialize();
          log.info('CallService (WebRTC) initialized successfully');
          
          // Initialize CallIntegrationService
          callIntegrationService = CallIntegrationService.getInstance();
          await callIntegrationService.initialize(navigationRef.current);
          log.info('CallIntegrationService initialized successfully');

          // Initialize Push Notifications
          const notifInitialized = await notificationService.initialize();
          log.info('NotificationService initialized:', notifInitialized);

        } catch (error) {
          log.warn('Failed to initialize real-time services:', error);
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
    <ErrorBoundary>
      <ReduxProvider store={store}>
        <PersistGate loading={<LoadingScreen />} persistor={persistor}>
          <PaperProvider theme={theme}>
            <ThemeProvider>
              <I18nProvider>
                <ToastProvider>
                  <AppContent />
                </ToastProvider>
              </I18nProvider>
            </ThemeProvider>
          </PaperProvider>
        </PersistGate>
      </ReduxProvider>
    </ErrorBoundary>
  );
};

export default App;