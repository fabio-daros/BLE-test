/**
 * Sistema de Cores Centralizado
 *
 * Todas as cores do sistema devem ser importadas deste arquivo.
 * Nomes normalizados seguem padrão semântico para facilitar manutenção.
 */

// ====== CORES PRIMÁRIAS ======
export const colors = {
  // Cores principais da marca
  primary: '#007AFF',
  secondary: '#5856D6',

  // Dourado (cor principal do tema)
  gold: '#B38422',
  goldDark: '#A8853D', // usado em PopUpRequestBluetooth
  goldAlt: '#B5852B', // usado em SampleIdentificationScreen
  goldAlt2: '#C5A052', // usado em PipettingInProgress
  goldAlt3: '#D4AF37', // usado em SimulatorControlsScreen
  goldLight: '#e9d7a6',
  goldSoft: '#E8D6A8',
  goldBackground: '#fcf5e6',
  goldBackgroundAlt2: '#efe6cf',
  goldBackgroundAlt: '#FFF8E1', // usado em SimulatorControlsScreen

  // ====== CORES DE STATUS ======
  success: '#34C759',
  successAlt: '#16a34a', // verde para resultados positivos
  successAlt2: '#10b981', // usado em AdminPanel e ProfileManagement

  error: '#FF3B30',
  errorAlt: '#ef4444', // vermelho para resultados negativos
  errorAlt2: '#dc2626', // usado em TestHistory

  warning: '#FF9500',
  warningAlt: '#f59e0b', // âmbar para resultados inconclusivos

  // ====== CORES DE TEXTO ======
  text: '#000000',
  textPrimary: '#1f2937', // texto principal escuro
  textDark: '#374151', // texto escuro alternativo
  textDarkAlt: '#3A3A3A', // usado em SampleIdentificationScreen
  textMedium: '#4A4A4A', // usado em PipettingInProgress
  textSecondary: '#8E8E93',
  textMuted: '#6b7280', // texto secundário padrão
  textMutedAlt: '#333333', // texto secundário escuro (PopUpRequestBluetooth)
  textMutedAlt2: '#6F6F6F', // usado em SampleIdentificationScreen
  textMutedAlt3: '#6E6E6E', // usado em PipettingInProgress
  textMutedAlt4: '#4b5563', // TEXT_700 em ResultsScreen
  textMutedAlt5: '#8a8a8a', // usado em TemperaturePill
  textMutedAlt6: '#9aa1aa', // usado em SummaryCinomose
  textMutedAlt7: '#9ca3af', // usado em SelectWells

  // ====== CORES DE FUNDO ======
  background: '#FFFFFF',
  backgroundAlt: '#F2F2F7', // surface
  backgroundGray: '#f3f4f6', // fundo cinza padrão
  backgroundGrayAlt: '#f8fafc', // fundo cinza claro alternativo
  backgroundGrayAlt2: '#f9f9f9', // usado em tokens.ts
  backgroundBeige: '#faf8f3', // BEIGE_BG
  backgroundWarm: '#F1F0EE', // usado em SampleIdentificationScreen
  backgroundWarmAlt: '#F5F4F2', // usado em PipettingInProgress

  // ====== CORES DE SUPERFÍCIE/CARD ======
  card: '#ffffff',
  surface: '#F2F2F7',

  // ====== CORES DE BORDA ======
  border: '#C6C6C8',
  borderAlt: '#e5e7eb', // borda padrão
  borderAlt2: '#cbd5e1', // usado em AvailableTests
  borderAlt3: '#E1DFDC', // usado em SampleIdentificationScreen
  borderAlt4: '#D3D1CF', // grayLine em SampleIdentificationScreen
  borderAlt5: '#D9D6CD', // line em PipettingInProgress
  borderBlue: '#3b82f6', // BLUE_BORDER
  borderGold: '#f1e7cf', // borda dourada clara
  borderGoldAlt: '#dfe3ea', // usado em SummaryCinomose
  goldAlt4: '#b8860b',

  // ====== CORES DE LINK ======
  link: '#6b7db1',

  // ====== CORES DE ESTADO ======
  disabled: '#e5e7eb',
  disabledAlt: '#CFCBC5', // usado em SampleIdentificationScreen
  disabledAlt2: '#d1d5db', // usado em tokens.ts e LoginScreenWip

  // ====== CORES DE INDICADORES ======
  indicatorGray: '#CCCCCC', // usado em PopUpRequestBluetooth
  ringBackground: '#e8ecf4', // RING_BG usado em TestInProgress

  // ====== CORES DE SOMBRA ======
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowAlt: 'rgba(0, 0, 0, 0.25)', // usado em PopUpRequestBluetooth
  shadowAlt2: 'rgba(0, 0, 0, 0.3)', // usado em PreTestInstructions
  shadowAlt3: 'rgba(0, 0, 0, 0.4)', // usado em modais
  shadowAlt4: '#00000022', // usado em PipettingInProgress
  shadowAlt5: 'rgba(0,0,0,0.6)', // usado em VideoTutorial
  shadowColor: '#000', // cor base para sombras

  // ====== CORES ESPECIAIS ======
  white: '#ffffff',
  black: '#000000',
  googleRed: '#DB4437', // usado em LoginScreenWip
  successGreenLight: 'rgba(16, 185, 129, 0.05)', // usado em SimulatorControlsScreen
};

// ====== ALIASES PARA COMPATIBILIDADE ======
// Mantidos para facilitar migração gradual
export const COLORS = colors;

// ====== EXPORTAÇÕES POR CATEGORIA (opcional, para facilitar uso) ======
export const brandColors = {
  gold: colors.gold,
  goldDark: colors.goldDark,
  goldLight: colors.goldLight,
  goldBackground: colors.goldBackground,
};

export const statusColors = {
  success: colors.success,
  successAlt: colors.successAlt,
  error: colors.error,
  errorAlt: colors.errorAlt,
  warning: colors.warning,
  warningAlt: colors.warningAlt,
};

export const textColors = {
  primary: colors.textPrimary,
  dark: colors.textDark,
  muted: colors.textMuted,
  secondary: colors.textSecondary,
};

export const backgroundColors = {
  default: colors.background,
  gray: colors.backgroundGray,
  beige: colors.backgroundBeige,
  warm: colors.backgroundWarm,
};
