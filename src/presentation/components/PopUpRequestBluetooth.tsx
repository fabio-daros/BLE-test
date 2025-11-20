// src/ui/PopUpRequestBluetooth.tsx
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import BluetoothRequestIcon from '@assets/BluetoothRequest.svg';
import { colors } from '@presentation/theme';

type Mode = 'request' | 'error' | 'devices';

interface DeviceListItem {
  id: string;
  name: string;
  rssi?: number | null;
  type?: 'ble';
}

interface Props {
  visible: boolean;
  mode?: Mode; // "request" | "error"
  onPrimary?: () => void; // Permitir / Tentar Novamente
  onClose?: () => void; // fechar por hardware/back
  loading?: boolean;
  devices?: DeviceListItem[];
  scanning?: boolean;
  connectingDeviceId?: string | null;
  connectedDeviceId?: string | null; // ID do dispositivo conectado
  infoMessage?: string | null;
  errorMessage?: string | null;
  onSelectDevice?: (deviceId: string) => void;
  onRefresh?: () => void;
}

export const PopUpRequestBluetooth: React.FC<Props> = ({
  visible,
  mode = 'request',
  onPrimary,
  onClose,
  loading = false,
  devices = [],
  scanning = false,
  connectingDeviceId = null,
  connectedDeviceId = null,
  infoMessage = null,
  errorMessage = null,
  onSelectDevice,
  onRefresh,
}) => {
  const isError = mode === 'error';
  const isDevicesMode = mode === 'devices';

  const primaryButtonLabel = useMemo(() => {
    if (isError) {
      return 'Tentar Novamente';
    }
    if (isDevicesMode) {
      return null;
    }
    return 'Permitir';
  }, [isDevicesMode, isError]);

  const renderDevice = ({
    item,
  }: ListRenderItemInfo<DeviceListItem>): React.ReactElement => {
    const isConnecting = connectingDeviceId === item.id;
    const isConnected = connectedDeviceId === item.id;
    const disabled = loading || isConnecting || isConnected;
    const handlePress = () => {
      if (!disabled && onSelectDevice) {
        onSelectDevice(item.id);
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.deviceItem,
          isConnecting && styles.deviceItemConnecting,
          isConnected && styles.deviceItemConnected,
          disabled && styles.deviceItemDisabled,
        ]}
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={disabled || !onSelectDevice}
      >
        <View style={styles.deviceInfo}>
          <View style={styles.deviceNameRow}>
            <Text style={styles.deviceName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          {typeof item.rssi === 'number' && (
            <Text style={styles.deviceSignal}>{`${item.rssi} dBm`}</Text>
          )}
        </View>
        <View style={styles.deviceStatus}>
          {isConnecting ? (
            <ActivityIndicator size="small" color={colors.gold} />
          ) : isConnected ? (
            <Text style={styles.deviceStatusLabelConnected}>Desconectar</Text>
          ) : (
            <Text style={styles.deviceStatusLabel}>Conectar</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop que bloqueia interação fora do modal */}
      {/* Só permite fechar ao clicar fora quando estiver no modo 'request' (Permissão necessária) */}
      <TouchableWithoutFeedback 
        onPress={mode === 'request' && !loading ? onClose : undefined}
        disabled={mode !== 'request' || loading}
      >
        <View style={styles.backdrop}>
          <View style={styles.cardWrapper} pointerEvents="box-none">
            <TouchableWithoutFeedback>
              <View style={styles.card} pointerEvents="auto">
                {/* Indicador no topo */}
                <View style={styles.indicator} />

                {/* Ícone Bluetooth */}
                <View style={styles.iconWrap}>
                  <BluetoothRequestIcon width={103} height={103} />
                </View>

                {/* Título */}
                <Text style={[styles.title, isError && styles.titleError]}>
                  {isError
                    ? 'A conexão falhou'
                    : isDevicesMode
                      ? 'Selecione o equipamento'
                      : 'Permissão necessária'}
                </Text>

                {/* Mensagens */}
                {isDevicesMode ? (
                  <>
                    <Text style={styles.message}>
                      Escolha o equipamento Bluetooth para conectar e iniciar a
                      análise.
                    </Text>

                    {infoMessage && (
                      <View style={styles.statusInfo}>
                        <Text style={styles.statusInfoText}>{infoMessage}</Text>
                        {scanning && (
                          <ActivityIndicator
                            size="small"
                            color={colors.gold}
                            style={styles.statusIndicator}
                          />
                        )}
                      </View>
                    )}

                    {errorMessage && (
                      <View style={styles.statusError}>
                        <Text style={styles.statusErrorText}>
                          {errorMessage}
                        </Text>
                      </View>
                    )}

                    <View style={styles.deviceListContainer}>
                      <FlatList
                        data={devices}
                        keyExtractor={item => item.id}
                        renderItem={renderDevice}
                        ListEmptyComponent={() => (
                          <View style={styles.emptyState}>
                            {scanning ? (
                              <>
                                <ActivityIndicator
                                  size="small"
                                  color={colors.gold}
                                />
                                <Text style={styles.emptyStateText}>
                                  Buscando dispositivos próximos...
                                </Text>
                              </>
                            ) : (
                              <Text style={styles.emptyStateText}>
                                Nenhum equipamento disponível. Certifique-se de
                                que o dispositivo esteja ligado e visível.
                              </Text>
                            )}
                          </View>
                        )}
                        ItemSeparatorComponent={() => (
                          <View style={styles.deviceSeparator} />
                        )}
                        contentContainerStyle={
                          devices.length === 0 ? styles.deviceListEmpty : null
                        }
                      />
                    </View>

                    {onRefresh && (
                      <TouchableOpacity
                        style={[
                          styles.secondaryBtn,
                          (scanning || loading) && styles.secondaryBtnDisabled,
                        ]}
                        onPress={onRefresh}
                        activeOpacity={0.85}
                        disabled={scanning || loading}
                      >
                        {scanning ? (
                          <ActivityIndicator size="small" color={colors.gold} />
                        ) : (
                          <Text style={styles.secondaryText}>
                            Atualizar lista
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                ) : isError ? (
                  <Text style={styles.message}>
                    Não foi possível estabelecer uma conexão Bluetooth com o
                    equipamento.{'\n\n'}
                    Verifique as permissões em seu dispositivo e tente
                    novamente.
                  </Text>
                ) : (
                  <>
                    <Text style={styles.message}>
                      O aplicativo LAMP INpunto utiliza a tecnologia Bluetooth
                      para conectar-se ao equipamento.
                    </Text>
                    <Text style={styles.message}>
                      Para continuar, é necessário conceder a permissão para
                      ativar a conexão.
                    </Text>
                    {loading && (
                      <ActivityIndicator
                        size="small"
                        color={colors.gold}
                        style={styles.statusIndicator}
                      />
                    )}
                  </>
                )}

                {/* Botões */}
                {primaryButtonLabel && onPrimary && (
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      loading && styles.primaryBtnDisabled,
                    ]}
                    onPress={onPrimary}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={primaryButtonLabel}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.primaryText}>
                        {primaryButtonLabel}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.shadowAlt,
    justifyContent: 'flex-end',
  },
  cardWrapper: {
    width: '100%',
  },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, // cantos superiores muito arredondados
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 12, // cantos inferiores ligeiramente arredondados
    borderBottomRightRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 12, // espaço menor no topo para o indicador
    paddingBottom: Platform.select({ ios: 34, android: 80 }), // safe area no iOS, espaço extra no Android para barra de navegação
    maxHeight: Platform.select({ ios: 620, android: 640, default: 640 }),
    // Removido minHeight/maxHeight para o modal ficar grudado na parte de baixo
    shadowColor: colors.shadowColor,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  indicator: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: colors.indicatorGray,
    borderRadius: 2,
    marginBottom: 16,
  },
  iconWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    color: colors.goldDark,
    fontWeight: '700',
    fontSize: 20,
    marginBottom: 16,
  },
  titleError: {
    color: colors.goldDark, // mantém o mesmo ouro do layout de falha
  },
  message: {
    textAlign: 'center',
    color: colors.textMutedAlt,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldBackground,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statusInfoText: {
    color: colors.goldDark,
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  statusIndicator: {
    marginLeft: 12,
  },
  statusError: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statusErrorText: {
    color: colors.errorAlt,
    fontSize: 14,
    textAlign: 'center',
  },
  deviceListContainer: {
    maxHeight: 260,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    borderRadius: 14,
    paddingVertical: 6,
    marginBottom: 16,
    backgroundColor: colors.background,
  },
  deviceListEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deviceItemConnecting: {
    backgroundColor: colors.goldBackground,
  },
  deviceItemConnected: {
    backgroundColor: colors.goldBackgroundAlt,
    opacity: 0.8,
  },
  deviceItemDisabled: {
    opacity: 0.6,
  },
  deviceInfo: {
    flex: 1,
    paddingRight: 12,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    flex: 1,
  },
  deviceTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deviceTypeBadgeBle: {
    backgroundColor: colors.goldBackground,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  deviceTypeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  deviceTypeTextBle: {
    color: colors.goldDark,
  },
  deviceSignal: {
    fontSize: 13,
    color: colors.textMuted,
  },
  deviceStatus: {
    minWidth: 90,
    alignItems: 'flex-end',
  },
  deviceStatusLabel: {
    fontSize: 14,
    color: colors.gold,
    fontWeight: '600',
  },
  deviceStatusLabelConnected: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  deviceSeparator: {
    height: 1,
    backgroundColor: colors.borderAlt,
    marginHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  emptyStateText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  primaryBtn: {
    alignSelf: 'center',
    width: '100%',
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    alignSelf: 'center',
    width: '100%',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
    marginBottom: Platform.select({ ios: 0, android: 8 }), // Espaço extra no Android para evitar sobreposição com barra de navegação
  },
  secondaryBtnDisabled: {
    opacity: 0.6,
  },
  secondaryText: {
    color: colors.gold,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
