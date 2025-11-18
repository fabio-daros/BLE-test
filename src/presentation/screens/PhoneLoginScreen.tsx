// src/presentation/screens/PhoneLoginScreen.tsx
import React, { useState } from 'react';
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
// Import de ícones usando helper centralizado
import { AntDesign } from '@/utils/vector-icons-helper';
import { COLORS, SP } from '@/ui/tokens';
import { colors } from '@presentation/theme';
import { BottomBar } from '@/ui/BottomBar';
import { ProgressBar } from '@/presentation/components';
import DnaHeader from '@/ui/DnaHeader';
import { phoneAuthService } from '@services/auth';
import { logger } from '@services/logging';

interface Props {
  onBack: () => void;
  onCodeSent: (phoneNumber: string, verificationId: string) => void;
}

export const PhoneLoginScreen: React.FC<Props> = ({ onBack, onCodeSent }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      setError('Por favor, digite seu número de telefone');
      return;
    }

    // Validar formato básico
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('Número de telefone inválido');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      logger.info('Solicitando código SMS', { phoneNumber }, 'auth');

      // Formatar número de telefone
      const formattedPhone = phoneAuthService.formatPhoneNumber(phoneNumber);

      // Enviar código de verificação
      // Nota: Em produção, você precisará configurar o RecaptchaVerifier
      // Por enquanto, vamos usar uma abordagem que mostra uma mensagem informativa
      const verificationId =
        await phoneAuthService.sendVerificationCode(formattedPhone);

      logger.info(
        'Código SMS enviado',
        { phoneNumber: formattedPhone },
        'auth'
      );

      onCodeSent(formattedPhone, verificationId);
    } catch (error: any) {
      logger.info(
        'Erro ao enviar código SMS',
        { error: error.message },
        'auth'
      );
      const errorMessage =
        error.message || 'Erro ao enviar código. Tente novamente.';
      setError(errorMessage);
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
        <Text style={styles.title}>Login com Telefone</Text>
        <Text style={styles.subtitle}>
          Digite seu número de telefone para receber um código de verificação
          por SMS
        </Text>

        {/* Campo de telefone */}
        <View style={styles.form}>
          <Text style={styles.label}>Número de Telefone</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            placeholder="(00) 00000-0000"
            placeholderTextColor={COLORS.muted}
            value={phoneNumber}
            onChangeText={text => {
              setPhoneNumber(text);
              setError(null);
            }}
            keyboardType="phone-pad"
            autoFocus
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* Botão Enviar Código */}
        <TouchableOpacity
          style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
          onPress={handleSendCode}
          disabled={loading || !phoneNumber.trim()}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.sendText}>Enviar Código</Text>
          )}
        </TouchableOpacity>

        {/* Informação */}
        <Text style={styles.infoText}>
          Você receberá um código de 6 dígitos por SMS para confirmar seu número
        </Text>

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

  form: { marginTop: SP.xl },
  label: { color: COLORS.muted, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  inputError: {
    borderColor: colors.errorAlt,
    borderWidth: 1,
  },
  errorText: {
    color: colors.errorAlt,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  sendBtn: {
    marginTop: 70,
    height: 52,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },

  infoText: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 12,
    marginTop: SP.lg,
  },
});
