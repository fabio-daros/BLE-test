// src/screens/CreateAccount.tsx
import DnaHeader from '@/ui/DnaHeader';
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
import { AntDesign, Feather } from '@/utils/vector-icons-helper';
import { COLORS, SP } from '@/ui/tokens';
import { colors } from '@presentation/theme';
import { BottomBar } from '@/ui/BottomBar';
import { ProgressBar } from '@/presentation/components';
import { authService } from '@services/auth';
import { logger } from '@services/logging';

// Ornamento superior (ajuste o caminho se necessário)
import Dna from '@assets/dna.svg';

interface Props {
  onBack?: () => void;
  onSubmit?: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void> | void;
  onGoToLogin?: () => void;
}

const CreateAccount: React.FC<Props> = ({ onBack, onSubmit, onGoToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Nome deve ter pelo menos 2 caracteres';
    }

    if (!email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email inválido';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    } else {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length < 10) {
        newErrors.phone = 'Telefone inválido';
      }
    }

    if (!pwd || pwd.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pwd)) {
      newErrors.password =
        'Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número';
    }

    if (!confirmPwd) {
      newErrors.confirmPassword = 'Confirme sua senha';
    } else if (pwd !== confirmPwd) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      logger.info('Tentativa de criação de conta', { email }, 'auth');

      // Criar conta usando o serviço de autenticação
      const user = await authService.createAccount({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: pwd,
      });

      logger.info('Conta criada com sucesso', { uid: user.uid }, 'auth');

      // Se houver callback customizado, chamar
      if (onSubmit) {
        await onSubmit({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password: pwd,
        });
      } else {
        // Senão, mostrar sucesso e navegar
        Alert.alert(
          'Conta criada!',
          'Sua conta foi criada com sucesso. Verifique seu email para confirmar.',
          [{ text: 'OK', onPress: onGoToLogin }]
        );
      }
    } catch (error: any) {
      logger.error('Erro ao criar conta', { error: error.message }, 'auth');
      Alert.alert(
        'Erro',
        error.message || 'Erro ao criar conta. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Ornamento DNA no topo */}
      <DnaHeader>
        {/* se quiser colocar algo central (ex: logo menor), fica aqui */}
      </DnaHeader>

      <View style={styles.container}>
        {/* Botão Voltar */}
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <AntDesign name="arrowleft" size={25} color={COLORS.gold} />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>

        {/* Título */}
        <Text style={styles.title}>Criar conta</Text>

        {/* Formulário */}
        <View style={styles.form}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Digite aqui seu nome"
            placeholderTextColor={COLORS.muted}
            value={name}
            onChangeText={text => {
              setName(text);
              if (errors.name) {
                const { name: _, ...rest } = errors;
                setErrors(rest);
              }
            }}
            autoCapitalize="words"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

          <Text style={[styles.label, { marginTop: 12 }]}>E-mail</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Digite aqui seu e-mail"
            placeholderTextColor={COLORS.muted}
            value={email}
            onChangeText={text => {
              setEmail(text);
              if (errors.email) {
                const { email: _, ...rest } = errors;
                setErrors(rest);
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          <Text style={[styles.label, { marginTop: 12 }]}>Telefone</Text>
          <TextInput
            style={[styles.input, errors.phone && styles.inputError]}
            placeholder="(00) 00000-0000"
            placeholderTextColor={COLORS.muted}
            value={phone}
            onChangeText={text => {
              setPhone(text);
              if (errors.phone) {
                const { phone: _, ...rest } = errors;
                setErrors(rest);
              }
            }}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

          <Text style={[styles.label, { marginTop: 12 }]}>Senha</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.inputFlex,
                errors.password && styles.inputError,
              ]}
              placeholder="Crie uma senha"
              placeholderTextColor={COLORS.muted}
              value={pwd}
              onChangeText={text => {
                setPwd(text);
                if (errors.password) {
                  const { password: _, ...rest } = errors;
                  setErrors(rest);
                }
              }}
              secureTextEntry={!showPwd}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPwd(v => !v)}
              accessibilityLabel={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
            >
              <Feather
                name={showPwd ? 'eye-off' : 'eye'}
                size={18}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>
          {errors.password && (
            <Text style={styles.errorText}>{errors.password}</Text>
          )}

          <Text style={[styles.label, { marginTop: 12 }]}>Confirmar Senha</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.inputFlex,
                errors.confirmPassword && styles.inputError,
              ]}
              placeholder="Confirme sua senha"
              placeholderTextColor={COLORS.muted}
              value={confirmPwd}
              onChangeText={text => {
                setConfirmPwd(text);
                if (errors.confirmPassword) {
                  const { confirmPassword: _, ...rest } = errors;
                  setErrors(rest);
                }
              }}
              secureTextEntry={!showConfirmPwd}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirmPwd(v => !v)}
              accessibilityLabel={
                showConfirmPwd ? 'Ocultar senha' : 'Mostrar senha'
              }
            >
              <Feather
                name={showConfirmPwd ? 'eye-off' : 'eye'}
                size={18}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword && (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          )}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.cadastrarBtn}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.primaryText}>Cadastrar</Text>
          )}
        </TouchableOpacity>

        {/* Link para login */}
        <Text style={styles.footerText}>
          Já tem uma conta?{' '}
          <Text style={styles.footerLink} onPress={onGoToLogin}>
            Faça login aqui.
          </Text>
        </Text>

        {/* Barra fina de progresso (decorativa) */}
        <ProgressBar width="50%" marginTop={SP.sm} />

        {/* Barra inferior dourada fixa */}
        <BottomBar fixed={true} />
      </View>
    </SafeAreaView>
  );
};

export { CreateAccount };
export default CreateAccount;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, paddingHorizontal: SP.lg, paddingTop: SP.sm },

  // DNA topo
  dnaWrap: {
    position: 'absolute',
    top: 0,
    left: -40,
    right: -40,
    alignItems: 'center',
  },

  // Voltar
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

  // Título
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gold,
    marginTop: 85,
  },

  // Form
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
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  inputFlex: { flex: 1 },
  eyeBtn: {
    width: 40,
    height: 40,
    marginLeft: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // CTA
  cadastrarBtn: {
    marginTop: 70,
    height: 52,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Footer link
  footerText: {
    textAlign: 'center',
    color: COLORS.muted,
    marginTop: 50,
  },

  footerLink: {
    color: COLORS.gold,
    fontWeight: '700',
  },
  errorText: {
    color: colors.errorAlt,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  inputError: {
    borderColor: colors.errorAlt,
    borderWidth: 1,
  },
});
