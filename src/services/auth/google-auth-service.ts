// src/services/auth/google-auth-service.ts
import { Linking } from 'react-native';
import { Constants } from '@config/env';
// Nota: Para React Native CLI, precisamos usar uma implementação diferente de OAuth
// Por enquanto, vamos usar o Clerk que já está configurado
import { Platform } from 'react-native';
import { getFirebaseAuth } from './firebase-config';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { logger } from '@services/logging';
import { AuthUser, authService } from './auth-service';

// Configurar WebBrowser para autenticação
// WebBrowser não está disponível no React Native CLI
// WebBrowser.maybeCompleteAuthSession();

// Client IDs do Google OAuth
const ANDROID_CLIENT_ID =
  '316827163539-o2pfhni8ba0nmlr6rm7jr2v6g9nl9i2p.apps.googleusercontent.com';
const WEB_CLIENT_ID =
  '316827163539-qcfp294tr1ejl6ru3vudhvp33ptq8oq4.apps.googleusercontent.com'; // LampInpunt Web Client (manual)

export interface GoogleAuthConfig {
  iosClientId?: string;
  androidClientId: string;
  webClientId: string;
}

export interface GoogleUserInfo {
  email: string;
  name: string;
  picture?: string;
  sub: string;
  given_name?: string;
  family_name?: string;
}

export class GoogleAuthService {
  private static instance: GoogleAuthService;

  private constructor() {}

  static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  /**
   * Faz login com Google
   * NOTA: Este serviço não está disponível no React Native CLI
   * Use Clerk OAuth em vez disso
   */
  async signInWithGoogle(): Promise<AuthUser> {
    // Google Auth via Expo APIs não está disponível no React Native CLI
    // Use Clerk OAuth em vez disso
    throw new Error(
      'Autenticação Google via Expo não está disponível no React Native CLI. ' +
        'Use Clerk OAuth (googleAuthService do clerk-auth-service) em vez disso.'
    );

    // Código abaixo comentado - usa APIs do Expo que não estão disponíveis no React Native CLI
    /*
    try {
      const isExpoGo = Constants.appOwnership === 'expo';

      // Determinar redirect URI baseado no ambiente
      // Expo Go: usar makeRedirectUri com useProxy para gerar URL correta automaticamente
      // Build EAS: usar scheme (inpunto://)
      let redirectUri: string;
      if (isExpoGo) {
        // Usar makeRedirectUri para gerar automaticamente a URL correta
        redirectUri = makeRedirectUri({ useProxy: true });
        // Log da URL gerada para debug
        console.log('🔍 [DEBUG] Redirect URI gerado pelo Expo:', redirectUri);
        logger.info('Redirect URI gerado pelo Expo', { redirectUri }, 'auth');
      } else {
        redirectUri = makeRedirectUri({ scheme: 'inpunto' }); // Build EAS (Android/iOS)
      }

      // Determinar Client ID baseado no ambiente
      // Expo Go usa WEB client id
      // Build EAS usa ANDROID client id (ou iOS client id no futuro)
      const clientId = isExpoGo ? WEB_CLIENT_ID : ANDROID_CLIENT_ID;

      logger.info(
        'Iniciando login com Google',
        {
          isExpoGo,
          appOwnership: Constants.appOwnership,
          platform: Platform.OS,
          clientId: isExpoGo ? 'WEB' : 'ANDROID',
          redirectUri,
          clientIdPrefix: clientId.substring(0, 30) + '...',
        },
        'auth'
      );

      console.log('🔍 [DEBUG] Google Auth Config:', {
        isExpoGo,
        appOwnership: Constants.appOwnership,
        platform: Platform.OS,
        redirectUri,
        clientId: clientId.substring(0, 30) + '...',
        clientIdInUse: isExpoGo ? 'WEB' : 'ANDROID',
      });

      // Configurar discovery endpoints do Google
      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      };

      // Criar requisição de autenticação
      // Usar IdToken para obter id_token necessário para Firebase
      // NOTA: PKCE não é compatível com ResponseType.IdToken, então não usar usePKCE
      // NOTA: Nonce é obrigatório para ResponseType.IdToken

      // Gerar nonce aleatório (obrigatório para IdToken)
      // AuthSession.makeRandomString não existe, então vamos gerar manualmente
      const generateNonce = (length: number = 16): string => {
        const chars =
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let nonce = '';
        for (let i = 0; i < length; i++) {
          nonce += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return nonce;
      };

      const nonce = generateNonce(16);

      const request = new AuthSession.AuthRequest({
        clientId: clientId,
        scopes: ['openid', 'email', 'profile'],
        responseType: AuthSession.ResponseType.IdToken, // Usar IdToken para Firebase
        redirectUri: redirectUri,
        usePKCE: false, // PKCE não é compatível com IdToken
        // Gerar nonce aleatório (obrigatório para IdToken)
        extraParams: {
          nonce: nonce, // Nonce obrigatório para IdToken
        },
      });

      // Solicitar autenticação
      // Expo Go usa useProxy: true
      // Build EAS usa useProxy: false (usa scheme)
      const result = await request.promptAsync(discovery, {
        useProxy: isExpoGo,
      });

      // ... resto do código comentado ...
    } catch (error: any) {
      logger.error(
        'Erro ao fazer login com Google',
        {
          error: error.message,
          stack: error.stack,
        },
        'auth'
      );
      throw this.handleGoogleAuthError(error);
    }
    */
  }

  /**
   * Trata erros de autenticação Google
   */
  private handleGoogleAuthError(error: any): Error {
    const message = error.message || 'Erro desconhecido';

    // Se a mensagem já é específica (contém quebras de linha ou múltiplas linhas),
    // retornar como está (não substituir por mensagem genérica)
    if (message.includes('\n') || message.length > 100) {
      return new Error(message);
    }

    if (message.includes('cancelado')) {
      return new Error('Login cancelado pelo usuário');
    }

    if (message.includes('Token')) {
      return new Error('Erro ao obter token do Google');
    }

    if (message.includes('configurado')) {
      return new Error(
        'Autenticação Google não configurada. Configure as credenciais do Google OAuth.'
      );
    }

    if (message.includes('network') || message.includes('conexão')) {
      return new Error('Erro de conexão. Verifique sua internet');
    }

    if (
      message.includes('invalid_request') ||
      message.includes('redirect_uri_mismatch')
    ) {
      return new Error(
        'Erro de configuração OAuth. Verifique se a URL de redirecionamento está configurada ' +
          'corretamente no Google Cloud Console para o Client ID apropriado (Web para Expo Go, Android para build EAS).'
      );
    }

    return new Error(message);
  }

  /**
   * Retorna informações de debug
   * NOTA: Não disponível no React Native CLI - usa Clerk em vez disso
   */
  getDebugInfo() {
    return {
      isExpoGo: false,
      appOwnership: 'standalone',
      platform: Platform.OS,
      redirectUri: 'N/A - Use Clerk OAuth',
      androidClientId: ANDROID_CLIENT_ID.substring(0, 30) + '...',
      webClientId: WEB_CLIENT_ID.substring(0, 30) + '...',
      clientIdInUse: 'N/A - Use Clerk OAuth',
      clientId: 'N/A - Use Clerk OAuth',
      note: 'Google Auth via Expo não está disponível no React Native CLI. Use Clerk OAuth.',
    };
  }
}

export const googleAuthService = GoogleAuthService.getInstance();
