// src/utils/clerk-hooks-helper.ts
// Helper para carregar hooks do Clerk de forma robusta no React Native CLI

let clerkHooksModule: any = null;

// Função para carregar o módulo do Clerk
function loadClerkHooks() {
  if (clerkHooksModule) {
    return clerkHooksModule;
  }

  try {
    // @ts-ignore
    const clerkExpo = require('@clerk/clerk-expo');
    
    // Tentar diferentes formas de acessar os hooks
    const useOAuth = clerkExpo.useOAuth || 
                    clerkExpo.default?.useOAuth ||
                    (clerkExpo.default && clerkExpo.default.useOAuth);
    
    const useAuth = clerkExpo.useAuth || 
                   clerkExpo.default?.useAuth ||
                   (clerkExpo.default && clerkExpo.default.useAuth);

    if (useOAuth && useAuth) {
      clerkHooksModule = { useOAuth, useAuth };
      return clerkHooksModule;
    }

    console.error('useOAuth ou useAuth não encontrados em @clerk/clerk-expo');
    console.error('Exports disponíveis:', Object.keys(clerkExpo));
    
    // Fallback: hooks vazios que retornam valores padrão
    clerkHooksModule = {
      useOAuth: () => ({ 
        startOAuthFlow: () => Promise.reject(new Error('Clerk não configurado')) 
      }),
      useAuth: () => ({ 
        user: null, 
        isSignedIn: false 
      }),
    };
    return clerkHooksModule;
  } catch (error) {
    console.error('Erro ao carregar hooks do Clerk:', error);
    // Fallback: hooks vazios
    clerkHooksModule = {
      useOAuth: () => ({ 
        startOAuthFlow: () => Promise.reject(new Error('Clerk não configurado')) 
      }),
      useAuth: () => ({ 
        user: null, 
        isSignedIn: false 
      }),
    };
    return clerkHooksModule;
  }
}

// Exportar hooks que garantem estar disponíveis
export const useOAuth = (params: { strategy: string }) => {
  const hooks = loadClerkHooks();
  return hooks.useOAuth(params);
};

export const useAuth = (initialAuthState?: any) => {
  const hooks = loadClerkHooks();
  return hooks.useAuth(initialAuthState);
};

