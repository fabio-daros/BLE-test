import { useEffect, useMemo, useState } from 'react';
import { getSimulatorService, SimulatorStatus } from './simulatorService';

export function useSimulatorStatus() {
  const service = useMemo(() => getSimulatorService(), []);
  const [status, setStatus] = useState<SimulatorStatus>(
    service.currentSimulatorStatus
  );

  useEffect(() => {
    let mounted = true;

    const handleStatusUpdate = (newStatus: SimulatorStatus) => {
      if (!mounted) return;
      setStatus(newStatus);
    };

    service.onStatus(handleStatusUpdate);

    // Conectar automaticamente quando o hook for usado (apenas uma vez)
    const currentStatus = service.currentSimulatorStatus;
    if (!currentStatus.connected) {
      service.connect().catch(error => {
        console.log('Falha na conexão automática:', error);
      });
    }

    return () => {
      mounted = false;
      service.offStatus(handleStatusUpdate);
    };
  }, [service]); // Removido status.connected das dependências

  return {
    status,
    service,
    // Métodos de conveniência
    startSimulator: () => service.startSimulator(),
    stopSimulator: () => service.stopSimulator(),
    setPreset: (preset: any) => service.setPreset(preset),
    toggleBluetooth: () => service.toggleBluetooth(),
    connect: () => service.connect(),
    disconnect: () => service.disconnect(),
    // Métodos adicionais
    reconnect: () => service.connect(),
  };
}
