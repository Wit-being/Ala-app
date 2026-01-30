import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import useWakeDetection from '../hooks/useWakeDetection';
import DreamPopup from '../components/DreamPopup';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import MainScreen from '../screens/MainScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RecordDreamScreen from '../screens/RecordDreamScreen';
import NotificationScreen from '../screens/NotificationScreen';
import ViewProfileScreen from '../screens/ViewProfileScreen';
import DreamDetailScreen from '../screens/DreamDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import AllBadgesScreen from '../screens/AllBadgesScreen';
import UserListScreen from '../screens/UserListScreen';
import SearchUsersScreen from '../screens/SearchUsersScreen';

const Stack = createStackNavigator();

function AppNavigator() {
  const { user, setUser, setSession, setLoading } = useAuthStore();
  const { fetchBlockedUsers, clearSocialData } = useSocialStore();
  const { showPopup, dismissPopup } = useWakeDetection();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchBlockedUsers(user.id);
    } else {
      clearSocialData();
    }
  }, [user?.id]);

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <>
              <Stack.Screen name="Main" component={MainScreen} />
              <Stack.Screen 
                name="Profile" 
                component={ProfileScreen}
                options={{
                  presentation: 'modal',
                  gestureEnabled: true,
                  gestureDirection: 'vertical',
                }}
              />
              <Stack.Screen 
                name="ViewProfile" 
                component={ViewProfileScreen} 
              />
              <Stack.Screen name="AllBadges" component={AllBadgesScreen} />
              <Stack.Screen
                name="DreamDetail"
                component={DreamDetailScreen}
              />
              <Stack.Screen name="SearchUsers" component={SearchUsersScreen} />
              <Stack.Screen name="UserList" component={UserListScreen} />
              <Stack.Screen 
                name="RecordDream" 
                component={RecordDreamScreen}
                options={{
                  presentation: 'modal',
                  gestureEnabled: true,
                  gestureDirection: 'vertical',
                }}
              />
              <Stack.Screen 
                name="Notifications" 
                component={NotificationScreen}
                options={{
                  presentation: 'modal',
                  gestureEnabled: true,
                  gestureDirection: 'vertical',
                }}
              />
              <Stack.Screen 
                name="Settings" 
                component={SettingsScreen}
              />
              <Stack.Screen 
                name="BlockedUsers" 
                component={BlockedUsersScreen}
              />
              <Stack.Screen 
                name="EditProfile" 
                component={EditProfileScreen}
                options={{
                  presentation: 'modal',
                  gestureEnabled: true,
                  gestureDirection: 'vertical',
                }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {user && <DreamPopup visible={showPopup} onDismiss={dismissPopup} />}
    </>
  );
}

export default AppNavigator;