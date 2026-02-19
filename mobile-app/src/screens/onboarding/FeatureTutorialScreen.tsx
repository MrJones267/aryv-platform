/**
 * @fileoverview Feature tutorial screen for onboarding users
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch } from 'react-redux';
import { Button } from '../../components/ui';
import { colors } from '../../theme';
import { setOnboarded } from '../../store/slices/appSlice';

const { width } = Dimensions.get('window');

interface FeatureTutorialScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
  route: {
    params?: {
      userRole?: 'passenger' | 'driver' | 'courier';
      skipToFeatures?: boolean;
    };
  };
}

interface TutorialSlide {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
}

const passengerFeatures: TutorialSlide[] = [
  {
    id: '1',
    icon: 'search',
    title: 'Find Rides Easily',
    description: 'Search for rides to your destination and find verified drivers heading your way.',
    color: '#2196F3',
  },
  {
    id: '2',
    icon: 'security',
    title: 'Safe & Secure',
    description: 'Track your journey in real-time and share your trip details with trusted contacts.',
    color: '#4CAF50',
  },
  {
    id: '3',
    icon: 'payments',
    title: 'Flexible Payments',
    description: 'Pay with cash or digital wallet. Choose the method that works best for you.',
    color: '#FF9800',
  },
  {
    id: '4',
    icon: 'star',
    title: 'Rate & Review',
    description: 'Help the community by rating your drivers and leaving reviews after each trip.',
    color: '#9C27B0',
  },
];

const driverFeatures: TutorialSlide[] = [
  {
    id: '1',
    icon: 'directions-car',
    title: 'Share Your Journey',
    description: 'Post your trips and fill empty seats while earning extra income.',
    color: '#2196F3',
  },
  {
    id: '2',
    icon: 'people',
    title: 'Build Your Network',
    description: 'Connect with passengers heading your way and build a community of regular riders.',
    color: '#4CAF50',
  },
  {
    id: '3',
    icon: 'attach-money',
    title: 'Fair Earnings',
    description: 'Set your own prices or use AI-powered pricing to maximize your earnings.',
    color: '#FF9800',
  },
  {
    id: '4',
    icon: 'verified-user',
    title: 'Verified Status',
    description: 'Complete verification to gain trust and attract more passengers.',
    color: '#9C27B0',
  },
];

const courierFeatures: TutorialSlide[] = [
  {
    id: '1',
    icon: 'local-shipping',
    title: 'Deliver Packages',
    description: 'Pick up and deliver packages along your route and earn extra money.',
    color: '#2196F3',
  },
  {
    id: '2',
    icon: 'qr-code-scanner',
    title: 'QR Code Tracking',
    description: 'Scan QR codes for secure package handoffs and real-time tracking.',
    color: '#4CAF50',
  },
  {
    id: '3',
    icon: 'verified',
    title: 'Blockchain Verified',
    description: 'Each delivery is recorded on the blockchain for transparency and trust.',
    color: '#FF9800',
  },
  {
    id: '4',
    icon: 'trending-up',
    title: 'Grow Your Business',
    description: 'Build your reputation with ratings and become a top-rated courier.',
    color: '#9C27B0',
  },
];

const FeatureTutorialScreen: React.FC<FeatureTutorialScreenProps> = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const userRole = route.params?.userRole || 'passenger';
  const [currentIndex, setCurrentIndex] = useState(0);

  const getFeatures = (): TutorialSlide[] => {
    switch (userRole) {
      case 'driver':
        return driverFeatures;
      case 'courier':
        return courierFeatures;
      default:
        return passengerFeatures;
    }
  };

  const features = getFeatures();
  const isLastSlide = currentIndex === features.length - 1;

  const handleNext = (): void => {
    if (isLastSlide) {
      handleFinish();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleSkip = (): void => {
    handleFinish();
  };

  const handleFinish = (): void => {
    dispatch(setOnboarded(true));
  };

  const renderDots = (): React.ReactNode => (
    <View style={styles.dotsContainer}>
      {features.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === currentIndex && styles.dotActive,
            { backgroundColor: index === currentIndex ? features[currentIndex].color : colors.border.medium },
          ]}
        />
      ))}
    </View>
  );

  const currentFeature = features[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: currentFeature.color + '20' }]}>
          <Icon name={currentFeature.icon} size={80} color={currentFeature.color} />
        </View>

        <Text style={styles.title}>{currentFeature.title}</Text>
        <Text style={styles.description}>{currentFeature.description}</Text>

        {renderDots()}
      </View>

      <View style={styles.footer}>
        <Button
          title={isLastSlide ? 'Get Started' : 'Next'}
          onPress={handleNext}
          variant="primary"
          size="large"
          icon={isLastSlide ? 'check' : 'arrow-forward'}
          iconPosition="right"
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
});

export default FeatureTutorialScreen;
