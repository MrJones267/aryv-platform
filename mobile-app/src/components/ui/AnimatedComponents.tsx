/**
 * @fileoverview Reusable animated wrapper components for smooth UI transitions
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ViewStyle,
  StyleProp,
} from 'react-native';

// ─── FadeIn: Fades + slides content from bottom ─────────────────────

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  slideDistance?: number;
  style?: StyleProp<ViewStyle>;
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 400,
  slideDistance = 16,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

// ─── ScaleIn: Scales content from small to full size ────────────────

interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export const ScaleIn: React.FC<ScaleInProps> = ({
  children,
  delay = 0,
  duration = 300,
  style,
}) => {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        delay,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
};

// ─── SlideIn: Slides from left or right ─────────────────────────────

interface SlideInProps {
  children: React.ReactNode;
  direction?: 'left' | 'right';
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

export const SlideIn: React.FC<SlideInProps> = ({
  children,
  direction = 'left',
  delay = 0,
  duration = 350,
  distance = 30,
  style,
}) => {
  const startX = direction === 'left' ? -distance : distance;
  const translateX = useRef(new Animated.Value(startX)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        tension: 60,
        friction: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateX }] }, style]}>
      {children}
    </Animated.View>
  );
};

// ─── StaggeredList: Renders children with staggered fade-in ─────────

interface StaggeredListProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  itemDuration?: number;
  style?: StyleProp<ViewStyle>;
}

export const StaggeredList: React.FC<StaggeredListProps> = ({
  children,
  staggerDelay = 80,
  itemDuration = 350,
  style,
}) => {
  return (
    <Animated.View style={style}>
      {React.Children.map(children, (child, index) => (
        <FadeIn delay={index * staggerDelay} duration={itemDuration}>
          {child}
        </FadeIn>
      ))}
    </Animated.View>
  );
};

// ─── PulseView: Continuously pulsing view (for attention) ───────────

interface PulseViewProps {
  children: React.ReactNode;
  minScale?: number;
  maxScale?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export const PulseView: React.FC<PulseViewProps> = ({
  children,
  minScale = 0.97,
  maxScale = 1.03,
  duration = 1500,
  style,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: maxScale,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: minScale,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
};
