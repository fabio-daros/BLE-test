// src/ui/tokens.ts
// DEPRECATED: Use @presentation/theme instead
// Mantido apenas para compatibilidade com código legado
// TODO: Migrar todos os usos para @presentation/theme
import { colors } from '@presentation/theme';

export const COLORS = {
  bg: colors.backgroundGrayAlt2,
  gold: colors.gold,
  white: colors.white,
  border: colors.borderAlt,
  text: colors.textPrimary,
  muted: colors.textMuted,
  inputBg: colors.white,
  progressTrack: colors.borderAlt,
  progressThumb: colors.disabledAlt2,
};

export const SP = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};
