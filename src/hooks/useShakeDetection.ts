import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

interface UseShakeDetectionProps {
  onShake: () => void;
  threshold?: number;
  timeout?: number;
}

export function useShakeDetection({ 
  onShake, 
  threshold = 2.2,
  timeout = 3000,
}: UseShakeDetectionProps) {
  const lastShake = useRef<number>(0);

  useEffect(() => {
    let subscription: any;

    const subscribe = async () => {
      const isAvailable = await Accelerometer.isAvailableAsync();
      if (!isAvailable) return;

      Accelerometer.setUpdateInterval(100);

      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const acceleration = Math.sqrt(x * x + y * y + z * z);
        
        if (acceleration > threshold) {
          const now = Date.now();
          if (now - lastShake.current > timeout) {
            lastShake.current = now;
            onShake();
          }
        }
      });
    };

    subscribe();

    return () => {
      subscription?.remove();
    };
  }, [onShake, threshold, timeout]);
}