import React from 'react';
import TestInProgress, { type TestInProgressProps } from './TestInProgress';
import { useAnalysisElapsedTime } from '@/services/bluetooth/analysisElapsedTime';
import { useTemperatureBlockMonitoring } from '@/services/bluetooth/temperatureBlock';

/**
 * Wrapper do TestInProgress que integra o tempo decorrido do hardware e a temperatura.
 * Se o hardware estiver enviando tempo decorrido, usa ele.
 * Caso contrário, usa countdown local como fallback.
 */
export const TestInProgressWithHardwareTime: React.FC<
  Omit<TestInProgressProps, 'elapsedSec' | 'temperature'>
> = (props) => {
  const { elapsedSeconds, isMonitoring } = useAnalysisElapsedTime();
  const { temperature, isMonitoring: isMonitoringTemp } = useTemperatureBlockMonitoring();

  // Se o hardware estiver enviando tempo decorrido, usa ele
  // Caso contrário, undefined = usa countdown local
  const elapsedSec = elapsedSeconds !== null ? elapsedSeconds : undefined;

  return (
    <TestInProgress
      {...props}
      elapsedSec={elapsedSec}
      temperature={temperature}
    />
  );
};

export default TestInProgressWithHardwareTime;

