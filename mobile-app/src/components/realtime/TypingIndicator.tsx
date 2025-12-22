/**
 * @fileoverview Typing indicator component for chat screens
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

interface TypingIndicatorProps {
  userNames: string[];
  visible: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  userNames,
  visible,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnims] = useState([
    new Animated.Value(0.5),
    new Animated.Value(0.5),
    new Animated.Value(0.5),
  ]);

  useEffect(() => {
    if (visible) {
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Animate dots
      const animateDots = () => {
        const animations = scaleAnims.map((anim, index) =>
          Animated.sequence([
            Animated.delay(index * 200),
            Animated.loop(
              Animated.sequence([
                Animated.timing(anim, {
                  toValue: 1,
                  duration: 400,
                  useNativeDriver: true,
                }),
                Animated.timing(anim, {
                  toValue: 0.5,
                  duration: 400,
                  useNativeDriver: true,
                }),
              ])
            ),
          ])
        );

        Animated.parallel(animations).start();
      };

      animateDots();
    } else {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Reset dot animations
      scaleAnims.forEach(anim => {
        anim.stopAnimation();
        anim.setValue(0.5);
      });
    }
  }, [visible, fadeAnim, scaleAnims]);

  if (!visible || userNames.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (userNames.length === 1) {
      return `${userNames[0]} is typing`;
    } else if (userNames.length === 2) {
      return `${userNames[0]} and ${userNames[1]} are typing`;
    } else {
      return `${userNames.length} people are typing`;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.text}>{getTypingText()}</Text>
        <View style={styles.dotsContainer}>
          {scaleAnims.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  transform: [{ scale: anim }],
                },
              ]}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#999999',
  },
});

export default TypingIndicator;