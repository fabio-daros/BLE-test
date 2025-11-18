// src/presentation/screens/PhoneVerificationScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AntDesign } from '@/utils/vector-icons-helper';
import { COLORS, SP } from '@/ui/tokens';
import { BottomBar } from '@/ui/BottomBar';
import { ProgressBar } from '@/presentation/components';
import DnaHeader from '@/ui/DnaHeader';
import { phoneAuthService, authService } from '@services/auth';
import { logger } from '@services/logging';
import { getFirebaseAuth } from '@services/auth';

interface Props {
  phoneNumber: string;
  verificationId?: string;
  onBack: () => void;
  onVerificationSuccess: (user: any) => void;
  onResendCode?: () => void;
  isFromSignup?: boolean; // Indica se vem do cadastro (usuário já autenticado)
}

export const PhoneVerificationScreen: React.FC<Props> = ({
  phoneNumber,
  verificationId,
  onBack,
  onVerificationSuccess,
  onResendCode,
  isFromSignup = false,
}) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Iniciar countdown para reenvio
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [countdown]);

  const handleCodeChange = (value: string, index: number) => {
    // Aceitar apenas números
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length > 1) {
      // Se colar múltiplos dígitos, distribuir pelos campos
      const digits = numericValue.slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      // Focar no último campo preenchido ou próximo vazio
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      const newCode = [...code];
      newCode[index] = numericValue;
      setCode(newCode);

      // Avançar para próximo campo se digitou
      if (numericValue && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Voltar para campo anterior ao apagar
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const codeString = code.join('');
    if (codeString.length !== 6) {
      Alert.alert('Erro', 'Por favor, digite o código completo de 6 dígitos');
      return;
    }

    try {
      setLoading(true);
      logger.info(
        'Verificando código SMS',
        { phoneNumber, isFromSignup },
        'auth'
      );

      if (!verificationId) {
        throw new Error('ID de verificação não encontrado');
      }

      let user;

      if (isFromSignup) {
        // Se vem do cadastro, usuário já está autenticado
        // Vincular telefone à conta existente
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
          throw new Error('Usuário não autenticado');
        }

        logger.info(
          'Vinculando telefone à conta após cadastro',
          { uid: currentUser.uid, phone: phoneNumber },
          'auth'
        );

        // Vincular telefone usando linkPhoneNumber
        await authService.linkPhoneNumber(verificationId, codeString);

        // Obter usuário atualizado
        user = authService.convertFirebaseUser(currentUser);

        logger.info(
          'Telefone vinculado com sucesso',
          { uid: user.uid },
          'auth'
        );
      } else {
        // Login normal com telefone
        user = await phoneAuthService.verifyCode(verificationId, codeString);
        logger.info('Código verificado com sucesso', { uid: user.uid }, 'auth');
      }

      onVerificationSuccess(user);
    } catch (error: any) {
      logger.info('Erro ao verificar código', { error: error.message }, 'auth');
      Alert.alert('Erro', error.message || 'Código inválido. Tente novamente.');
      // Limpar código em caso de erro
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0 || resendLoading) return;

    try {
      setResendLoading(true);
      logger.info('Reenviando código SMS', { phoneNumber }, 'auth');

      if (onResendCode) {
        await onResendCode();
      } else {
        // Reenviar código
        await phoneAuthService.sendVerificationCode(phoneNumber);
      }

      setCountdown(60);
      Alert.alert('Sucesso', 'Código reenviado com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao reenviar código', { error: error.message }, 'auth');
      Alert.alert(
        'Erro',
        error.message || 'Erro ao reenviar código. Tente novamente.'
      );
    } finally {
      setResendLoading(false);
    }
  };

  const maskedPhone = phoneNumber.replace(
    /(\d{2})(\d{4,5})(\d{4})/,
    '($1) $2-$3'
  );

  return (
    <SafeAreaView style={styles.safe}>
      <DnaHeader />

      <View style={styles.container}>
        {/* Botão Voltar */}
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <AntDesign name="arrowleft" size={25} color={COLORS.gold} />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>

        {/* Título */}
        <Text style={styles.title}>Verificação de Telefone</Text>
        <Text style={styles.subtitle}>
          Digite o código de 6 dígitos enviado para{'\n'}
          <Text style={styles.phoneNumber}>{maskedPhone}</Text>
        </Text>

        {/* Campos de código */}
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => { inputRefs.current[index] = ref; }}
              style={[styles.codeInput, digit && styles.codeInputFilled]}
              value={digit}
              onChangeText={value => handleCodeChange(value, index)}
              onKeyPress={e => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={index === 0}
            />
          ))}
        </View>

        {/* Botão Verificar */}
        <TouchableOpacity
          style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={loading || code.join('').length !== 6}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.verifyText}>Verificar</Text>
          )}
        </TouchableOpacity>

        {/* Reenviar código */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Não recebeu o código?</Text>
          <TouchableOpacity
            onPress={handleResendCode}
            disabled={countdown > 0 || resendLoading}
            style={styles.resendBtn}
          >
            {resendLoading ? (
              <ActivityIndicator size="small" color={COLORS.gold} />
            ) : (
              <Text
                style={[
                  styles.resendLink,
                  countdown > 0 && styles.resendLinkDisabled,
                ]}
              >
                {countdown > 0
                  ? `Reenviar em ${countdown}s`
                  : 'Reenviar código'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Barra de progresso */}
        <ProgressBar width="50%" marginTop={SP.sm} />

        {/* Barra inferior */}
        <BottomBar fixed={true} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, paddingHorizontal: SP.lg, paddingTop: SP.sm },

  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: -150,
    marginBottom: 25,
  },
  backText: { color: COLORS.gold, fontSize: 16, fontWeight: '600' },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gold,
    marginTop: 85,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: SP.xl,
  },
  phoneNumber: {
    color: COLORS.text,
    fontWeight: '600',
  },

  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SP.xl,
    marginBottom: SP.xl,
  },
  codeInput: {
    width: 50,
    height: 60,
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  codeInputFilled: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },

  verifyBtn: {
    marginTop: SP.xl,
    height: 52,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
  verifyText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },

  resendContainer: {
    alignItems: 'center',
    marginTop: SP.lg,
  },
  resendText: {
    color: COLORS.muted,
    fontSize: 14,
    marginBottom: 8,
  },
  resendBtn: {
    padding: 8,
  },
  resendLink: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  resendLinkDisabled: {
    color: COLORS.muted,
    fontWeight: '400',
  },
});
