// src/contexts/NavigationContext.tsx
import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { logger } from '@services/logging';

export type AppState =
  | 'splash'
  | 'login'
  | 'createaccount'
  | 'phoneLogin'
  | 'phoneVerification'
  | 'googleLogin'
  | 'home'
  | 'homewip'
  | 'logs'
  | 'availabletests'
  | 'videotutorial'
  | 'testhistory'
  | 'admin'
  | 'machineStatus'
  | 'simulatorControls'
  | 'profileManagement'
  | 'homologationTemp'
  | 'genericError'
  | 'preTestInstructions'
  | 'selectWells'
  | 'summaryCinomose'
  | 'testInProgress'
  | 'resultsScreen'
  | 'pipettingInProgress'
  | 'sampleIdentification'
  | 'bluetoothConnection';

interface NavigationContextValue {
  currentState: AppState;
  previousState: string | null;
  navigateTo: (state: AppState, options?: { updatePrevious?: boolean }) => void;
  navigateBack: () => void;
  goHome: () => void;
  openHistory: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

interface NavigationProviderProps {
  currentState: AppState;
  previousState: string | null;
  setCurrentState: (state: AppState) => void;
  setPreviousState: (state: string | null) => void;
  children: ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({
  currentState,
  previousState,
  setCurrentState,
  setPreviousState,
  children,
}) => {
  const navigateTo = useCallback(
    (
      state: AppState,
      options?: { updatePrevious?: boolean }
    ) => {
      const updatePrevious = options?.updatePrevious !== false;
      
      if (updatePrevious) {
        setPreviousState(currentState);
      }
      
      logger.info(
        `Navegando para ${state}`,
        {
          from: currentState,
          to: state,
          updatePrevious,
        },
        'navigation'
      );
      
      setCurrentState(state);
    },
    [currentState, setCurrentState, setPreviousState]
  );

  const navigateBack = useCallback(() => {
    if (previousState) {
      logger.info(
        'Navegando para tela anterior',
        {
          from: currentState,
          to: previousState,
        },
        'navigation'
      );
      setCurrentState(previousState as AppState);
    } else {
      // Se não há estado anterior, vai para login
      logger.info(
        'Voltando para login (sem estado anterior)',
        {
          from: currentState,
        },
        'navigation'
      );
      setCurrentState('login');
    }
  }, [currentState, previousState, setCurrentState]);

  const goHome = useCallback(() => {
    logger.info(
      'Navegando para home',
      {
        from: currentState,
        to: 'homewip',
      },
      'navigation'
    );
    setCurrentState('homewip');
  }, [currentState, setCurrentState]);

  const openHistory = useCallback(() => {
    logger.info(
      'Abrindo histórico de testes',
      {
        from: currentState,
        to: 'testhistory',
      },
      'navigation'
    );
    setCurrentState('testhistory');
  }, [currentState, setCurrentState]);

  const value: NavigationContextValue = {
    currentState,
    previousState,
    navigateTo,
    navigateBack,
    goHome,
    openHistory,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextValue => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation deve ser usado dentro de NavigationProvider');
  }
  return context;
};

