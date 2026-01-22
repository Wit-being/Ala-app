import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INACTIVITY_THRESHOLD = 4 * 60 * 60 * 1000; // 4 hours

function useWakeDetection() {
  const [showPopup, setShowPopup] = useState(false);
  const appState = useRef(AppState.currentState);
  const hasCheckedThisSession = useRef(false);

  useEffect(() => {
    AsyncStorage.setItem('lastActivityTime', Date.now().toString());
    checkWakeConditions();

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const isWakeUpTime = () => {
    const hour = new Date().getHours();
    return hour >= 5 && hour < 11;
  };

  const hasShownToday = async (): Promise<boolean> => {
    try {
      const lastShown = await AsyncStorage.getItem('dreamPopupLastShown');
      if (!lastShown) return false;
      
      const lastDate = new Date(parseInt(lastShown)).toDateString();
      const today = new Date().toDateString();
      return lastDate === today;
    } catch {
      return false;
    }
  };

  const markAsShownToday = async () => {
    try {
      await AsyncStorage.setItem('dreamPopupLastShown', Date.now().toString());
    } catch (error) {
      console.error('Error saving popup shown date:', error);
    }
  };

  const checkWakeConditions = async () => {
    if (hasCheckedThisSession.current) return;
    hasCheckedThisSession.current = true;

    try {
      if (!isWakeUpTime()) return;

      const shownToday = await hasShownToday();
      if (shownToday) return;

      const lastActivity = await AsyncStorage.getItem('lastActivityTime');
      const now = Date.now();

      if (lastActivity) {
        const inactiveTime = now - parseInt(lastActivity);
        
        if (inactiveTime > INACTIVITY_THRESHOLD) {
          setShowPopup(true);
          await markAsShownToday();
        }
      }

      await AsyncStorage.setItem('lastActivityTime', now.toString());
      
    } catch (error) {
      console.error('Wake detection error:', error);
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      hasCheckedThisSession.current = false;
      await checkWakeConditions();
    }

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      await AsyncStorage.setItem('lastActivityTime', Date.now().toString());
    }

    appState.current = nextAppState;
  };

  const dismissPopup = () => {
    setShowPopup(false);
  };

  return { showPopup, dismissPopup };
}

export default useWakeDetection;