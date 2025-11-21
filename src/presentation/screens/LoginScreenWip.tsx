// LoginScreen.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
// Import de ícones usando helper centralizado
import { MaterialCommunityIcons, AntDesign } from '@/utils/vector-icons-helper';
import { useNavigationLogger } from '@services/logging';
import { ProgressBar } from '@/presentation/components';
import { BottomBar } from '@/ui/BottomBar';

// ✅ IMPORTS dos SVGs (requer react-native-svg + transformer configurados)
import Dna from '@assets/dna.svg';
import Logo from '@assets/lampinpuntologo.svg';

const GOLD = '#b8860b';
const GOLD_BG = '#fcf5e6';
const GRAY_BG = '#f3f4f6';
const TEXT = '#1f2937';
const MUTED = '#6b7280';

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
      <View style={styles.container}>
        {/* ==== HEADER com DNA + LOGO (SVGs) ==== */}
        <View style={styles.header}>
          {/* DNA como ornamento superior (levemente maior que a largura para "sair" das bordas) */}
          <View style={styles.dnaWrap} pointerEvents="none">
            <Dna
              width={width * 2.3}
              height={width * 1.3}
              // Ajuste o viewBox do seu dna.svg se precisar de melhor enquadramento
              // preserveAspectRatio="xMidYMid meet"
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
              <AntDesign name="google" size={20} color="#DB4437" />
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
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    justifyContent: 'space-between',
  },

  /* HEADER */
  header: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  dnaWrap: {
    position: 'absolute',
    top: 0,
    // centraliza a ilustração acima; width dinâmica pelo prop no componente
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    // Empurra o logo alguns px pra baixo para não colar no DNA
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
