// src/presentation/screens/GoogleLoginScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AntDesign } from '@/utils/vector-icons-helper';
import { logger } from '@services/logging';

// Import dos hooks do Clerk usando helper robusto
import { useOAuth, useAuth } from '@/utils/clerk-hooks-helper';
import { BottomBar } from '@/ui/BottomBar';
import { ProgressBar } from '@/presentation/components';
import DnaHeader from '@/ui/DnaHeader';
import { colors } from '../theme';

interface Props {
  onBack: () => void;
  onLoginSuccess: (userData?: {
    displayName?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void> | void;
}

export const GoogleLoginScreen: React.FC<Props> = ({
  onBack,
  onLoginSuccess,
}) => {
  const [loading, setLoading] = useState(false);

  // Hook do Clerk para OAuth
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { user: clerkUser, isSignedIn } = useAuth();

  // Verificar se o hook está configurado corretamente
  useEffect(() => {
    if (!startOAuthFlow) {
      logger.error('useOAuth hook não retornou startOAuthFlow', {}, 'auth');
    } else {
      logger.info(
        'useOAuth hook configurado corretamente',
        { strategy: 'oauth_google' },
        'auth'
      );
    }
  }, [startOAuthFlow]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      logger.info('Iniciando login com Google via Clerk', {}, 'auth');

      // Verificar se startOAuthFlow está disponível
      if (!startOAuthFlow) {
        throw new Error(
          'startOAuthFlow não está disponível. Verifique se o Clerk está configurado corretamente.'
        );
      }

      console.log('🔍 [DEBUG] Antes de chamar startOAuthFlow', {
        hasStartOAuthFlow: !!startOAuthFlow,
        typeofStartOAuthFlow: typeof startOAuthFlow,
      });

      // Iniciar fluxo OAuth do Clerk
      const result = await startOAuthFlow();

      console.log('🔍 [DEBUG] Depois de chamar startOAuthFlow', {
        result: result,
        resultType: typeof result,
        isNull: result === null,
        isUndefined: result === undefined,
        hasStatus: 'status' in (result || {}),
      });

      // Verificar se result é válido
      if (!result) {
        logger.error(
          'startOAuthFlow retornou resultado inválido',
          {
            result: result,
            resultType: typeof result,
          },
          'auth'
        );

        Alert.alert(
          'Erro ao iniciar login',
          'Não foi possível iniciar o login com Google. Verifique se o Google OAuth está configurado no Clerk Dashboard.'
        );
        return;
      }

      // Log detalhado do resultado
      const authSessionResult = result.authSessionResult;
      const signUp = result.signUp;
      const signIn = result.signIn;
      const setActive = result.setActive;

      logger.info(
        'Resultado do fluxo OAuth do Clerk',
        {
          status: result.status,
          createdSessionId: result.createdSessionId,
          authSessionResultType: authSessionResult?.type,
          signUpStatus: signUp?._status,
          signInStatus: signIn?._status,
          hasSetActive: !!setActive,
          resultKeys: Object.keys(result),
        },
        'auth'
      );

      console.log('🔍 [DEBUG] Clerk OAuth Result Completo:', {
        status: result.status,
        createdSessionId: result.createdSessionId,
        authSessionResultType: authSessionResult?.type,
        signUpStatus: signUp?._status,
        signInStatus: signIn?._status,
        hasSetActive: !!setActive,
        signUp: signUp,
        signIn: signIn,
      });

      // Verificar se o OAuth foi bem-sucedido
      if (authSessionResult?.type === 'success') {
        logger.info(
          'OAuth Google bem-sucedido, verificando signUp/signIn',
          {
            signUpStatus: signUp?._status,
            signInStatus: signIn?._status,
          },
          'auth'
        );

        // Se há signUp com missing_requirements, completar o cadastro
        if (signUp && signUp._status === 'missing_requirements') {
          try {
            logger.info(
              'Completando signUp do Clerk',
              {
                emailAddress: signUp.emailAddress,
                firstName: signUp.firstName,
                missingFields: signUp.missingFields,
              },
              'auth'
            );

            // Completar o signUp (pode precisar de campos adicionais)
            const updateData: {
              firstName?: string;
              lastName?: string;
            } = {};
            if (signUp.firstName) updateData.firstName = signUp.firstName;
            if (signUp.lastName) updateData.lastName = signUp.lastName;
            await signUp.update(updateData);

            // Se o signUp foi completado, ativar a sessão
            if (setActive && signUp.createdSessionId) {
              await setActive({ session: signUp.createdSessionId });
              logger.info(
                'Sessão ativada após signUp',
                {
                  sessionId: signUp.createdSessionId,
                },
                'auth'
              );
            }

            // Preparar dados do usuário para passar ao callback
            const userData: {
              displayName?: string;
              email?: string;
              firstName?: string;
              lastName?: string;
            } = {};
            if (signUp.firstName) userData.firstName = signUp.firstName;
            if (signUp.lastName) userData.lastName = signUp.lastName;
            if (signUp.emailAddress) userData.email = signUp.emailAddress;
            if (signUp.firstName && signUp.lastName) {
              userData.displayName =
                `${signUp.firstName} ${signUp.lastName}`.trim();
            } else if (signUp.firstName) {
              userData.displayName = signUp.firstName;
            } else if (signUp.lastName) {
              userData.displayName = signUp.lastName;
            } else if (signUp.emailAddress) {
              userData.displayName = signUp.emailAddress;
            }

            logger.info(
              'Dados do usuário preparados para callback',
              {
                userData,
                signUpEmail: signUp.emailAddress,
                signUpFirstName: signUp.firstName,
                signUpLastName: signUp.lastName,
              },
              'auth'
            );

            // Chamar callback do app com dados do usuário
            await onLoginSuccess?.(userData);
            return;
          } catch (signUpError: any) {
            logger.error(
              'Erro ao completar signUp',
              {
                error: signUpError.message,
                stack: signUpError.stack,
              },
              'auth'
            );

            Alert.alert(
              'Erro ao completar cadastro',
              'Não foi possível completar o cadastro. Tente novamente.'
            );
            return;
          }
        }

        // Se há signIn, verificar se precisa completar
        if (signIn && signIn._status === 'needs_identifier') {
          try {
            logger.info('SignIn precisa de identificação', {}, 'auth');

            // Se o signIn foi completado, ativar a sessão
            if (setActive && signIn.createdSessionId) {
              await setActive({ session: signIn.createdSessionId });
              logger.info(
                'Sessão ativada após signIn',
                {
                  sessionId: signIn.createdSessionId,
                },
                'auth'
              );

              // Obter dados do usuário do Clerk após signIn
              const userData: {
                displayName?: string;
                email?: string;
                firstName?: string;
                lastName?: string;
              } = {};

              // Aguardar um pouco para o Clerk atualizar o usuário
              await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

              if (clerkUser) {
                if (clerkUser.firstName)
                  userData.firstName = clerkUser.firstName;
                if (clerkUser.lastName) userData.lastName = clerkUser.lastName;
                if (clerkUser.primaryEmailAddress?.emailAddress) {
                  userData.email = clerkUser.primaryEmailAddress.emailAddress;
                }
                if (clerkUser.fullName) {
                  userData.displayName = clerkUser.fullName;
                } else if (clerkUser.firstName) {
                  userData.displayName = clerkUser.firstName;
                } else if (clerkUser.lastName) {
                  userData.displayName = clerkUser.lastName;
                } else if (clerkUser.primaryEmailAddress?.emailAddress) {
                  userData.displayName =
                    clerkUser.primaryEmailAddress.emailAddress;
                }
              }

              // Chamar callback do app com dados do usuário
              await onLoginSuccess?.(userData);
              return;
            }
          } catch (signInError: any) {
            logger.error(
              'Erro ao completar signIn',
              {
                error: signInError.message,
              },
              'auth'
            );
          }
        }

        // Se há createdSessionId e setActive, ativar a sessão
        if (result.createdSessionId && setActive) {
          try {
            await setActive({ session: result.createdSessionId });
            logger.info(
              'Sessão ativada com sucesso',
              {
                sessionId: result.createdSessionId,
              },
              'auth'
            );

            // Aguardar um pouco para o Clerk atualizar o usuário
            await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

            // Obter dados do usuário do Clerk
            const userData: {
              displayName?: string;
              email?: string;
              firstName?: string;
              lastName?: string;
            } = {};

            if (clerkUser) {
              if (clerkUser.firstName) userData.firstName = clerkUser.firstName;
              if (clerkUser.lastName) userData.lastName = clerkUser.lastName;
              if (clerkUser.primaryEmailAddress?.emailAddress) {
                userData.email = clerkUser.primaryEmailAddress.emailAddress;
              }
              if (clerkUser.fullName) {
                userData.displayName = clerkUser.fullName;
              } else if (clerkUser.firstName) {
                userData.displayName = clerkUser.firstName;
              } else if (clerkUser.lastName) {
                userData.displayName = clerkUser.lastName;
              } else if (clerkUser.primaryEmailAddress?.emailAddress) {
                userData.displayName =
                  clerkUser.primaryEmailAddress.emailAddress;
              }
            } else if (signUp) {
              // Se não houver clerkUser, usar dados do signUp
              if (signUp.firstName) userData.firstName = signUp.firstName;
              if (signUp.lastName) userData.lastName = signUp.lastName;
              if (signUp.emailAddress) userData.email = signUp.emailAddress;
              if (signUp.firstName && signUp.lastName) {
                userData.displayName =
                  `${signUp.firstName} ${signUp.lastName}`.trim();
              } else if (signUp.firstName) {
                userData.displayName = signUp.firstName;
              } else if (signUp.lastName) {
                userData.displayName = signUp.lastName;
              } else if (signUp.emailAddress) {
                userData.displayName = signUp.emailAddress;
              }
            }

            // Chamar callback do app com dados do usuário
            await onLoginSuccess?.(userData);
            return;
          } catch (setActiveError: any) {
            logger.error(
              'Erro ao ativar sessão',
              {
                error: setActiveError.message,
              },
              'auth'
            );
          }
        }

        // Se chegou aqui, o OAuth funcionou mas não conseguiu completar
        logger.warn(
          'OAuth bem-sucedido mas não foi possível completar login',
          {
            signUpStatus: signUp?._status,
            signInStatus: signIn?._status,
            createdSessionId: result.createdSessionId,
          },
          'auth'
        );

        Alert.alert(
          'Login incompleto',
          'O login com Google foi iniciado, mas não foi possível completar. Tente novamente.'
        );
      } else if (result.status === 'complete') {
        // Status 'complete' direto (caso padrão)
        logger.info(
          'Login com Google via Clerk bem-sucedido',
          {
            sessionId: result.createdSessionId,
          },
          'auth'
        );

        // Ativar sessão se houver setActive
        if (result.createdSessionId && setActive) {
          try {
            await setActive({ session: result.createdSessionId });
          } catch (error) {
            logger.warn(
              'Erro ao ativar sessão (mas login foi bem-sucedido)',
              {},
              'auth'
            );
          }
        }

        // Aguardar um pouco para o Clerk atualizar o usuário
        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

        // Obter dados do usuário do Clerk
        const userData: {
          displayName?: string;
          email?: string;
          firstName?: string;
          lastName?: string;
        } = {};

        if (clerkUser) {
          if (clerkUser.firstName) userData.firstName = clerkUser.firstName;
          if (clerkUser.lastName) userData.lastName = clerkUser.lastName;
          if (clerkUser.primaryEmailAddress?.emailAddress) {
            userData.email = clerkUser.primaryEmailAddress.emailAddress;
          }
          if (clerkUser.fullName) {
            userData.displayName = clerkUser.fullName;
          } else if (clerkUser.firstName) {
            userData.displayName = clerkUser.firstName;
          } else if (clerkUser.lastName) {
            userData.displayName = clerkUser.lastName;
          } else if (clerkUser.primaryEmailAddress?.emailAddress) {
            userData.displayName = clerkUser.primaryEmailAddress.emailAddress;
          }
        }

        // Chamar callback do app com dados do usuário
        await onLoginSuccess?.(userData);
      } else if (result.status === 'missing') {
        // Status 'missing' indica que o Google OAuth não está configurado
        logger.error(
          'Google OAuth não configurado no Clerk Dashboard',
          {
            status: result.status,
            error: result.error,
          },
          'auth'
        );

        Alert.alert(
          'Google OAuth não configurado',
          'O Google OAuth precisa ser configurado no Clerk Dashboard.\n\n' +
            '1. Acesse: https://dashboard.clerk.com/\n' +
            '2. Vá em "Social Connections" (ou "Conexões SSO")\n' +
            '3. Clique em "Google"\n' +
            '4. Certifique-se de que "Ative para cadastro e login" está ON\n' +
            '5. Clique em "Atualizar"\n\n' +
            'Após salvar, aguarde alguns segundos e tente novamente.'
        );
      } else {
        // Outros status (cancel, error, etc.)
        const errorMessage =
          result.error || `Status: ${result.status || 'undefined'}`;
        logger.warn(
          'Login com Google via Clerk cancelado ou incompleto',
          {
            status: result.status,
            error: result.error,
            errorCode: result.errorCode,
          },
          'auth'
        );

        if (result.status === 'cancel') {
          // Usuário cancelou - não mostrar alerta, apenas voltar
          return;
        } else {
          // Outro erro - mostrar mensagem genérica
          Alert.alert(
            'Login cancelado',
            `O login foi cancelado ou não foi completado.\n\nStatus: ${result.status || 'desconhecido'}`
          );
        }
      }
    } catch (error: any) {
      logger.error(
        'Erro ao fazer login com Google via Clerk',
        {
          error: error.message,
          stack: error.stack,
          errorName: error.name,
          errorType: typeof error,
        },
        'auth'
      );

      console.error('🔍 [DEBUG] Erro completo:', {
        error: error,
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // Mensagem de erro mais amigável
      let errorMessage = 'Erro desconhecido ao fazer login com Google.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.toString && typeof error.toString === 'function') {
        errorMessage = error.toString();
      }

      Alert.alert(
        'Erro ao fazer login',
        errorMessage +
          '\n\nVerifique se o Google OAuth está configurado no Clerk Dashboard.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <DnaHeader />

        {/* Botão de voltar */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <AntDesign name="arrowleft" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Login com Google</Text>
          <Text style={styles.subtitle}>
            Faça login usando sua conta Google para continuar
          </Text>

          <TouchableOpacity
            style={styles.googleBtn}
            activeOpacity={0.85}
            onPress={handleGoogleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Login com Google"
          >
            <View style={styles.btnLeftIcon}>
              <AntDesign name="google" size={24} color={colors.googleRed} />
            </View>
            <Text style={styles.googleText}>
              {loading ? 'Conectando...' : 'Continuar com Google'}
            </Text>
            {loading && (
              <ActivityIndicator
                style={styles.spinner}
                color={colors.googleRed}
                size="small"
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <ProgressBar />
        </View>

        <BottomBar fixed={true} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 48,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  googleBtn: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 28,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    minWidth: 280,
    justifyContent: 'center',
  },
  btnLeftIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    marginRight: 16,
  },
  googleText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 12,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundGray,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
