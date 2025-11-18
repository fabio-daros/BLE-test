import { useEffect, useMemo, useState } from 'react';
import { getHardwareServiceSingleton } from './singleton';
import { HardwareStatusJSON } from './codec';

// Hook simples para consumir status do hardware. Em produção, substitua o MockHardwareTransport por um transporte real (ex.: BLE).
export function useHardwareStatus() {
  const service = useMemo(() => getHardwareServiceSingleton(), []);
  const [status, setStatus] = useState<HardwareStatusJSON | null>(
    service.currentStatus
  );
  const [connected, setConnected] = useState<boolean>(service.isConnected);

  useEffect(() => {
    let mounted = true;
    setConnected(service.isConnected);
    service.onStatus(s => {
      if (!mounted) return;
      setStatus(s);
    });
    return () => {
      mounted = false;
      service.offStatus(s => setStatus(s));
    };
  }, [service]);

  return { status, connected, service };
}
