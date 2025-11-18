import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { colors, spacing } from '@presentation/theme';
import { useNavigationLogger } from '@services/logging';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { logNavigation } = useNavigationLogger({
    screenName: 'SplashScreen',
    additionalContext: { duration: '2000ms' },
  });

  useEffect(() => {
    logNavigation('iniciada');

    const timer = setTimeout(() => {
      logNavigation('finalizada', 'login');
      onFinish();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinish, logNavigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>INpunto</Text>
        <Text style={styles.subtitle}>Sistema de Testes</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>v1.0.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.3,
    height: width * 0.3,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  version: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
