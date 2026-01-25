import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INACTIVITY_THRESHOLD = 4 * 60 * 60 * 1000; // 4 hours for production
// const INACTIVITY_THRESHOLD = 30 * 1000; // 30 seconds for testing

function useWakeDetection() {
  const [showPopup, setShowPopup] = useState(false);
  const appState = useRef(AppState.currentState);
  const hasCheckedThisSession = useRef(false);

  useEffect(() => {
    // Check immediately on mount (app open)
    checkWakeConditions();

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const isWakeUpTime = () => {
    const hour = new Date().getHours();
    // Between 5 AM and 11 AM
    return hour >= 5 && hour < 11;
  };

  const hasShownToday = async () => {
    const lastShown = await AsyncStorage.getItem('dreamPopupLastShown');
    if (!lastShown) return false;
    
    const lastDate = new Date(parseInt(lastShown)).toDateString();
    const today = new Date().toDateString();
    return lastDate === today;
  };

  const markAsShownToday = async () => {
    await AsyncStorage.setItem('dreamPopupLastShown', Date.now().toString());
  };

  const checkWakeConditions = async () => {
    // Only check once per app session
    if (hasCheckedThisSession.current) return;
    hasCheckedThisSession.current = true;

    try {
      // Check if it's morning time
      if (!isWakeUpTime()) {
        return;
      }

      // Check if already shown today
      const shownToday = await hasShownToday();
      if (shownToday) {
        return;
      }

      // Check inactivity period
      const lastActivity = await AsyncStorage.getItem('lastActivityTime');
      const now = Date.now();

      if (lastActivity) {
        const inactiveTime = now - parseInt(lastActivity);
        
        if (inactiveTime > INACTIVITY_THRESHOLD) {
          // All conditions met - show popup!
          setShowPopup(true);
          await markAsShownToday();
        }
      }

      // Update activity time
      await AsyncStorage.setItem('lastActivityTime', now.toString());
      
    } catch (error) {
      console.error('Wake detection error:', error);
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground
      hasCheckedThisSession.current = false;
      await checkWakeConditions();
    }

    if (nextAppState === 'background') {
      // App going to background - save time
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