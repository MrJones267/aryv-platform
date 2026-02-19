/**
 * @fileoverview Onboarding welcome screen introducing the app
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../components/ui';

const { width, height } = Dimensions.get('window');

interface OnboardingWelcomeScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

const OnboardingWelcomeScreen: React.FC<OnboardingWelcomeScreenProps> = ({ navigation }) => {
  const handleGetStarted = () => {
    navigation.navigate('RoleSelection');
  };

  const handleSkip = () => {
    navigation.navigate('Main');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Icon name="directions-car" size={48} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.appName}>ARYV</Text>
          <Text style={styles.tagline}>Your Smart Ride-Sharing Companion</Text>
        </View>

        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          <View style={styles.illustration}>
            <Icon name="people" size={80} color="#2196F3" />
            <Icon name="directions-car" size={60} color="#4CAF50" style={styles.carIcon} />
          </View>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Icon name="search" size={24} color="#2196F3" />
            </View>
            <Text style={styles.featureTitle}>Find Rides</Text>
            <Text style={styles.featureDescription}>
              Discover rides to your destination with verified drivers
            </Text>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Icon name="share" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.featureTitle}>Share Your Journey</Text>
            <Text style={styles.featureDescription}>
              Offer rides to fellow travelers and earn while you drive
            </Text>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Icon name="security" size={24} color="#FF9800" />
            </View>
            <Text style={styles.featureTitle}>Safe & Secure</Text>
            <Text style={styles.featureDescription}>
              Real-time tracking and verified users for your peace of mind
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            variant="primary"
            size="large"
            icon="arrow-forward"
            iconPosition="right"
            fullWidth
            style={styles.getStartedButton}
          />
          
          <Button
            title="Skip for now"
            onPress={handleSkip}
            variant="ghost"
            size="medium"
            style={styles.skipButton}
          />
        </View>
      </View>

      {/* Background decoration */}
      <View style={styles.backgroundDecoration}>
        <View style={[styles.decorationCircle, styles.circle1]} />
        <View style={[styles.decorationCircle, styles.circle2]} />
        <View style={[styles.decorationCircle, styles.circle3]} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  illustration: {
    position: 'relative',
    alignItems: 'center',
  },
  carIcon: {
    position: 'absolute',
    top: 20,
    right: -20,
  },
  features: {
    gap: 32,
    paddingHorizontal: 8,
  },
  feature: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    paddingVertical: 24,
    gap: 16,
  },
  getStartedButton: {
    marginBottom: 8,
  },
  skipButton: {
    alignSelf: 'center',
  },
  backgroundDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  decorationCircle: {
    position: 'absolute',
    borderRadius: 100,
    opacity: 0.05,
  },
  circle1: {
    width: 200,
    height: 200,
    backgroundColor: '#2196F3',
    top: -50,
    right: -50,
  },
  circle2: {
    width: 150,
    height: 150,
    backgroundColor: '#4CAF50',
    bottom: height * 0.3,
    left: -30,
  },
  circle3: {
    width: 120,
    height: 120,
    backgroundColor: '#FF9800',
    bottom: 100,
    right: width * 0.2,
  },
});

export default OnboardingWelcomeScreen;