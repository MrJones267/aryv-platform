/**
 * @fileoverview Role selection screen for onboarding
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
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../components/ui';
import { colors } from '../../theme';
import { useAppDispatch } from '../../store/hooks';
import { setOnboardingUserRole } from '../../store/slices/appSlice';

const { width } = Dimensions.get('window');

interface RoleSelectionScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

interface Role {
  id: 'passenger' | 'driver' | 'courier';
  title: string;
  description: string;
  icon: string;
  color: string;
}

const roles: Role[] = [
  {
    id: 'passenger',
    title: 'Passenger',
    description: 'Find and book rides to your destination',
    icon: 'person',
    color: '#2196F3',
  },
  {
    id: 'driver',
    title: 'Driver',
    description: 'Share your journey and earn money',
    icon: 'directions-car',
    color: '#4CAF50',
  },
  {
    id: 'courier',
    title: 'Courier',
    description: 'Deliver packages along your route',
    icon: 'local-shipping',
    color: '#FF9800',
  },
];

const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const [selectedRole, setSelectedRole] = useState<Role['id'] | null>(null);

  const handleContinue = (): void => {
    if (selectedRole) {
      dispatch(setOnboardingUserRole(selectedRole));
      navigation.navigate('OnboardingPermissions', { selectedRole });
    }
  };

  const renderRole = (role: Role): React.ReactNode => {
    const isSelected = selectedRole === role.id;

    return (
      <TouchableOpacity
        key={role.id}
        style={[
          styles.roleCard,
          isSelected && styles.roleCardSelected,
          isSelected && { borderColor: role.color },
        ]}
        onPress={() => setSelectedRole(role.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.roleIconContainer, { backgroundColor: role.color + '20' }]}>
          <Icon name={role.icon} size={32} color={role.color} />
        </View>
        <View style={styles.roleContent}>
          <Text style={styles.roleTitle}>{role.title}</Text>
          <Text style={styles.roleDescription}>{role.description}</Text>
        </View>
        <View style={[styles.radioOuter, isSelected && { borderColor: role.color }]}>
          {isSelected && <View style={[styles.radioInner, { backgroundColor: role.color }]} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>How will you use ARYV?</Text>
        <Text style={styles.subtitle}>
          Choose your primary role. You can always switch or use multiple roles later.
        </Text>

        <View style={styles.rolesContainer}>
          {roles.map(renderRole)}
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleContinue}
          variant="primary"
          size="large"
          disabled={!selectedRole}
          icon="arrow-forward"
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
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 24,
    marginBottom: 32,
  },
  rolesContainer: {
    gap: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleCardSelected: {
    backgroundColor: colors.background.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  roleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  roleContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
});

export default RoleSelectionScreen;
