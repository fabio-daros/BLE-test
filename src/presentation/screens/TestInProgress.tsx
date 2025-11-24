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
  /** Duração total esperada do teste em segundos (para calcular progresso) */
  durationSec: number;
  /** Tempo decorrido em segundos (vindo do hardware) - se não fornecido, usa countdown local */
  elapsedSec?: number;
  /** Temperatura atual do bloco (em graus Celsius) - opcional */
  temperature?: number | null;
  /** Título grande da tela */
  title?: string;
  /** Rótulo destacado abaixo do anel */
  statusLabel?: string;
  /** Texto auxiliar abaixo do rótulo */
  statusMessage?: string;
  /** Callbacks de navegação */
  onBack?: () => void;
  onGoHome?: () => void;
  /** Chamado automaticamente quando o contador chega a 0 ou quando elapsedSec >= durationSec */
  onComplete?: () => void;
};

// ====== Componente de Anel com Contador Progressivo/Regressivo ======
const CircularCountdown = ({
  size = 220,
  stroke = 18,
  durationSec,
  elapsedSec,
  onTick,
  onComplete,
}: {
  size?: number;
  stroke?: number;
  durationSec: number;
  elapsedSec?: number; // Se fornecido, usa tempo decorrido do hardware (progressivo)
  onTick?: (_elapsed: number) => void;
  onComplete?: () => void;
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Se elapsedSec for fornecido, usa tempo decorrido (progressivo)
  // Caso contrário, usa countdown local (regressivo)
  const useElapsedTime = elapsedSec !== undefined;
  
  const [localRemaining, setLocalRemaining] = useState(durationSec);
  
  // Tempo atual: se usar elapsedSec do hardware, usa ele; senão, calcula do countdown local
  const currentElapsed = useElapsedTime 
    ? (elapsedSec ?? 0)
    : durationSec - localRemaining;
  
  const progress = Math.min(1, currentElapsed / durationSec); // 0→1 (progresso)
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevElapsedRef = useRef(currentElapsed);
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);

  // Atualizar refs quando callbacks mudarem
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onTickRef.current = onTick;
  }, [onComplete, onTick]);

  // Se usar elapsedSec do hardware, não precisa de intervalo local
  // Caso contrário, mantém countdown local
  useEffect(() => {
    if (useElapsedTime) {
      // Usando tempo do hardware - limpar intervalo se existir
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Countdown local (fallback)
    setLocalRemaining(durationSec);
    prevElapsedRef.current = 0;

    // Limpar intervalo anterior se existir
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setLocalRemaining(prev => {
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
  }, [durationSec, useElapsedTime]);

  // Dispara callbacks quando elapsed muda
  useEffect(() => {
    // Não disparar callbacks se o valor não mudou realmente
    if (prevElapsedRef.current === currentElapsed) {
      return;
    }

    // Atualizar ref antes de chamar callbacks
    const currentElapsedValue = currentElapsed;

    // Usar setTimeout para garantir que callbacks sejam chamados após renderização
    setTimeout(() => {
      onTickRef.current?.(currentElapsedValue);
      if (currentElapsedValue >= durationSec) {
        onCompleteRef.current?.();
      }
    }, 0);

    prevElapsedRef.current = currentElapsed;
  }, [currentElapsed, durationSec]);

  const dashOffset = useMemo(
    () => circumference * (1 - progress),
    [progress, circumference]
  );

  // Formatar tempo: mostrar tempo decorrido (progressivo)
  const totalSeconds = currentElapsed;
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');

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
  elapsedSec,
  temperature,
  title = `Teste em\nAndamento`,
  statusLabel = 'Aguarde',
  statusMessage = 'Avisaremos quando teste\nfor finalizado.',
  onBack,
  onGoHome,
  onComplete,
}) => {
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header padrão do projeto */}
      <AppHeader {...(onGoHome && { onGoHome })} />

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
          elapsedSec={elapsedSec}
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
        {/* Temperatura */}
        {temperature !== null && temperature !== undefined && (
          <Text style={styles.temperatureText}>
            🌡️ {temperature >= 0 ? '+' : ''}{temperature.toFixed(1)}°C
          </Text>
        )}
      </View>

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
  temperatureText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gold,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default TestInProgress;
