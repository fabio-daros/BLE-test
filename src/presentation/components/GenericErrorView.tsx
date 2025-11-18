import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { AppHeader } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import { AntDesign } from '@/utils/vector-icons-helper';
import { colors } from '@presentation/theme';

interface Props {
  onBack?: () => void;
  onGoHome?: () => void;

  /** Título principal (ex.: "Identificamos um Problema") */
  title?: string;

  /** Título da mensagem de erro (ex.: "Detectamos uma falha na lâmpada...") */
  errorTitle?: string;

  /** Texto descritivo abaixo do título */
  description?: string;

  /** Botão primário: texto e ação */
  primaryButtonText?: string;
  onPrimaryPress?: () => void;

  /** Botão secundário opcional */
  secondaryButtonText?: string;
  onSecondaryPress?: () => void;
}

const GenericErrorView: React.FC<Props> = ({
  onBack,
  onGoHome,
  title = 'Identificamos um Problema',
  errorTitle = 'Ocorreu um erro inesperado',
  description = 'Tente novamente ou contate o suporte se o problema persistir.',
  primaryButtonText = 'Tentar Novamente',
  onPrimaryPress,
  secondaryButtonText,
  onSecondaryPress,
}) => {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <AppHeader {...(onBack && { onBack })} {...(onGoHome && { onGoHome })} />

      <View style={styles.container}>
        {/* Título principal */}
        <Text style={styles.title}>{title}</Text>

        {/* Ícone central */}
        <View style={styles.iconCircle}>
          <AntDesign name="close" size={40} color={colors.gold} />
        </View>

        {/* Subtítulo / erro */}
        <Text style={styles.errorTitle}>{errorTitle}</Text>

        {/* Descrição */}
        {description && <Text style={styles.description}>{description}</Text>}

        {/* Botões */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onPrimaryPress}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
          </TouchableOpacity>

          {secondaryButtonText && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onSecondaryPress}
              activeOpacity={0.9}
            >
              <Text style={styles.secondaryButtonText}>
                {secondaryButtonText}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <BottomBar fixed />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundGrayAlt,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: '400',
    textAlign: 'center',
    color: colors.textPrimary,
    marginBottom: 40,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 30,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    width: '80%',
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    width: '80%',
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default GenericErrorView;
