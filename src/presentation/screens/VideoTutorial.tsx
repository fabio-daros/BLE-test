// VideoTutorial.tsx
import React, { useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
// Substituído expo-av por react-native-video
// @ts-ignore - react-native-video pode não ter tipos completos
import Video from 'react-native-video';

// Tipos locais para react-native-video
interface OnLoadData {
  duration: number;
  naturalSize: { width: number; height: number };
}

interface OnProgressData {
  currentTime: number;
  playableDuration: number;
  seekableDuration: number;
}
import { AppHeader } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import { AntDesign } from '@/utils/vector-icons-helper';
import { colors } from '@presentation/theme';

interface Props {
  onBack?: () => void; // → volta para Home
  onGoHome?: () => void; // → vai para Home
  onOpenHistory?: () => void; // → abre histórico
}

const VideoTutorial: React.FC<Props> = ({
  onBack,
  onGoHome,
  onOpenHistory,
}) => {
  const videoRef = useRef<Video>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [didJustFinish, setDidJustFinish] = useState(false);

  const restartVideo = () => {
    if (videoRef.current) {
      videoRef.current.seek(0);
      setPaused(false);
      setDidJustFinish(false);
    }
  };

  const togglePlayPause = () => {
    if (didJustFinish) {
      // Se o vídeo terminou, reiniciar do início
      restartVideo();
    } else {
      setPaused(!paused);
    }
  };

  const onLoad = (data: OnLoadData) => {
    setDuration(data.duration * 1000); // Converter para millisegundos
    setLoading(false);
    setError(false);
  };

  const onProgress = (data: OnProgressData) => {
    setCurrentTime(data.currentTime * 1000); // Converter para millisegundos
  };

  const onEnd = () => {
    setDidJustFinish(true);
    setPaused(true);
    setCurrentTime(duration);
  };

  const onError = () => {
    setError(true);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header com 3 botões */}
      <AppHeader
        {...(onBack && { onBack })}
        {...(onGoHome && { onGoHome })}
        {...(onOpenHistory && { onOpenHistory })}
      />

      {/* Container do Player */}
      <View style={styles.playerContainer}>
        {/* Botão X para fechar pop-up */}
        <TouchableOpacity style={styles.closeBtn} onPress={onBack}>
          <AntDesign name="close" size={20} color={colors.gold} />
        </TouchableOpacity>

        {error ? (
          <Text style={styles.errorText}>
            Não foi possível carregar o vídeo.
          </Text>
        ) : (
          <>
            <Video
              ref={videoRef}
              style={styles.video}
              source={require('../../../assets/INpunto_Video_V3.mp4')}
              resizeMode="contain"
              paused={paused}
              repeat={false}
              onLoad={onLoad}
              onProgress={onProgress}
              onEnd={onEnd}
              onError={onError}
            />

            {/* Estado carregando */}
            {loading && (
              <ActivityIndicator
                size="large"
                color={colors.gold}
                style={styles.loading}
              />
            )}

            {/* Ícone Play/Pause */}
            <TouchableOpacity
              style={styles.playOverlay}
              onPress={togglePlayPause}
              activeOpacity={0.7}
            >
              <AntDesign
                name={
                  (!paused
                    ? 'pausecircleo'
                    : didJustFinish
                      ? 'reload1'
                      : 'playcircleo') as any
                }
                size={48}
                color={colors.shadowAlt5}
              />
            </TouchableOpacity>

            {/* Barra de progresso */}
            {duration > 0 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        flex: currentTime / duration,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.progressRest,
                      {
                        flex: 1 - currentTime / duration,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.floor(currentTime / 1000 / 60)}:
                  {Math.floor((currentTime / 1000) % 60)
                    .toString()
                    .padStart(2, '0')}{' '}
                  /{Math.floor(duration / 1000 / 60)}:
                  {Math.floor((duration / 1000) % 60)
                    .toString()
                    .padStart(2, '0')}
                </Text>
              </View>
            )}
          </>
        )}
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
  playerContainer: {
    margin: 40,
    marginBottom: 60,
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 6,
    elevation: 3,
  },
  playOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 5,
  },
  loading: {
    position: 'absolute',
    alignSelf: 'center',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 10,
    left: 15,
    right: 15,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.gold,
  },
  progressRest: {
    backgroundColor: colors.disabledAlt2,
  },
  progressText: {
    color: colors.textPrimary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.8,
  },
  errorText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});

export default VideoTutorial;
