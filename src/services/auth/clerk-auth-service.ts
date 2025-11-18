// src/services/auth/clerk-auth-service.ts
import { logger } from '@services/logging';
import { AuthUser } from './auth-service';

/**
 * Serviço de autenticação usando Clerk
 *
 * NOTA: Os hooks do Clerk (useAuth, useOAuth) devem ser usados diretamente
 * nos componentes React, não através desta classe.
 *
 * Exemplo de uso:
 * ```typescript
 * import { useAuth, useOAuth } from '@clerk/clerk-expo';
 *
 * const MyComponent = () => {
 *   const { user } = useAuth();
 *   const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
 *   // ...
 * };
 * ```
 *
 * Clerk simplifica o login social ao:
 * - Gerenciar automaticamente URLs de redirecionamento
 * - Fornecer UI pronta para login
 * - Suportar múltiplos provedores (Google, Apple, Facebook, etc.)
 * - Configurar OAuth automaticamente
 */
export class ClerkAuthService {
  private static instance: ClerkAuthService;

  private constructor() {}

  static getInstance(): ClerkAuthService {
    if (!ClerkAuthService.instance) {
      ClerkAuthService.instance = new ClerkAuthService();
    }
    return ClerkAuthService.instance;
  }

  /**
   * Converte usuário do Clerk para AuthUser
   */
  convertClerkUser(user: any): AuthUser {
    return {
      uid: user.id,
      email: user.primaryEmailAddress?.emailAddress || null,
      displayName:
        user.fullName ||
        user.firstName ||
        user.emailAddresses?.[0]?.emailAddress ||
        null,
      phoneNumber: user.primaryPhoneNumber?.phoneNumber || null,
      photoURL: user.imageUrl || null,
      emailVerified:
        user.emailAddresses?.[0]?.verification?.status === 'verified',
    };
  }

  /**
   * Faz login com Google usando Clerk
   *
   * NOTA: Esta função deve ser usada dentro de um componente React
   * que tenha acesso aos hooks do Clerk. Para uso em componentes,
   * use o hook useOAuth diretamente.
   */
  async signInWithGoogle(): Promise<AuthUser> {
    try {
      logger.info('Iniciando login com Google via Clerk', {}, 'auth');

      // NOTA: Esta função é um wrapper. O uso real deve ser feito
      // com o hook useOAuth dentro de componentes React.
      // Exemplo de uso:
      // const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
      // const result = await startOAuthFlow();

      throw new Error(
        'Use o hook useOAuth dentro de componentes React. ' +
          'Veja exemplo em LoginScreenWip.tsx'
      );
    } catch (error: any) {
      logger.error(
        'Erro ao fazer login com Google via Clerk',
        {
          error: error.message,
        },
        'auth'
      );
      throw error;
    }
  }
}

export const clerkAuthService = ClerkAuthService.getInstance();
