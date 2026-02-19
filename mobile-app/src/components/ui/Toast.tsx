/**
 * @fileoverview Toast notification system replacing Alert.alert() across the app
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
});

export const useToast = () => useContext(ToastContext);

// ─── Toast Item Component ────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { icon: string; bg: string; accent: string }> = {
  success: { icon: 'check-circle', bg: '#ECFDF5', accent: '#10B981' },
  error: { icon: 'error', bg: '#FEF2F2', accent: '#EF4444' },
  warning: { icon: 'warning', bg: '#FFFBEB', accent: '#F59E0B' },
  info: { icon: 'info', bg: '#EFF6FF', accent: '#3B82F6' },
};

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = TOAST_CONFIG[toast.type];
  const duration = toast.duration || 3000;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => dismiss(), duration);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -80,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(toast.id));
  };

  return (
    <Animated.View
      style={[
        styles.toastItem,
        { backgroundColor: config.bg, borderLeftColor: config.accent },
        { transform: [{ translateY }], opacity },
      ]}
    >
      <Icon name={config.icon} size={22} color={config.accent} />
      <View style={styles.toastContent}>
        <Text style={[styles.toastTitle, { color: config.accent }]}>{toast.title}</Text>
        {toast.message && (
          <Text style={styles.toastMessage} numberOfLines={2}>{toast.message}</Text>
        )}
      </View>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name="close" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Toast Provider ──────────────────────────────────────────────────

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const insets = useSafeAreaInsets();
  const idCounter = useRef(0);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    const id = `toast-${++idCounter.current}-${Date.now()}`;
    const newToast: ToastMessage = { id, type, title, message, duration };
    setToasts(prev => [...prev.slice(-2), newToast]); // Keep max 3 toasts
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const contextValue: ToastContextType = {
    showToast,
    success: (title, message) => showToast('success', title, message),
    error: (title, message) => showToast('error', title, message),
    warning: (title, message) => showToast('warning', title, message),
    info: (title, message) => showToast('info', title, message),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <View style={[styles.toastContainer, { top: insets.top + 8 }]} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    gap: 10,
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  toastMessage: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
});
