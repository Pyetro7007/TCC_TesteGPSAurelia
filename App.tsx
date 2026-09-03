// @ts-nocheck

import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GeofenceScreen from './src/screens/geofence-config-screen';
import CaregiverAlarmScreen from './src/screens/caregiver-alarm-screen';

const Tab = createBottomTabNavigator();

export default function App() {
  // Estado compartilhado do IP do ESP32
  const [ipEsp, setIpEsp] = useState('IP_ESP');

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#2E7D32',
            tabBarInactiveTintColor: '#757575',
            tabBarStyle: { 
              paddingBottom: 8, 
              height: 60,
              backgroundColor: '#FFFFFF',
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
            },
          }}
        >
          <Tab.Screen name="Configurar Perímetro">
            {(props) => (
              <GeofenceScreen 
                {...props} 
                ipEsp={ipEsp} 
                setIpEsp={setIpEsp} 
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Status / Alarme">
            {(props) => (
              <CaregiverAlarmScreen 
                {...props} 
                ipEsp={ipEsp} 
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}