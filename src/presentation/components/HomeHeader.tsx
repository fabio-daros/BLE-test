// HomeHeader.tsx - Componente de header específico para a tela Home
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { AntDesign, MaterialCommunityIcons } from '@/utils/vector-icons-helper';
import { colors } from '@presentation/theme';

interface Props {
  onBack?: (() => void) | undefined;
  onGoHome?: (() => void) | undefined;
  onOpenHistory?: (() => void) | undefined;
  onOpenBluetooth?: (() => void) | undefined;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  showHistoryButton?: boolean;
  showBluetoothButton?: boolean;
  backButtonText?: string;
}

export const HomeHeader: React.FC<Props> = ({
  onBack,
  onGoHome,
  onOpenHistory,
  onOpenBluetooth,
  showBackButton = true,
  showHomeButton = true,
  showHistoryButton = true,
  showBluetoothButton = false,
  backButtonText = 'Voltar',
}) => {
  return (
    <View style={styles.header}>
      {/* Botão Voltar */}
      {showBackButton && onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backPill}>
          <AntDesign name="left" size={16} color={colors.gold} />
          <Text style={styles.backText}>{backButtonText}</Text>
        </TouchableOpacity>
      )}

      {/* Espaçador quando não há botão voltar */}
      {!showBackButton && <View style={styles.spacer} />}

      {/* Botões da direita */}
      <View style={styles.headerRight}>
        {showBluetoothButton && onOpenBluetooth && (
          <TouchableOpacity style={styles.headerBtn} onPress={onOpenBluetooth}>
            <MaterialCommunityIcons
              name="bluetooth"
              size={18}
              color={colors.gold}
            />
          </TouchableOpacity>
        )}
        {showHistoryButton && onOpenHistory && (
          <TouchableOpacity style={styles.headerBtn} onPress={onOpenHistory}>
            <MaterialCommunityIcons
              name="history"
              size={18}
              color={colors.gold}
            />
          </TouchableOpacity>
        )}
        {showHomeButton && onGoHome && (
          <TouchableOpacity style={styles.headerBtn} onPress={onGoHome}>
            <AntDesign name="home" size={18} color={colors.gold} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.goldBackground,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },

  backText: {
    color: colors.gold,
    fontWeight: '600',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 70,
  },
  spacer: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerBtn: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});

export default HomeHeader;
