// src/ui/AppHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AntDesign, Feather } from '@/utils/vector-icons-helper';
import { COLORS, SP } from '../../ui/tokens';

interface Props {
  onBack?: () => void;
  onHistory?: () => void;
  onHome?: () => void;
}

export const AppHeader: React.FC<Props> = ({ onBack, onHistory, onHome }) => {
  return (
    <View style={styles.container}>
      {/* Botão Voltar */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <AntDesign name="arrowleft" size={18} color={COLORS.gold} />
        <Text style={styles.backText}>Voltar</Text>
      </TouchableOpacity>

      {/* Botões da direita */}
      <View style={styles.rightGroup}>
        <TouchableOpacity style={styles.iconBtn} onPress={onHistory}>
          <Feather name="clock" size={18} color={COLORS.gold} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onHome}>
          <Feather name="home" size={18} color={COLORS.gold} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SP.sm,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  rightGroup: { flexDirection: 'row', gap: 12 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: COLORS.white,
  },
});
