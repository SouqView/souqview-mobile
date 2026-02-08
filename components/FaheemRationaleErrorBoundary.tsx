/**
 * Error boundary for the "Faheem's Rationale" component.
 * When the Faheem API is down or throws, shows "Reconnecting..." instead of a technical error.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
}

export class FaheemRationaleErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) {
      console.warn('[FaheemRationaleErrorBoundary]', error.message, errorInfo.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <FaheemReconnectingView onRetry={this.handleRetry} />
      );
    }
    return this.props.children;
  }
}

function FaheemReconnectingView({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        Reconnecting…
      </Text>
      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        Faheem is temporarily unavailable. Tap to try again.
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.electricBlue }]}
        onPress={onRetry}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
});
