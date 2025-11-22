// LoginScreen.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { MaterialCommunityIcons, AntDesign } from '@/utils/vector-icons-helper';
import { useNavigationLogger } from '@services/logging';
import { ProgressBar } from '@/presentation/components';
import { BottomBar } from '@/ui/BottomBar';

import Dna from '@assets/dna.svg';
import Logo from '@assets/lampinpuntologo.svg';

const GOLD = '#b8860b';
const GOLD_BG = '#fcf5e6';
const GRAY_BG = '#f3f4f6';
const TEXT = '#1f2937';
const MUTED = '#6b7280';

// Componente do Logo do Google (G multicolorido oficial)
const GoogleLogo: React.FC<{ size?: number }> = ({ size = 20 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G>
        <Path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <Path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <Path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <Path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </G>
    </Svg>
  );
};

interface Props {
  onLoginPhone: () => Promise<void> | void;
  onLoginGoogle: () => Promise<void> | void;
  onRegister: () => void;
  onAccessAdminPanel: () => void;
  onNavigateToHome?: () => void;
}

export const LoginScreenWip: React.FC<Props> = ({
  onLoginPhone,
  onLoginGoogle,
  onRegister,
  onAccessAdminPanel,
  onNavigateToHome,
}) => {
  const [secretClicks, setSecretClicks] = useState<number>(0);
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const { width } = Dimensions.get('window');

  const { logUserAction } = useNavigationLogger({
    screenName: 'LoginScreenWip',
    additionalContext: {
      hasPhoneLogin: !!onLoginPhone,
      hasGoogleLogin: !!onLoginGoogle,
    },
  });

  const handleSecretClick = () => {
    const currentTime = Date.now();

    // Reset se passou muito tempo desde o último clique (mais de 3 segundos)
    if (currentTime - lastClickTime > 3000) {
      setSecretClicks(1);
      setLastClickTime(currentTime);
      logUserAction('secret_click_reset', { clickNumber: 1 });
      return;
    }

    const newClickCount = secretClicks + 1;
    setSecretClicks(newClickCount);
    setLastClickTime(currentTime);

    logUserAction('secret_click', {
      clickNumber: newClickCount,
      totalNeeded: 5,
    });

    // Se chegou a 5 cliques, ativa o painel administrativo
    if (newClickCount >= 5) {
      logUserAction('admin_panel_activated', {
        action: 'secret_sequence_completed',
      });
      setSecretClicks(0);
      onAccessAdminPanel();
    }
  };

  const handlePhone = () => {
    logUserAction('login_phone_navigate', { method: 'phone' });
    onLoginPhone?.();
  };

  const handleGoogle = () => {
    logUserAction('login_google_navigate', { method: 'google' });
    // Navegar para a tela de login com Google
    onLoginGoogle?.();
  };

  const handleRegister = () => {
    logUserAction('register_clicked', { method: 'register' });
    onRegister();
  };

  const handleNavigateToHome = () => {
    logUserAction('navigate_to_home', { method: 'direct_navigation' });
    onNavigateToHome?.();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.container}>
        {/* ==== HEADER com DNA + LOGO (SVGs) ==== */}
        <View style={styles.header}>
          {/* DNA como ornamento superior */}
          <View style={styles.dnaWrap} pointerEvents="none">
            <Dna
              width={width * 2.3}
              height={width * 1.3}
            />
          </View>

          {/* Logo central */}
          <View style={styles.logoWrap}>
            <Logo width={180} height={180} />
          </View>
        </View>

        {/* ==== AÇÕES ==== */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.phoneBtn}
            activeOpacity={0.85}
            onPress={handlePhone}
            accessibilityRole="button"
            accessibilityLabel="Login com telefone"
          >
            <View style={styles.btnLeftIcon}>
              <MaterialCommunityIcons name="phone" size={22} color={GOLD} />
            </View>
            <Text style={styles.phoneText}>Login com telefone</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.googleBtn}
            activeOpacity={0.85}
            onPress={handleGoogle}
            accessibilityRole="button"
            accessibilityLabel="Login com Google"
          >
            <View style={styles.btnLeftIcon}>
              <GoogleLogo size={20} />
            </View>
            <Text style={styles.googleText}>Login com Google</Text>
          </TouchableOpacity>

          {onNavigateToHome && (
            <TouchableOpacity
              style={styles.homeBtn}
              activeOpacity={0.85}
              onPress={handleNavigateToHome}
              accessibilityRole="button"
              accessibilityLabel="Ir para Home"
            >
              <View style={styles.btnLeftIcon}>
                <MaterialCommunityIcons name="home" size={22} color={GOLD} />
              </View>
              <Text style={styles.homeText}>Ir para Home</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ==== RODAPÉ ==== */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Não tem uma conta?{' '}
            <Text style={styles.footerLink} onPress={handleRegister}>
              Cadastre-se.
            </Text>
          </Text>

          {/* Barra decorativa (igual ao mockup) */}
          <ProgressBar />
        </View>

        {/* Barra inferior dourada fixa */}
        <BottomBar fixed={true} />

        {/* ==== ÁREA SECRETA (invisível) ==== */}
        <TouchableOpacity
          style={styles.secretArea}
          onPress={handleSecretClick}
          activeOpacity={1}
        >
          {/* Área invisível para cliques secretos */}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

/* ===================== styles ===================== */
const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    justifyContent: 'space-between',
  },

  /* HEADER */
  header: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 0,
    paddingTop: 0,
  },
  dnaWrap: {
    position: 'absolute',
    top: -20, // Ajuste para subir mais o DNA
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    marginTop: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* AÇÕES */
  actions: { gap: 16, marginTop: 48 },
  phoneBtn: {
    backgroundColor: GOLD_BG,
    borderRadius: 28,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  googleBtn: {
    backgroundColor: GRAY_BG,
    borderRadius: 28,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  btnLeftIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginRight: 12,
  },
  phoneText: { color: GOLD, fontSize: 16, fontWeight: '700' },
  googleText: { color: TEXT, fontSize: 16, fontWeight: '600' },
  homeBtn: {
    backgroundColor: GOLD_BG,
    borderRadius: 28,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: GOLD,
    borderStyle: 'dashed',
  },
  homeText: { color: GOLD, fontSize: 16, fontWeight: '700' },

  /* RODAPÉ */
  footer: { alignItems: 'center', marginBottom: 50 },
  footerText: { color: MUTED, fontSize: 15, marginTop: 12 },
  footerLink: { color: GOLD, fontWeight: '700' },

  /* Barra decorativa */
  progressTrack: {
    width: '70%',
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginTop: 16,
  },
  progressThumb: {
    width: '25%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },

  /* ÁREA SECRETA */
  secretArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: 60,
    // Invisível mas clicável
    backgroundColor: 'transparent',
  },
});
