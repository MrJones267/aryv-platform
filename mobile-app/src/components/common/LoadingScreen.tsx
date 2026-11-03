/**
 * @fileoverview Loading screen component
 * @author Oabona-Majoko
 * @created 2025-01-27
 */

import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { colors } from '../../theme';

const ARYV_MARK = require('../../assets/images/aryv-mark.png');

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...' 
}) => {
  return (
    <View style={styles.container}>
      {/* Carries on from the splash, which shows the same arrow. */}
      <Image source={ARYV_MARK} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 32,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text.secondary,
  },
});

export default LoadingScreen;