// App.tsx
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FeedbackProvider } from './src/providers/FeedbackProvider';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <FeedbackProvider>
          <AppNavigator />
        </FeedbackProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}