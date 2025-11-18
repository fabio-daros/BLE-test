// Declaração de tipos para @clerk/clerk-expo
// Este arquivo resolve o erro de TypeScript quando os tipos não estão disponíveis
declare module '@clerk/clerk-expo' {
  import { ReactNode } from 'react';

  export interface ClerkProviderProps {
    publishableKey: string;
    children: ReactNode;
  }

  export interface User {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    primaryEmailAddress?: {
      emailAddress: string;
    } | null;
    primaryPhoneNumber?: {
      phoneNumber: string;
    } | null;
    emailAddresses?: Array<{
      emailAddress: string;
      verification?: {
        status: string;
      };
    }>;
    imageUrl?: string | null;
  }

  export interface UseAuthReturn {
    isSignedIn: boolean;
    isLoaded: boolean;
    user: User | null;
  }

  export interface UseOAuthReturn {
    startOAuthFlow: () => Promise<OAuthResult>;
  }

  export interface OAuthResult {
    status?: 'complete' | 'missing' | 'error' | 'cancel';
    createdSessionId?: string | null;
    error?: string;
    errorCode?: string;
    authSessionResult?: {
      type: 'success' | 'dismiss' | 'cancel';
      url?: string;
    };
    signUp?: {
      _status?: string;
      firstName?: string | null;
      lastName?: string | null;
      emailAddress?: string | null;
      createdSessionId?: string | null;
      missingFields?: string[];
      update: (data: {
        firstName?: string;
        lastName?: string;
      }) => Promise<void>;
    };
    signIn?: {
      _status?: string;
      createdSessionId?: string | null;
    };
    setActive?: (options: { session: string | null }) => Promise<void>;
  }

  export function ClerkProvider(props: ClerkProviderProps): JSX.Element;
  export function useAuth(): UseAuthReturn;
  export function useOAuth(options: { strategy: string }): UseOAuthReturn;
}
