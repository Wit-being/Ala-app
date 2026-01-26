import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Vibration, Platform, View, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useShakeDetection } from '../hooks/useShakeDetection';
import FeedbackModal from '../components/FeedbackModal';

interface FeedbackContextType {
  openFeedback: () => void;
  closeFeedback: () => void;
  screenRef: React.RefObject<View | null>;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const screenRef = useRef<View>(null);

  const captureScreenshot = async (): Promise<string | null> => {
    try {
      if (screenRef.current) {
        const uri = await captureRef(screenRef, { format: 'jpg', quality: 0.8 });
        return uri;
      }
    } catch (error) {
      console.log('Screenshot failed:', error);
    }
    return null;
  };

  const openFeedback = useCallback(async () => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(10);
    } else {
      Vibration.vibrate(50);
    }

    const uri = await captureScreenshot();
    setScreenshotUri(uri);
    setShowFeedback(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setShowFeedback(false);
    setTimeout(() => setScreenshotUri(null), 500);
  }, []);

  // Easier shake detection
  useShakeDetection({
    onShake: openFeedback,
    threshold: 2.2,
    timeout: 3000,
  });

  return (
    <FeedbackContext.Provider value={{ openFeedback, closeFeedback, screenRef }}>
      <View ref={screenRef} style={styles.container} collapsable={false}>
        {children}
      </View>
      <FeedbackModal 
        visible={showFeedback} 
        onClose={closeFeedback}
        screenshotUri={screenshotUri}
      />
    </FeedbackContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});