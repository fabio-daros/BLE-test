// src/services/auth/auth-service.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePhoneNumber,
  PhoneAuthProvider,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase-config';
import { logger } from '@services/logging';
// Substituído expo-secure-store por AsyncStorage para React Native CLI
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export interface CreateAccountData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Cria uma nova conta com email e senha
   */
  async createAccount(data: CreateAccountData): Promise<AuthUser> {
    try {
      const auth = getFirebaseAuth();

      // Validar dados
      this.validateCreateAccountData(data);

      logger.info('Criando conta', { email: data.email }, 'auth');

      // Criar usuário no Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Atualizar perfil com o nome
      if (data.name) {
        await updateProfile(userCredential.user, {
          displayName: data.name,
        });
      }

      // Enviar email de verificação
      await sendEmailVerification(userCredential.user);

      // Salvar token e dados do usuário
      const token = await userCredential.user.getIdToken();
      await this.saveAuthData(
        token,
        this.convertFirebaseUser(userCredential.user)
      );

      logger.info(
        'Conta criada com sucesso',
        { uid: userCredential.user.uid },
        'auth'
      );

      // Formatar telefone para vincular depois (precisa de verificação SMS)
      // O telefone será vinculado após verificação SMS
      const formattedPhone = this.formatPhoneNumber(data.phone);

      logger.info(
        'Telefone será vinculado após verificação SMS',
        { phone: formattedPhone },
        'auth'
      );

      return this.convertFirebaseUser(userCredential.user);
    } catch (error: any) {
      logger.error('Erro ao criar conta', { error: error.message }, 'auth');
      throw this.handleAuthError(error);
    }
  }

  /**
   * Login com email e senha
   */
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    try {
      const auth = getFirebaseAuth();

      logger.info('Tentativa de login', { email: credentials.email }, 'auth');

      const userCredential = await signInWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password
      );

      // Salvar token e dados do usuário
      const token = await userCredential.user.getIdToken();
      await this.saveAuthData(
        token,
        this.convertFirebaseUser(userCredential.user)
      );

      logger.info(
        'Login realizado com sucesso',
        { uid: userCredential.user.uid },
        'auth'
      );

      return this.convertFirebaseUser(userCredential.user);
    } catch (error: any) {
      logger.error('Erro ao fazer login', { error: error.message }, 'auth');
      throw this.handleAuthError(error);
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      await this.clearAuthData();

      logger.info('Logout realizado', {}, 'auth');
    } catch (error: any) {
      logger.error('Erro ao fazer logout', { error: error.message }, 'auth');
      throw this.handleAuthError(error);
    }
  }

  /**
   * Obtém o usuário atual
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;

      if (!user) {
        // Tentar recuperar do storage
        const storedUser = await AsyncStorage.getItem(USER_DATA_KEY);
        if (storedUser) {
          return JSON.parse(storedUser);
        }
        return null;
      }

      return this.convertFirebaseUser(user);
    } catch (error: any) {
      logger.error(
        'Erro ao obter usuário atual',
        { error: error.message },
        'auth'
      );
      return null;
    }
  }

  /**
   * Atualiza senha do usuário
   */
  async updateUserPassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;

      if (!user || !user.email) {
        throw new Error('Usuário não autenticado');
      }

      // Reautenticar antes de mudar senha
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Atualizar senha
      await updatePassword(user, newPassword);

      logger.info('Senha atualizada com sucesso', {}, 'auth');
    } catch (error: any) {
      logger.error('Erro ao atualizar senha', { error: error.message }, 'auth');
      throw this.handleAuthError(error);
    }
  }

  /**
   * Envia email de redefinição de senha
   */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, email);

      logger.info('Email de redefinição de senha enviado', { email }, 'auth');
    } catch (error: any) {
      logger.error(
        'Erro ao enviar email de redefinição',
        { error: error.message },
        'auth'
      );
      throw this.handleAuthError(error);
    }
  }

  /**
   * Salva dados de autenticação no AsyncStorage
   * @internal - Método público para uso interno de outros serviços
   */
  async saveAuthData(token: string, user: AuthUser): Promise<void> {
    try {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    } catch (error) {
      logger.error('Erro ao salvar dados de autenticação', { error }, 'auth');
    }
  }

  /**
   * Converte User do Firebase para AuthUser
   * @internal - Método público para uso interno de outros serviços
   */
  convertFirebaseUser(user: any): AuthUser {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
    };
  }

  /**
   * Limpa dados de autenticação
   */
  private async clearAuthData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_DATA_KEY);
    } catch (error) {
      logger.error('Erro ao limpar dados de autenticação', { error }, 'auth');
    }
  }

  /**
   * Valida dados de criação de conta
   */
  private validateCreateAccountData(data: CreateAccountData): void {
    if (!data.name || data.name.trim().length < 2) {
      throw new Error('Nome deve ter pelo menos 2 caracteres');
    }

    if (!data.email || !this.isValidEmail(data.email)) {
      throw new Error('Email inválido');
    }

    if (!data.phone || !this.isValidPhoneNumber(data.phone)) {
      throw new Error('Telefone inválido');
    }

    if (!data.password || data.password.length < 6) {
      throw new Error('Senha deve ter pelo menos 6 caracteres');
    }

    // Validações de senha forte (opcional)
    if (!this.isStrongPassword(data.password)) {
      throw new Error(
        'Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número'
      );
    }
  }

  /**
   * Valida formato de telefone
   */
  private isValidPhoneNumber(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10;
  }

  /**
   * Formata número de telefone para formato internacional
   */
  private formatPhoneNumber(
    phone: string,
    countryCode: string = '+55'
  ): string {
    const cleaned = phone.replace(/\D/g, '');

    if (phone.startsWith('+')) {
      return phone;
    }

    if (!cleaned.startsWith(countryCode.replace('+', ''))) {
      return `${countryCode}${cleaned}`;
    }

    return `+${cleaned}`;
  }

  /**
   * Vincula telefone verificado à conta do usuário
   * Deve ser chamado após verificar o código SMS
   */
  async linkPhoneNumber(verificationId: string, code: string): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      logger.info('Vinculando telefone à conta', { uid: user.uid }, 'auth');

      // Criar credencial com código de verificação
      const credential = PhoneAuthProvider.credential(verificationId, code);

      // Vincular telefone à conta
      await updatePhoneNumber(user, credential);

      logger.info('Telefone vinculado com sucesso', { uid: user.uid }, 'auth');

      // Atualizar dados salvos
      const token = await user.getIdToken();
      await this.saveAuthData(token, this.convertFirebaseUser(user));
    } catch (error: any) {
      logger.error(
        'Erro ao vincular telefone',
        { error: error.message },
        'auth'
      );
      throw this.handleAuthError(error);
    }
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida força da senha
   */
  private isStrongPassword(password: string): boolean {
    // Mínimo 6 caracteres, pelo menos uma letra maiúscula, uma minúscula e um número
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    return strongPasswordRegex.test(password);
  }

  /**
   * Trata erros de autenticação e retorna mensagens amigáveis
   */
  private handleAuthError(error: any): Error {
    const code = error.code || error.message;

    // Log detalhado do erro para debug
    logger.error(
      'Erro de autenticação detalhado',
      {
        code,
        message: error.message,
        error: JSON.stringify(error, null, 2),
      },
      'auth'
    );

    let errorResponse: Error;

    switch (code) {
      case 'auth/email-already-in-use':
        errorResponse = new Error(
          'Este email já está em uso. ' +
            'Se você já criou uma conta, tente fazer login. ' +
            'Caso contrário, verifique no Firebase Console se o email existe.'
        );
        break;
      case 'auth/invalid-email':
        errorResponse = new Error('Email inválido');
        break;
      case 'auth/operation-not-allowed':
        errorResponse = new Error(
          'Operação não permitida. ' +
            'Verifique se o método de autenticação Email/Senha está habilitado no Firebase Console.'
        );
        break;
      case 'auth/weak-password':
        errorResponse = new Error('Senha muito fraca');
        break;
      case 'auth/user-disabled':
        errorResponse = new Error('Usuário desabilitado');
        break;
      case 'auth/user-not-found':
        errorResponse = new Error('Usuário não encontrado');
        break;
      case 'auth/wrong-password':
        errorResponse = new Error('Senha incorreta');
        break;
      case 'auth/too-many-requests':
        errorResponse = new Error(
          'Muitas tentativas. Tente novamente mais tarde'
        );
        break;
      case 'auth/network-request-failed':
        errorResponse = new Error('Erro de conexão. Verifique sua internet');
        break;
      case 'auth/invalid-credential':
        errorResponse = new Error(
          'Credenciais inválidas. Verifique email e senha.'
        );
        break;
      case 'auth/configuration-not-found':
        errorResponse = new Error(
          'Configuração do Firebase não encontrada. ' +
            'Verifique se as credenciais estão corretas.'
        );
        break;
      default: {
        // Retornar erro com mais detalhes para debug
        const errorMessage = error.message || 'Erro desconhecido ao autenticar';
        errorResponse = new Error(
          `${errorMessage} (Código: ${code}). ` +
            'Verifique os logs para mais detalhes.'
        );
        break;
      }
    }
    return errorResponse;
  }
}

export const authService = AuthService.getInstance();
