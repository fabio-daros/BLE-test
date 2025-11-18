import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { AppHeader } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import { colors } from '@presentation/theme';

// ====== Tipos ======
export type TestInProgressProps = {
  /** Duração total do teste em segundos (controla o countdown) */
  durationSec: number;
  /** Título grande da tela */
  title?: string;
  /** Rótulo destacado abaixo do anel */
  statusLabel?: string;
  /** Texto auxiliar abaixo do rótulo */
  statusMessage?: string;
  /** Callbacks de navegação */
  onBack?: () => void;
  onGoHome?: () => void;
  /** Chamado automaticamente quando o contador chega a 0 */
  onComplete?: () => void;
  /** Botão para finalizar imediatamente (para testes) */
  showFinishButton?: boolean; // default true
  onFinishNow?: () => void;
};

// ====== Componente de Anel com Contador Regressivo ======
const CircularCountdown = ({
  size = 220,
  stroke = 18,
  durationSec,
  onTick,
  onComplete,
}: {
  size?: number;
  stroke?: number;
  durationSec: number;
  onTick?: (_remaining: number) => void;
  onComplete?: () => void;
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Progresso de 0 → 1
  const [remaining, setRemaining] = useState(durationSec);
  const progress = 1 - remaining / durationSec; // 0→1
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRemainingRef = useRef(durationSec);
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);

  // Atualizar refs quando callbacks mudarem
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onTickRef.current = onTick;
  }, [onComplete, onTick]);

  // Atualiza a cada segundo
  useEffect(() => {
    setRemaining(durationSec);
    prevRemainingRef.current = durationSec;

    // Limpar intervalo anterior se existir
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        const next = Math.max(0, prev - 1);

        // Se chegou a 0, limpar o intervalo no próximo tick
        if (next === 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [durationSec]);

  // Dispara callbacks quando remaining muda (fora do setState)
  useEffect(() => {
    // Não disparar callbacks se o valor não mudou realmente
    if (prevRemainingRef.current === remaining) {
      return;
    }

    // Atualizar ref antes de chamar callbacks
    const currentRemaining = remaining;

    // Usar setTimeout para garantir que callbacks sejam chamados após renderização
    // Isso evita o warning de atualizar estado durante renderização
    setTimeout(() => {
      onTickRef.current?.(currentRemaining);
      if (currentRemaining === 0) {
        onCompleteRef.current?.();
      }
    }, 0);

    prevRemainingRef.current = remaining;
  }, [remaining]);

  const dashOffset = useMemo(
    () => circumference * (1 - progress),
    [progress, circumference]
  );

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient
            id="goldGradient"
            x1="0"
            y1="0"
            x2={String(size)}
            y2={String(size)}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={colors.goldLight} />
            <Stop offset="100%" stopColor={colors.gold} />
          </LinearGradient>
        </Defs>
        {/* trilho */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.ringBackground}
          strokeWidth={stroke}
          fill="none"
        />
        {/* progresso */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#goldGradient)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={styles.clockText}>
        {mm}:{ss}
      </Text>
    </View>
  );
};

// ====== Tela ======
const TestInProgress: React.FC<TestInProgressProps> = ({
  durationSec,
  title = `Teste em\nAndamento`,
  statusLabel = 'Aguarde',
  statusMessage = 'Avisaremos quando o\nteste for finalizado.',
  onBack,
  onGoHome,
  onComplete,
  showFinishButton = true,
  onFinishNow,
}) => {
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header padrão do projeto */}
      <AppHeader {...(onBack && { onBack })} {...(onGoHome && { onGoHome })} />

      {/* Título */}
      <View style={styles.titleWrap}>
        {title.split('\n').map((line, i) => (
          <Text key={i} style={[styles.title, i > 0 && { marginTop: 2 }]}>
            {line}
          </Text>
        ))}
      </View>

      {/* Anel + relógio */}
      <View style={styles.centerWrap}>
        <CircularCountdown
          durationSec={durationSec}
          {...(onComplete && { onComplete })}
        />
      </View>

      {/* Mensagem */}
      <View style={styles.statusWrap}>
        <Text style={styles.statusLabel}>{statusLabel}</Text>
        {statusMessage.split('\n').map((line, i) => (
          <Text key={i} style={styles.statusMessage}>
            {line}
          </Text>
        ))}
      </View>

      {/* Botão Finalizar (visibilidade controlável) */}
      {showFinishButton && (
        <View style={styles.finishWrap}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Finalizar teste agora"
            onPress={onFinishNow}
            style={styles.finishBtn}
            activeOpacity={0.9}
          >
            <Text style={styles.finishText}>Finalizar</Text>
          </TouchableOpacity>
        </View>
      )}

      <BottomBar fixed />
    </SafeAreaView>
  );
};

// ====== Estilos ======
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGray },
  titleWrap: {
    paddingTop: 12,
    alignItems: 'center',
    flexDirection: 'column',
    marginTop: 25,
    marginBottom: 25,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textDark,
  },
  centerWrap: { alignItems: 'center', marginTop: 26 },
  clockText: {
    position: 'absolute',
    fontSize: 28,
    fontWeight: '800',
    color: colors.textDark,
  },
  statusWrap: {
    alignItems: 'center',
    marginTop: 50,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.gold,
    marginBottom: 6,
  },
  statusMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
  finishWrap: { paddingHorizontal: 20, marginTop: 28 },
  finishBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});

export default TestInProgress;
