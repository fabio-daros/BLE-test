import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import { Constants } from '@config/env';

// MOCK de Clerk para ambiente React Native CLI / testes BLE
type ClerkProviderProps = { children: React.ReactNode };

const ClerkProvider: React.FC<ClerkProviderProps> = ({ children }) => (
  <>{children}</>
);


/**
 * 🧪 BOTÃO DE DESENVOLVIMENTO - GUIA DE USO
 *
 * O botão "Testes" na tela de login é uma ferramenta de desenvolvimento que permite
 * acesso rápido a telas em desenvolvimento sem precisar navegar pelo fluxo normal.
 *
 * COMO USAR:
 * 1. Para trocar o destino do botão, modifique a função handleNavigateToAvailableTests()
 * 2. Altere o setCurrentState('availabletests') para setCurrentState('suaNovaTela')
 * 3. Adicione o novo estado no tipo: 'splash' | 'login' | ... | 'suaNovaTela'
 * 4. Adicione o caso no switch do renderScreen()
 *
 * EXEMPLO:
 * - setCurrentState('minhaNovaTela');
 * - Adicionar 'minhaNovaTela' no tipo de estado
 * - Adicionar case 'minhaNovaTela': return <MinhaNovaTela />
 */
import {
  testSQLiteCompatibility,
  getSQLiteVersion,
} from '@data/storage/sqlite-test';
import {
  SplashScreen,
  LoginScreenWip,
  HomeWip,
  LogsScreen,
  AvailableTests,
  VideoTutorial,
  TestHistory,
  HomologationTemp,
  SummaryCinomose,
  TestInProgress,
  ResultsScreen,
  PipettingInProgress,
  SampleIdentificationScreen,
  AdminPanelScreen,
  MachineStatusScreen,
  SimulatorControlsScreen,
  ProfileManagementScreen,
  PhoneLoginScreen,
  PhoneVerificationScreen,
  GoogleLoginScreen,
  BluetoothConnectionScreen,
  HomeScreen,
} from '@presentation/screens';
import { CreateAccount } from '@presentation/screens/CreateAccount';
import PreTestInstructions from '@presentation/screens/PreTestInstructions';
import SelectWells from '@presentation/screens/SelectWells';
import { GenericErrorView, AppHeader } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import { logger, sessionContextManager } from '@services/logging';
import { authService, phoneAuthService } from '@services/auth';
import { initializeFirebase } from '@services/auth';
import { AuthUser } from '@services/auth';
import type { TestProfile } from '@/types/test-profile';
import type { SampleItem } from '@presentation/screens/PipettingInProgress';
import type { AmostraResultado } from '@presentation/screens/ResultsScreen';
import { testDataService } from '@/data/test-data-service';
import { NavigationProvider } from '@/contexts/NavigationContext';

export const App: React.FC = () => {
  const [currentState, setCurrentState] = useState<
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
    | 'bluetoothConnection'
  >('bluetoothConnection'); // 🧪 TESTE: Abrindo diretamente na tela de Bluetooth
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [phoneVerificationData, setPhoneVerificationData] = useState<{
    phoneNumber: string;
    verificationId: string;
    isFromSignup?: boolean; // Indica se vem do cadastro (usuário já autenticado)
  } | null>(null);
  const [previousState, setPreviousState] = useState<string | null>(null);
  const [selectedWells, setSelectedWells] = useState<
    { num: number; id: string }[]
  >([]);
  // Estado para armazenar o teste selecionado
  const [selectedTest, setSelectedTest] = useState<{
    name: string;
    testKey: 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'custom';
    profile?: TestProfile;
  } | null>(null);
  // Estado para controlar a quantidade de pipes preenchidos (para testes)
  // Altere este valor para simular diferentes quantidades (0-16)
  // Exemplos de valores para testar:
  // - 0: Nenhum pipe preenchido
  // - 6: 6 pipes preenchidos (Controle Negativo, Controle Positivo, 4 amostras)
  // - 12: 12 pipes preenchidos (padrão)
  // - 16: Todos os pipes preenchidos
  const [filledPipesCount] = useState<number>(12); // Exemplo: 12 pipes preenchidos
  // Estado para armazenar os resultados gerados do teste atual
  const [currentTestResults, setCurrentTestResults] = useState<
    AmostraResultado[] | null
  >(null);

  // Função para gerar resultados aleatórios para as amostras
  const generateRandomResults = (
    samples: SampleItem[],
    wellsInfo?: { num: number; id: string }[]
  ): AmostraResultado[] => {
    const resultados: ('Positiva' | 'Negativa' | 'Inconclusiva')[] = [
      'Positiva',
      'Negativa',
      'Inconclusiva',
    ];

    return samples.map((sample, index) => {
      // Usar informações reais dos poços se disponível
      const wellInfo = wellsInfo?.[index];
      const wellNumber = wellInfo?.num ?? index + 1;
      const identifier = wellInfo?.id ?? sample.id;

      // Controles sempre têm resultados fixos baseados no tipo
      // Mas usamos o identificador real, não o texto "Controle Negativo"
      if (sample.type === 'controle-negativo') {
        return {
          id: wellNumber, // Usar número do poço como ID
          titulo: `Poço ${wellNumber}`, // Mostrar número do poço
          subtitulo: identifier, // Usar identificador real
          status: 'Negativa',
        };
      }
      if (sample.type === 'controle-positivo') {
        return {
          id: wellNumber, // Usar número do poço como ID
          titulo: `Poço ${wellNumber}`, // Mostrar número do poço
          subtitulo: identifier, // Usar identificador real
          status: 'Positiva',
        };
      }

      // Amostras têm resultados aleatórios
      const randomStatus: 'Positiva' | 'Negativa' | 'Inconclusiva' = resultados[
        Math.floor(Math.random() * resultados.length)
      ] as 'Positiva' | 'Negativa' | 'Inconclusiva';
      return {
        id: wellNumber, // Usar número do poço como ID
        titulo: `Poço ${wellNumber}`, // Mostrar número do poço
        subtitulo: identifier, // Usar identificador real
        status: randomStatus,
      };
    });
  };

  // Helper function para navegação com rastreamento de estado anterior
  const navigateToState = (newState: string) => {
    setPreviousState(currentState);
    setCurrentState(newState as any);
  };

  // Helper function para navegação sem atualizar previousState (para fluxo de testes)
  const navigateWithoutUpdatingPrevious = (newState: string) => {
    setCurrentState(newState as any);
  };

  useEffect(() => {
    // Inicializar Firebase
    try {
      initializeFirebase();
      logger.info('Firebase inicializado', {}, 'auth');
    } catch (error) {
      logger.error('Erro ao inicializar Firebase', { error }, 'auth');
    }

    // Verificar se há usuário autenticado
    const checkAuth = async () => {
      try {
        const user = await authService.getCurrentUser();
        console.log('[CLERK] user', user);
        if (user) {
          setCurrentUser(user.displayName || user.email || 'Usuário');
          sessionContextManager.updateContext({ userId: user.uid });
          logger.updateSessionContext();
          logger.info('Usuário já autenticado', { uid: user.uid }, 'auth');
        }
      } catch (error) {
        logger.error('Erro ao verificar autenticação', { error }, 'auth');
      }
    };

    const sessionContext = sessionContextManager.getSessionContext();
    logger.info(
      'App iniciado :)',
      {
        appVersion: sessionContext.appVersion,
        platform: sessionContext.platform,
        sessionId: sessionContext.sessionId,
        deviceId: sessionContext.deviceId,
        timestamp: new Date().toISOString(),
      },
      'app'
    );

    // Verificar autenticação
    checkAuth();

    // Testar SQLite após um delay
    setTimeout(async () => {
      logger.info('Iniciando teste SQLite', {}, 'sqlite');
      getSQLiteVersion();
      const result = await testSQLiteCompatibility();
      logger.info('Resultado do teste SQLite', { result }, 'sqlite');
    }, 1000);
  }, []);

  const handleSplashFinish = () => {
    logger.info(
      'Splash finalizada, navegando para login',
      {
        from: 'splash',
        to: 'login',
        duration: '2000ms',
      },
      'navigation'
    );
    setCurrentState('login');
  };

  // const handleLogin = async (email: string, password: string) => {
  //   logger.info(
  //     'Login realizado',
  //     {
  //       email,
  //       method: 'manual',
  //       timestamp: new Date().toISOString(),
  //     },
  //     'auth'
  //   );
  //   // Aqui você pode implementar a lógica real de autenticação
  //   return Promise.resolve();
  // };

  const handleNavigateToHome = async (userData?: {
    displayName?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }) => {
    try {
      // Obter dados do usuário do Clerk ou usar os dados passados
      let userName = 'Usuário';

      if (userData) {
        // Usar dados passados do LoginScreenWip
        userName =
          userData.displayName ||
          `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
          userData.email ||
          'Usuário';
      } else {
        // Tentar obter do authService (fallback)
        try {
          const user = await authService.getCurrentUser();
          if (user) {
            userName = user.displayName || user.email || 'Usuário';
          }
        } catch (error) {
          logger.warn(
            'Não foi possível obter usuário do authService',
            {},
            'auth'
          );
        }
      }

      setCurrentUser(userName);

      logger.info(
        'Navegando para HomeWip após login com Clerk',
        {
          from: currentState,
          to: 'homewip',
          trigger: 'login_google_success',
          userName,
        },
        'navigation'
      );
      setCurrentState('homewip');
    } catch (error: any) {
      logger.error(
        'Erro ao navegar para home',
        { error: error.message },
        'auth'
      );
    }
  };

  // const handleLogout = () => {
  //   const previousUser = currentUser;
  //   setCurrentUser(null);

  //   // Gera nova sessão para o logout
  //   sessionContextManager.refreshSession();
  //   logger.updateSessionContext();

  //   logger.info(
  //     'Logout realizado',
  //     {
  //       from: currentState,
  //       to: 'login',
  //       trigger: 'user_action',
  //       previousUser,
  //     },
  //     'auth'
  //   );
  //   setCurrentState('login');
  // };

  // const handleNavigateToLogs = () => {
  //   logger.info(
  //     'Navegando para logs',
  //     {
  //       from: currentState,
  //       to: 'logs',
  //       trigger: 'user_action',
  //       user: currentUser,
  //     },
  //     'navigation'
  //   );
  //   setCurrentState('logs');
  // };

  const handleNavigateBackFromLogs = () => {
    logger.info(
      'Voltando da tela de logs',
      {
        from: 'logs',
        to: 'homewip',
        trigger: 'back_button',
        user: currentUser,
      },
      'navigation'
    );
    setCurrentState('homewip');
  };

  const handleNavigateToPhoneLogin = () => {
    logger.info(
      'Navegando para login por telefone',
      {
        from: currentState,
        to: 'phoneLogin',
        trigger: 'phone_login_button',
      },
      'navigation'
    );
    setCurrentState('phoneLogin');
  };

  const handleNavigateToGoogleLogin = () => {
    logger.info(
      'Navegando para login com Google',
      {
        from: currentState,
        to: 'googleLogin',
        trigger: 'google_login_button',
      },
      'navigation'
    );
    setCurrentState('googleLogin');
  };

  const handleNavigateBackFromGoogleLogin = () => {
    logger.info(
      'Voltando do login com Google',
      {
        from: 'googleLogin',
        to: 'login',
        trigger: 'back_button',
      },
      'navigation'
    );
    setCurrentState('login');
  };

  const handlePhoneCodeSent = (phoneNumber: string, verificationId: string) => {
    setPhoneVerificationData({ phoneNumber, verificationId });
    logger.info(
      'Código SMS enviado, navegando para verificação',
      {
        from: 'phoneLogin',
        to: 'phoneVerification',
        phoneNumber,
      },
      'navigation'
    );
    setCurrentState('phoneVerification');
  };

  const handlePhoneVerificationSuccess = async (user: AuthUser) => {
    const isFromSignup = phoneVerificationData?.isFromSignup;

    // Se veio do cadastro, vincular telefone à conta existente
    if (isFromSignup && phoneVerificationData) {
      try {
        logger.info(
          'Vinculando telefone à conta após cadastro',
          {
            phone: phoneVerificationData.phoneNumber,
            uid: user.uid,
          },
          'auth'
        );

        // Vincular telefone à conta
        // O código já foi verificado no PhoneVerificationScreen
        // Precisamos obter o código verificado para vincular
        // Por enquanto, vamos usar o user que já tem o telefone vinculado
        // (se a verificação foi bem-sucedida, o telefone já está vinculado)

        const newUser = user.displayName || user.email || 'Usuário';
        setCurrentUser(newUser);
        sessionContextManager.updateContext({ userId: user.uid });
        logger.updateSessionContext();

        logger.info(
          'Telefone vinculado com sucesso após cadastro',
          {
            phone: phoneVerificationData.phoneNumber,
            uid: user.uid,
          },
          'auth'
        );
      } catch (error: any) {
        logger.error(
          'Erro ao vincular telefone após cadastro',
          { error: error.message },
          'auth'
        );
        // Continuar mesmo se falhar ao vincular telefone
      }
    } else {
      // Login normal com telefone
      const newUser =
        user.displayName || user.phoneNumber || 'Usuário Telefone';
      setCurrentUser(newUser);
      sessionContextManager.updateContext({ userId: user.uid });
      logger.updateSessionContext();
    }

    logger.info(
      'Navegando para HomeWip após verificação de telefone',
      {
        from: 'phoneVerification',
        to: 'homewip',
        trigger: isFromSignup
          ? 'phone_linked_after_signup'
          : 'phone_verification_success',
        user: currentUser,
        uid: user.uid,
      },
      'navigation'
    );
    setCurrentState('homewip');
    setPhoneVerificationData(null);
  };

  const handleNavigateBackFromPhoneLogin = () => {
    logger.info(
      'Voltando do login por telefone',
      {
        from: 'phoneLogin',
        to: 'login',
        trigger: 'back_button',
      },
      'navigation'
    );
    setCurrentState('login');
  };

  const handleNavigateBackFromPhoneVerification = () => {
    logger.info(
      'Voltando da verificação de telefone',
      {
        from: 'phoneVerification',
        to: 'phoneLogin',
        trigger: 'back_button',
      },
      'navigation'
    );
    setCurrentState('phoneLogin');
  };

  const handleNavigateBackFromHomeWip = () => {
    const previousUser = currentUser;
    setCurrentUser(null);

    // Gera nova sessão para o logout
    sessionContextManager.refreshSession();
    logger.updateSessionContext();

    logger.info(
      'Voltando da tela HomeWip',
      {
        from: 'homewip',
        to: 'login',
        trigger: 'back_button',
        previousUser,
      },
      'navigation'
    );
    setCurrentState('login');
  };

  const handleNavigateToCreateAccount = () => {
    logger.info(
      'Navegando para CreateAccount',
      {
        from: currentState,
        to: 'createaccount',
        trigger: 'register_button',
      },
      'navigation'
    );
    setCurrentState('createaccount');
  };

  const handleNavigateBackFromCreateAccount = () => {
    logger.info(
      'Voltando da tela CreateAccount',
      {
        from: 'createaccount',
        to: 'login',
        trigger: 'back_button',
      },
      'navigation'
    );
    setCurrentState('login');
  };

  const handleCreateAccountSubmit = async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => {
    try {
      logger.info(
        'Tentativa de criação de conta',
        {
          email: data.email,
          name: data.name,
          phone: data.phone,
          timestamp: new Date().toISOString(),
        },
        'auth'
      );

      // Criar conta usando o serviço de autenticação
      const user = await authService.createAccount({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });

      // Formatar telefone para envio de SMS
      const formattedPhone = phoneAuthService.formatPhoneNumber(data.phone);

      logger.info(
        'Conta criada, enviando código SMS para verificação',
        {
          phone: formattedPhone,
          uid: user.uid,
        },
        'auth'
      );

      // Enviar código SMS para verificação do telefone
      try {
        const verificationId =
          await phoneAuthService.sendVerificationCode(formattedPhone);

        // Navegar para tela de verificação de telefone
        // Marcar como vindo do cadastro para vincular telefone ao invés de fazer login
        setPhoneVerificationData({
          phoneNumber: formattedPhone,
          verificationId,
          isFromSignup: true,
        });

        logger.info(
          'Código SMS enviado, navegando para verificação',
          {
            from: 'createaccount',
            to: 'phoneVerification',
            phone: formattedPhone,
          },
          'navigation'
        );
        setCurrentState('phoneVerification');
      } catch (phoneError: any) {
        // Se falhar ao enviar SMS, ainda permite login (telefone não vinculado)
        logger.warn(
          'Erro ao enviar código SMS, mas conta foi criada',
          { error: phoneError.message },
          'auth'
        );

        // Navegar para home mesmo sem verificar telefone
        const newUser = user.displayName || user.email || data.name;
        setCurrentUser(newUser);
        sessionContextManager.updateContext({ userId: user.uid });
        logger.updateSessionContext();

        logger.info(
          'Conta criada (telefone não verificado), navegando para HomeWip',
          {
            from: 'createaccount',
            to: 'homewip',
            trigger: 'account_created',
            user: newUser,
            uid: user.uid,
          },
          'navigation'
        );
        setCurrentState('homewip');
      }
    } catch (error: any) {
      logger.error('Erro ao criar conta', { error: error.message }, 'auth');
      // O erro será mostrado na tela CreateAccount
      throw error;
    }
  };

  const handleStartTest = () => {
    logger.info(
      'Iniciando teste',
      {
        from: currentState,
        to: 'availabletests',
        trigger: 'start_test_button',
        user: currentUser,
        timestamp: new Date().toISOString(),
      },
      'test'
    );
    setCurrentState('availabletests');
  };

  const handleAccessAdminPanel = () => {
    logger.info(
      'Acessando painel administrativo',
      {
        from: currentState,
        to: 'admin',
        trigger: 'secret_sequence',
        user: currentUser,
      },
      'admin'
    );
    navigateToState('admin');
  };

  const handleNavigateBackFromAdmin = () => {
    if (previousState) {
      logger.info(
        'Voltando do painel administrativo para ' + previousState,
        {
          from: 'admin',
          to: previousState,
          trigger: 'back_button',
          user: currentUser,
        },
        'navigation'
      );
      setCurrentState(previousState as any);
    } else {
      logger.info(
        'Voltando do painel administrativo para login',
        {
          from: 'admin',
          to: 'login',
          trigger: 'back_button',
          user: currentUser,
        },
        'navigation'
      );
      setCurrentState('login');
    }
  };

  const handleAccessLogsFromAdmin = () => {
    logger.info(
      'Acessando logs do painel administrativo',
      {
        from: 'admin',
        to: 'logs',
        trigger: 'admin_panel_access',
        user: currentUser,
      },
      'admin'
    );
    setCurrentState('logs');
  };

  const handleAccessSimulatorControls = () => {
    logger.info(
      'Acessando controles do simulador',
      {
        from: currentState,
        to: 'simulatorControls',
        trigger: 'simulator_controls_button',
        user: currentUser,
      },
      'admin'
    );
    navigateToState('simulatorControls');
  };

  const handleAccessProfileManagement = () => {
    logger.info(
      'Acessando gerenciamento de perfis',
      {
        from: currentState,
        to: 'profileManagement',
        trigger: 'profile_management_button',
        user: currentUser,
      },
      'admin'
    );
    setCurrentState('profileManagement');
  };

  // 🧪 BOTÃO DE DESENVOLVIMENTO - Função para navegar para tela em desenvolvimento

  const handleNavigateBackFromAvailableTests = () => {
    logger.info(
      'Voltando da tela AvailableTests',
      {
        from: 'availabletests',
        to: 'homewip',
        trigger: 'back_button',
        user: currentUser,
      },
      'navigation'
    );
    setCurrentState('homewip');
  };

  const handleNavigateToHomeFromTests = () => {
    logger.info(
      'Navegando para HomeWip a partir de AvailableTests',
      {
        from: 'availabletests',
        to: 'homewip',
        trigger: 'home_button',
        user: currentUser,
      },
      'navigation'
    );
    setCurrentState('homewip');
  };

  // Função genérica para navegar para TestHistory
  const handleNavigateToTestHistory = () => {
    logger.info(
      'Navegando para TestHistory',
      {
        from: currentState,
        to: 'testhistory',
        trigger: 'history_button',
        user: currentUser,
      },
      'navigation'
    );
    navigateToState('testhistory');
  };

  const handleNavigateToHistoryFromTests = () => {
    handleNavigateToTestHistory();
  };

  const handleSelectTest = (
    testKey: 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'custom'
  ) => {
    logger.info(
      'Teste selecionado',
      {
        testKey,
        from: 'availabletests',
        user: currentUser,
        timestamp: new Date().toISOString(),
      },
      'test'
    );
    // Aqui você pode implementar a lógica para iniciar o teste específico
    console.log(`Teste selecionado: ${testKey}`);
  };

  const handleConfirmTestSelection = (
    testKey: 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'custom',
    profile?: TestProfile
  ) => {
    // Obter o nome do teste baseado no tipo ou no perfil
    const getTestName = (key: string, profileName?: string): string => {
      const typeLabels: Record<string, string> = {
        cinomose: 'Cinomose',
        ibv_geral: 'IBV Geral',
        ibv_especifico: 'IBV Específico',
        custom: profileName || 'Teste Personalizado',
      };
      return typeLabels[key] || profileName || 'Teste';
    };

    const testName = getTestName(testKey, profile?.name);

    logger.info(
      'Teste confirmado e navegando para SelectWells',
      {
        testKey,
        testName,
        profileId: profile?.id,
        profileName: profile?.name,
        from: 'availabletests',
        to: 'selectWells',
        user: currentUser,
        timestamp: new Date().toISOString(),
      },
      'test'
    );

    // Salvar o teste selecionado
    setSelectedTest({
      name: testName,
      testKey,
      ...(profile && { profile }),
    });

    // Navegar para a tela SelectWells
    navigateToState('selectWells');
  };

  const handleNavigateToVideoTutorial = () => {
    logger.info(
      'Navegando para VideoTutorial',
      {
        from: currentState,
        to: 'videotutorial',
        trigger: 'video_tutorial_button',
        user: currentUser,
      },
      'navigation'
    );
    navigateToState('videotutorial');
  };

  const handleNavigateBackFromVideoTutorial = () => {
    if (previousState) {
      logger.info(
        'Voltando da tela VideoTutorial para ' + previousState,
        {
          from: 'videotutorial',
          to: previousState,
          trigger: 'back_button',
          user: currentUser,
        },
        'navigation'
      );
      setCurrentState(previousState as any);
    } else {
      logger.info(
        'Voltando da tela VideoTutorial - sem estado anterior',
        {
          from: 'videotutorial',
          to: 'homewip',
          trigger: 'back_button',
          user: currentUser,
        },
        'navigation'
      );
      setCurrentState('homewip');
    }
  };

  const handleNavigateBackFromGenericError = () => {
    logger.info(
      'Voltando da tela GenericError',
      {
        from: 'genericError',
        to: 'login',
        trigger: 'back_button',
        user: currentUser,
      },
      'navigation'
    );
    setCurrentState('login');
  };

  // Funções específicas para navegação a partir de HomologationTemp
  const handleNavigateBackFromTestHistoryToHomologation = () => {
    logger.info(
      'Voltando da tela TestHistory para HomologationTemp',
      {
        from: 'testhistory',
        to: 'homologationTemp',
        trigger: 'back_button',
        user: currentUser,
      },
      'navigation'
    );
    setCurrentState('homologationTemp');
  };

  const handleNavigateBackFromGenericErrorToHomologation = () => {
    logger.info(
      'Voltando da tela GenericError para HomologationTemp',
      {
        from: 'genericError',
        to: 'homologationTemp',
        trigger: 'back_button',
        user: currentUser,
      },
      'navigation'
    );
    setCurrentState('homologationTemp');
  };

  const handleNavigateBackFromAvailableTestsToHomologation = () => {
    logger.info(
      'Voltando da tela AvailableTests para HomologationTemp',
      {
        from: 'availabletests',
        to: 'homologationTemp',
        trigger: 'back_button',
        user: currentUser,
      },
      'navigation'
    );
    setCurrentState('homologationTemp');
  };

  const handleNavigateBackFromPreTestInstructions = () => {
    logger.info(
      'Voltando da tela PreTestInstructions',
      {
        from: 'preTestInstructions',
        to: 'login',
        trigger: 'back_button',
        user: currentUser,
      },
      'navigation'
    );
    setCurrentState('login');
  };

  const renderScreen = () => {
    switch (currentState) {
      case 'splash':
        return <SplashScreen onFinish={handleSplashFinish} />;

      case 'login':
        return (
          <LoginScreenWip
            onLoginPhone={handleNavigateToPhoneLogin}
            onLoginGoogle={handleNavigateToGoogleLogin}
            onRegister={handleNavigateToCreateAccount}
            onAccessAdminPanel={handleAccessAdminPanel}
          />
        );

      case 'googleLogin':
        return (
          <GoogleLoginScreen
            onBack={handleNavigateBackFromGoogleLogin}
            onLoginSuccess={handleNavigateToHome}
          />
        );

      case 'phoneLogin':
        return (
          <PhoneLoginScreen
            onBack={handleNavigateBackFromPhoneLogin}
            onCodeSent={handlePhoneCodeSent}
          />
        );

      case 'phoneVerification':
        return phoneVerificationData ? (
          <PhoneVerificationScreen
            phoneNumber={phoneVerificationData.phoneNumber}
            verificationId={phoneVerificationData.verificationId}
            onBack={handleNavigateBackFromPhoneVerification}
            onVerificationSuccess={handlePhoneVerificationSuccess}
            isFromSignup={phoneVerificationData.isFromSignup ?? false}
            onResendCode={async () => {
              const verificationId =
                await phoneAuthService.sendVerificationCode(
                  phoneVerificationData.phoneNumber
                );
              setPhoneVerificationData({
                ...phoneVerificationData,
                verificationId,
              });
            }}
          />
        ) : null;

      case 'createaccount':
        return (
          <CreateAccount
            onBack={handleNavigateBackFromCreateAccount}
            onSubmit={handleCreateAccountSubmit}
            onGoToLogin={handleNavigateBackFromCreateAccount}
          />
        );

      case 'home':
        return (
          <HomeScreen
            onNavigateToLogs={() => {
              logger.info(
                'Navegando para Logs da HomeScreen',
                { from: 'home' },
                'navigation'
              );
              setCurrentState('logs');
            }}
            onNavigateToHomeWip={() => {
              logger.info(
                'Navegando para HomeWip da HomeScreen',
                { from: 'home' },
                'navigation'
              );
              setCurrentState('homewip');
            }}
            onLogout={async () => {
              logger.info('Logout iniciado', {}, 'auth');
              await authService.logout();
              setCurrentUser(null);
              setCurrentState('login');
            }}
          />
        );

      case 'homewip':
        return (
          <HomeWip
            userName={currentUser || 'Usuário'}
            onBack={handleNavigateBackFromHomeWip}
            onGoHome={() => {
              logger.info(
                'Navegando para home',
                {
                  screen: 'homewip',
                  user: currentUser,
                },
                'navigation'
              );
              // Já está na home, não faz nada ou pode recarregar
            }}
            onOpenHistory={handleNavigateToTestHistory}
            onStartTest={handleStartTest}
            onTutorial={handleNavigateToVideoTutorial}
            onNavigateToBluetooth={() => {
              logger.info(
                'Navegando para BluetoothConnection da HomeWip',
                { from: 'homewip' },
                'navigation'
              );
              setCurrentState('bluetoothConnection');
            }}
          />
        );

      case 'logs':
        return <LogsScreen onNavigateBack={handleNavigateBackFromLogs} />;

      case 'bluetoothConnection':
        return (
          <BluetoothConnectionScreen
            onBack={() => {
              if (previousState) {
                logger.info(
                  'Voltando da tela BluetoothConnection',
                  { from: 'bluetoothConnection', to: previousState },
                  'navigation'
                );
                setCurrentState(previousState as any);
              } else {
                logger.info(
                  'Voltando da tela BluetoothConnection para home',
                  { from: 'bluetoothConnection', to: 'homewip' },
                  'navigation'
                );
                setCurrentState('homewip');
              }
            }}
          />
        );

      case 'availabletests':
        return (
          <AvailableTests
            onBack={() => {
              if (previousState === 'homologationTemp') {
                handleNavigateBackFromAvailableTestsToHomologation();
              } else {
                handleNavigateBackFromAvailableTests();
              }
            }}
            onGoHome={handleNavigateToHomeFromTests}
            onOpenHistory={handleNavigateToHistoryFromTests}
            onSelectTest={handleSelectTest}
            onConfirmSelection={handleConfirmTestSelection}
          />
        );

      case 'videotutorial':
        return (
          <VideoTutorial
            onBack={handleNavigateBackFromVideoTutorial}
            onGoHome={handleNavigateToHomeFromTests}
            onOpenHistory={handleNavigateToHistoryFromTests}
          />
        );

      case 'testhistory':
        return (
          <TestHistory
            onBack={() => {
              if (previousState) {
                // Se houver previousState, volta para ele
                logger.info(
                  `Voltando da tela TestHistory para ${previousState}`,
                  { from: 'testhistory', to: previousState },
                  'navigation'
                );
                setCurrentState(previousState as any);
              } else {
                // Se não houver previousState, volta para home
                logger.info(
                  'Voltando da tela TestHistory para home (sem previousState)',
                  { from: 'testhistory', to: 'homewip' },
                  'navigation'
                );
                setCurrentState('homewip');
              }
            }}
            onGoHome={() => setCurrentState('homewip')}
            {...(currentUser && { operatorName: currentUser })}
            onOpenResult={item => {
              logger.info(
                'Resultado aberto',
                {
                  testId: item.id,
                  testType: item.testType,
                  animalName: item.animalName,
                  result: item.result,
                  operator: item.operator,
                },
                'testhistory'
              );
              // Montar mensagem com detalhes das amostras se disponível
              let message = `${item.testLabel}\n\nAnimal: ${item.animalName} (${item.animalSpecies})\nResultado: ${item.result}\nOperador: ${item.operator}\n\nNotas: ${item.notes}`;

              if (item.amostras && item.amostras.length > 0) {
                message += '\n\nResultados por Amostra:\n';
                item.amostras.forEach((amostra, idx) => {
                  message += `${idx + 1}. ${amostra.subtitulo}: ${amostra.status}\n`;
                });
              }

              Alert.alert('Resultado do Teste', message, [{ text: 'OK' }]);
            }}
          />
        );

      case 'admin':
        return (
          <AdminPanelScreen
            onNavigateBack={handleNavigateBackFromAdmin}
            onAccessLogs={handleAccessLogsFromAdmin}
            onAccessSimulatorControls={handleAccessSimulatorControls}
            onAccessProfileManagement={handleAccessProfileManagement}
            onNavigateToHomologationTemp={() => {
              logger.info(
                'Navegando para HomologationTemp do painel administrativo',
                { from: 'admin', to: 'homologationTemp' },
                'navigation'
              );
              navigateToState('homologationTemp');
            }}
          />
        );

      case 'machineStatus':
        return (
          <MachineStatusScreen
            onBack={() => {
              if (previousState) {
                logger.info(
                  'Voltando da tela MachineStatus para ' + previousState,
                  { from: 'machineStatus', to: previousState },
                  'navigation'
                );
                setCurrentState(previousState as any);
              } else {
                logger.info(
                  'Voltando da tela MachineStatus - sem estado anterior',
                  { from: 'machineStatus', to: 'homewip' },
                  'navigation'
                );
                setCurrentState('homewip');
              }
            }}
          />
        );

      case 'simulatorControls':
        return (
          <SimulatorControlsScreen
            onNavigateBack={() => {
              if (previousState) {
                logger.info(
                  'Voltando da tela SimulatorControls para ' + previousState,
                  { from: 'simulatorControls', to: previousState },
                  'navigation'
                );
                setCurrentState(previousState as any);
              } else {
                logger.info(
                  'Voltando da tela SimulatorControls para admin',
                  { from: 'simulatorControls', to: 'admin' },
                  'navigation'
                );
                setCurrentState('admin');
              }
            }}
          />
        );

      case 'genericError':
        return (
          <GenericErrorView
            onBack={() => {
              if (previousState === 'homologationTemp') {
                handleNavigateBackFromGenericErrorToHomologation();
              } else {
                handleNavigateBackFromGenericError();
              }
            }}
            onGoHome={() => setCurrentState('homewip')}
            title="Identificamos um Problema"
            errorTitle="Detecamos uma falha na leitura do sensor do poço X"
            description="O dispositivo não conseguiu realizar a leitura corretamente. Para continuar o teste, tente novamente ou avance sem a leitura."
            primaryButtonText="Tentar Novamente"
            onPrimaryPress={handleNavigateBackFromGenericError}
            secondaryButtonText="Avançar com os Dados Atuais"
            onSecondaryPress={() => setCurrentState('homewip')}
          />
        );

      case 'preTestInstructions':
        return (
          <PreTestInstructions
            onBack={() => {
              if (previousState === 'homologationTemp') {
                logger.info(
                  'Voltando da tela PreTestInstructions para HomologationTemp',
                  { from: 'preTestInstructions' },
                  'navigation'
                );
                setCurrentState('homologationTemp');
              } else if (previousState === 'summaryCinomose') {
                logger.info(
                  'Voltando da tela PreTestInstructions para SummaryCinomose',
                  { from: 'preTestInstructions', to: 'summaryCinomose' },
                  'navigation'
                );
                setCurrentState('summaryCinomose');
              } else if (previousState) {
                // Se houver um previousState válido (mas não os casos acima), volta para ele
                logger.info(
                  `Voltando da tela PreTestInstructions para ${previousState}`,
                  { from: 'preTestInstructions', to: previousState },
                  'navigation'
                );
                setCurrentState(previousState as any);
              } else if (selectedWells.length > 0) {
                // Se não houver previousState mas houver wells selecionados, volta para SummaryCinomose
                logger.info(
                  'Voltando da tela PreTestInstructions para SummaryCinomose (fallback)',
                  { from: 'preTestInstructions', to: 'summaryCinomose' },
                  'navigation'
                );
                setCurrentState('summaryCinomose');
              } else {
                // Último recurso: voltar para home
                logger.info(
                  'Voltando da tela PreTestInstructions para home (fallback)',
                  { from: 'preTestInstructions', to: 'homewip' },
                  'navigation'
                );
                setCurrentState('homewip');
              }
            }}
            onGoHome={() => {
              logger.info(
                'Navegando para home da tela PreTestInstructions',
                { from: 'preTestInstructions' },
                'navigation'
              );
              setCurrentState('homewip');
            }}
            onOpenHistory={handleNavigateToTestHistory}
            title="Quase lá!"
            subtitle="Antes de iniciar, confira as orientações de operação:"
            steps={[
              'Abra a tampa.',
              'Retire a bandeja e apoie em uma superfície limpa, plana e firme.',
              'Encaixe na bandeja os tubos com a reação do teste escolhido.',
              'Abra apenas o tubo que vai receber a amostra, de acordo com a sequência definida no passo anterior.',
              'Adicione a amostra.',
              'Feche o tubo.',
              'Repita o processo a cada amostra.',
            ]}
            onPressTutorial={() => {
              logger.info(
                'Tutorial solicitado',
                { from: 'preTestInstructions' },
                'navigation'
              );
              navigateToState('videotutorial');
            }}
            onStart={() => {
              logger.info(
                'Iniciando pipetagem',
                { from: 'preTestInstructions' },
                'test'
              );
              navigateToState('pipettingInProgress');
            }}
            showTemperature={true}
            temperatureLabel="TEMPERATURA DO EQUIPAMENTO"
            temperatureValue="63ºC"
            onCloseTemperature={() => {
              logger.info(
                'Pop-up de temperatura fechado',
                { from: 'preTestInstructions' },
                'ui'
              );
            }}
            showDontShowAgain={true}
            onPressDontShowAgain={() => {
              logger.info(
                'Não mostrar novamente selecionado',
                { from: 'preTestInstructions' },
                'ui'
              );
            }}
          />
        );

      case 'homologationTemp':
        return (
          <HomologationTemp
            onBack={() => {
              logger.info(
                'Voltando da tela de homologação',
                { from: 'homologationTemp' },
                'navigation'
              );
              setCurrentState('login');
            }}
            onGoHome={() => {
              logger.info(
                'Navegando para home da tela de homologação',
                { from: 'homologationTemp' },
                'navigation'
              );
              setCurrentState('homewip');
            }}
            onNavigateToTestHistory={() => {
              logger.info(
                'Navegando para TestHistory da tela de homologação',
                { from: 'homologationTemp' },
                'navigation'
              );
              navigateToState('testhistory');
            }}
            onNavigateToGenericError={() => {
              logger.info(
                'Navegando para GenericErrorView da tela de homologação',
                { from: 'homologationTemp' },
                'navigation'
              );
              navigateToState('genericError');
            }}
            onNavigateToPopUpBluetooth={() => {
              logger.info(
                'Testando PopUpRequestBluetooth da tela de homologação',
                { from: 'homologationTemp' },
                'navigation'
              );
              // Para o PopUpRequestBluetooth, vamos simular o comportamento do HomeScreen
              Alert.alert(
                'PopUp Request Bluetooth',
                'Este popup será exibido quando necessário. Para testar, vá para a tela Home e clique em "Testar BLE".'
              );
            }}
            onNavigateToAvailableTests={() => {
              logger.info(
                'Navegando para AvailableTests da tela de homologação',
                { from: 'homologationTemp' },
                'navigation'
              );
              navigateToState('availabletests');
            }}
            onNavigateToSelectWells={() => {
              logger.info(
                'Navegando para SelectWells da tela de homologação',
                { from: 'homologationTemp' },
                'navigation'
              );
              navigateToState('selectWells');
            }}
            onNavigateToPreTestInstructions={() => {
              logger.info(
                'Navegando para PreTestInstructions da tela de homologação',
                { from: 'homologationTemp' },
                'navigation'
              );
              navigateToState('preTestInstructions');
            }}
            onNavigateToTestInProgress={() => {
              logger.info(
                'Navegando para TestInProgress da tela de homologação',
                { from: 'homologationTemp' },
                'navigation'
              );
              navigateToState('testInProgress');
            }}
            onNavigateToSampleIdentification={() => {
              logger.info(
                'Navegando para SampleIdentificationScreen da tela de homologação',
                { from: 'homologationTemp' },
                'navigation'
              );
              navigateToState('sampleIdentification');
            }}
          />
        );

      case 'selectWells':
        return (
          <SelectWells
            onBack={() => {
              if (previousState === 'homologationTemp') {
                logger.info(
                  'Voltando da tela SelectWells para HomologationTemp',
                  { from: 'selectWells' },
                  'navigation'
                );
                setCurrentState('homologationTemp');
              } else if (previousState === 'availabletests') {
                logger.info(
                  'Voltando da tela SelectWells para AvailableTests',
                  { from: 'selectWells', to: 'availabletests' },
                  'navigation'
                );
                setCurrentState('availabletests');
              } else {
                logger.info(
                  'Voltando da tela SelectWells',
                  { from: 'selectWells', to: 'login' },
                  'navigation'
                );
                setCurrentState('login');
              }
            }}
            onGoHome={() => {
              logger.info(
                'Navegando para home da tela SelectWells',
                { from: 'selectWells' },
                'navigation'
              );
              setCurrentState('homewip');
            }}
            onOpenHistory={handleNavigateToTestHistory}
            title={selectedTest?.name || 'Cinomose'}
            subtitle="Selecione a quantidade de amostras que serão utilizadas no teste."
            totalWells={16}
            columns={4}
            initiallySelected={[]}
            onConfirm={selected => {
              logger.info(
                'Poços selecionados',
                { selected, from: 'selectWells' },
                'test'
              );

              // Salvar os números selecionados para usar na identificação
              const wellsData = selected.map(num => ({
                num,
                id: `Amostra-${num.toString().padStart(2, '0')}`, // ID padrão temporário
              }));

              setSelectedWells(wellsData);
              // Navegar para SampleIdentificationScreen com o número de amostras
              navigateToState('sampleIdentification');
            }}
            initialTempC={31}
            tempLabel="TEMPERATURA DO EQUIPAMENTO"
            tempMessage="O equipamento está sendo aquecido para a execução do teste."
            startExpandedPill={true}
          />
        );

      case 'summaryCinomose':
        return (
          <SummaryCinomose
            onBack={() => {
              if (previousState) {
                logger.info(
                  'Voltando da tela SummaryCinomose para ' + previousState,
                  { from: 'summaryCinomose', to: previousState },
                  'navigation'
                );
                setCurrentState(previousState as any);
              } else {
                logger.info(
                  'Voltando da tela SummaryCinomose - sem estado anterior',
                  { from: 'summaryCinomose', to: 'login' },
                  'navigation'
                );
                setCurrentState('login');
              }
            }}
            onGoHome={() => {
              logger.info(
                'Navegando para home da tela SummaryCinomose',
                { from: 'summaryCinomose' },
                'navigation'
              );
              setCurrentState('homewip');
            }}
            onOpenHistory={handleNavigateToTestHistory}
            title={selectedTest?.name || 'Cinomose'}
            wells={selectedWells}
            wellsCardWidth={320}
            wellsCardMinHeight={120}
            tubeSize={{ width: 26, height: 50 }}
            cellVGap={12}
            cellHGap={14}
            onConfirm={wells => {
              logger.info(
                'Confirmação de amostras',
                { wells, from: 'summaryCinomose' },
                'test'
              );
              // Atualizar os wells com os IDs confirmados
              setSelectedWells(wells);
              // Navegar para PreTestInstructions
              navigateToState('preTestInstructions');
            }}
          />
        );

      case 'testInProgress': {
        // Calcular duração em segundos a partir do perfil do teste selecionado
        const calculateDuration = (): number => {
          if (selectedTest?.profile?.totalTime) {
            const { minutes, seconds } = selectedTest.profile.totalTime;
            return minutes * 60 + seconds;
          }
          // Fallback: 120 segundos (2 minutos) se não houver perfil
          return 120;
        };

        const durationSec = calculateDuration();

        return (
          <TestInProgress
            durationSec={durationSec}
            title={`Teste em\nAndamento`}
            statusLabel="Aguarde"
            statusMessage={`Processando resultados\ndo teste...`}
            onBack={() => {
              if (previousState) {
                logger.info(
                  'Voltando da tela TestInProgress para ' + previousState,
                  { from: 'testInProgress', to: previousState },
                  'navigation'
                );
                setCurrentState(previousState as any);
              } else {
                logger.info(
                  'Voltando da tela TestInProgress - sem estado anterior',
                  { from: 'testInProgress', to: 'login' },
                  'navigation'
                );
                setCurrentState('login');
              }
            }}
            onGoHome={() => {
              logger.info(
                'Navegando para home da tela TestInProgress',
                { from: 'testInProgress' },
                'navigation'
              );
              setCurrentState('homewip');
            }}
            onComplete={() => {
              logger.info(
                'Teste finalizado',
                { from: 'testInProgress', to: 'resultsScreen' },
                'test'
              );
              // Gerar resultados aleatórios baseados nas amostras selecionadas
              const samples: SampleItem[] =
                selectedWells.length > 0
                  ? selectedWells.map((well, index) => {
                      if (index === 0) {
                        return { id: well.id, type: 'controle-negativo' };
                      } else if (index === 1) {
                        return { id: well.id, type: 'controle-positivo' };
                      } else {
                        return { id: well.id, type: 'amostra' };
                      }
                    })
                  : [];
              const results = generateRandomResults(samples, selectedWells);
              setCurrentTestResults(results);
              navigateWithoutUpdatingPrevious('resultsScreen');
            }}
            showFinishButton={true}
            onFinishNow={() => {
              logger.info(
                'Teste finalizado manualmente',
                { from: 'testInProgress', to: 'resultsScreen' },
                'test'
              );
              // Gerar resultados aleatórios baseados nas amostras selecionadas
              const samples: SampleItem[] =
                selectedWells.length > 0
                  ? selectedWells.map((well, index) => {
                      if (index === 0) {
                        return { id: well.id, type: 'controle-negativo' };
                      } else if (index === 1) {
                        return { id: well.id, type: 'controle-positivo' };
                      } else {
                        return { id: well.id, type: 'amostra' };
                      }
                    })
                  : [];
              const results = generateRandomResults(samples, selectedWells);
              setCurrentTestResults(results);
              navigateWithoutUpdatingPrevious('resultsScreen');
            }}
          />
        );
      }

      case 'resultsScreen': {
        // Função para carregar resultados (gera aleatórios se não houver)
        const loadResults = async (): Promise<AmostraResultado[]> => {
          if (currentTestResults && currentTestResults.length > 0) {
            return currentTestResults;
          }
          // Fallback: gerar resultados baseados em selectedWells
          const samples: SampleItem[] =
            selectedWells.length > 0
              ? selectedWells.map((well, index) => {
                  if (index === 0) {
                    return { id: well.id, type: 'controle-negativo' };
                  } else if (index === 1) {
                    return { id: well.id, type: 'controle-positivo' };
                  } else {
                    return { id: well.id, type: 'amostra' };
                  }
                })
              : [];
          const results = generateRandomResults(samples, selectedWells);
          setCurrentTestResults(results);
          return results;
        };

        return (
          <ResultsScreen
            loadResults={loadResults}
            onBack={() => {
              logger.info(
                'Voltando da tela ResultsScreen para TestInProgress',
                { from: 'resultsScreen', to: 'testInProgress' },
                'navigation'
              );
              setCurrentState('testInProgress');
            }}
            onGoHome={() => {
              logger.info(
                'Navegando para home da tela ResultsScreen',
                { from: 'resultsScreen' },
                'navigation'
              );
              setCurrentState('homewip');
            }}
            onOpenHistory={handleNavigateToTestHistory}
            onConcluir={() => {
              logger.info(
                'Resultados concluídos',
                { from: 'resultsScreen' },
                'test'
              );

              // Salvar no histórico
              if (
                currentTestResults &&
                currentTestResults.length > 0 &&
                selectedTest
              ) {
                const operatorName = currentUser || 'Usuário';
                const timestamp = new Date().toISOString();

                // Determinar resultado geral (maioria ou primeiro resultado positivo/inconclusivo)
                const positiveCount = currentTestResults.filter(
                  r => r.status === 'Positiva'
                ).length;
                const inconclusiveCount = currentTestResults.filter(
                  r => r.status === 'Inconclusiva'
                ).length;

                let overallResult: 'Positivo' | 'Negativo' | 'Inconclusivo' =
                  'Negativo';
                if (positiveCount > 0) {
                  overallResult = 'Positivo';
                } else if (inconclusiveCount > 0) {
                  overallResult = 'Inconclusivo';
                }

                // Criar entrada no histórico
                testDataService.addTest({
                  testType: selectedTest.testKey,
                  testLabel: selectedTest.name,
                  timestamp,
                  operator: operatorName,
                  animalName: `Teste ${currentTestResults.length} amostras`,
                  animalSpecies: 'Múltiplas',
                  result: overallResult,
                  notes: `Teste realizado com ${currentTestResults.length} amostras.`,
                  amostras: currentTestResults,
                });

                Alert.alert('Sucesso', 'Resultados salvos com sucesso!');
              } else {
                Alert.alert('Aviso', 'Nenhum resultado para salvar.');
              }

              // Limpar resultados e voltar para home
              setCurrentTestResults(null);
              setCurrentState('homewip');
            }}
          />
        );
      }

      case 'pipettingInProgress': {
        // Converter selectedWells para SampleItem[] ou usar dados mock
        const samples: SampleItem[] =
          selectedWells.length > 0
            ? selectedWells.map((well, index) => {
                // Primeiros 2 são controles, resto são amostras
                if (index === 0) {
                  return { id: well.id, type: 'controle-negativo' };
                } else if (index === 1) {
                  return { id: well.id, type: 'controle-positivo' };
                } else {
                  return { id: well.id, type: 'amostra' };
                }
              })
            : [
                // Dados mock caso não tenha selectedWells
                // Total de 12 samples para corresponder ao padrão de 12 pipes preenchidos
                { id: 'CN-01', type: 'controle-negativo' },
                { id: 'CP-01', type: 'controle-positivo' },
                { id: 'ID-123', type: 'amostra' },
                { id: 'ID-234', type: 'amostra' },
                { id: 'ID-345', type: 'amostra' },
                { id: 'ID-456', type: 'amostra' },
                { id: 'ID-567', type: 'amostra' },
                { id: 'ID-678', type: 'amostra' },
                { id: 'ID-789', type: 'amostra' },
                { id: 'ID-890', type: 'amostra' },
                { id: 'ID-901', type: 'amostra' },
                { id: 'ID-012', type: 'amostra' },
              ];

        return (
          <PipettingInProgress
            samples={samples}
            {...(selectedWells.length > 0 && {
              wellNumbers: selectedWells.map(well => well.num),
              wellsInfo: selectedWells,
            })}
            filledPipesCount={filledPipesCount} // Quantidade de pipes preenchidos (0-16)
            renderHeader={
              <AppHeader
                {...(previousState && {
                  onBack: () => {
                    logger.info(
                      'Voltando da tela PipettingInProgress para ' +
                        previousState,
                      { from: 'pipettingInProgress', to: previousState },
                      'navigation'
                    );
                    setCurrentState(previousState as any);
                  },
                })}
                {...{
                  onOpenHistory: handleNavigateToTestHistory,
                  onGoHome: () => {
                    logger.info(
                      'Navegando para home da tela PipettingInProgress',
                      { from: 'pipettingInProgress' },
                      'navigation'
                    );
                    setCurrentState('homewip');
                  },
                }}
              />
            }
            renderFooter={<BottomBar fixed />}
            onStartPress={() => {
              logger.info(
                'Iniciando teste da pipetagem',
                { from: 'pipettingInProgress', to: 'testInProgress' },
                'test'
              );
              navigateWithoutUpdatingPrevious('testInProgress');
            }}
          />
        );
      }

      case 'sampleIdentification':
        return (
          <SampleIdentificationScreen
            totalTubes={selectedWells.length}
            initialIndex={0}
            wellNumbers={selectedWells.map(well => well.num)}
            onFinish={labels => {
              logger.info(
                'Identificação de amostras finalizada',
                { labels, from: 'sampleIdentification' },
                'test'
              );

              // Converter os labels identificados para o formato de wells
              // Associar cada label ao poço correspondente na ordem selecionada
              const identifiedWells = selectedWells.map((well, index) => ({
                num: well.num,
                id: labels[index] || well.id, // Usa o label identificado ou o ID padrão
              }));

              setSelectedWells(identifiedWells);

              // Navegar para SummaryCinomose após identificar todas as amostras
              navigateToState('summaryCinomose');
            }}
            onCancelBack={() => {
              logger.info(
                'Voltando da tela de identificação de amostras',
                { from: 'sampleIdentification' },
                'navigation'
              );
              if (previousState === 'selectWells') {
                navigateToState('selectWells');
              } else if (previousState === 'homologationTemp') {
                navigateToState('homologationTemp');
              } else {
                navigateToState('homewip');
              }
            }}
            onGoHome={() => {
              logger.info(
                'Navegando para home da tela de identificação de amostras',
                { from: 'sampleIdentification' },
                'navigation'
              );
              navigateToState('homewip');
            }}
            onOpenHistory={handleNavigateToTestHistory}
          />
        );

      case 'profileManagement':
        return (
          <ProfileManagementScreen
            onNavigateBack={() => setCurrentState('admin')}
          />
        );

      default:
        logger.error(
          'Estado de tela desconhecido',
          {
            currentState,
            timestamp: new Date().toISOString(),
          },
          'app'
        );
        return (
          <View style={styles.container}>
            <Text style={styles.title}>Erro</Text>
          </View>
        );
    }
  };

  

  // Componente interno que usa hooks do Clerk
  const AppContent: React.FC = () => {
    return (
      <NavigationProvider
        currentState={currentState as any}
        previousState={previousState}
        setCurrentState={(state) => setCurrentState(state as any)}
        setPreviousState={setPreviousState}
      >
        <View style={styles.container}>{renderScreen()}</View>
      </NavigationProvider>
    );
  };


  return (
    <ClerkProvider>
      <AppContent />
    </ClerkProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});
