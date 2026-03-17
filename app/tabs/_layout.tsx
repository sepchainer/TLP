import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: '#0f0f0f' },
        tabBarActiveTintColor: '#2f95dc',
        tabBarInactiveTintColor: '#888888',
        tabBarStyle: { backgroundColor: '#1a1a1a', borderTopColor: '#333333' },
        headerStyle: { backgroundColor: '#1a1a1a' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { color: '#ffffff', fontWeight: 'bold' },
        // Hier wird der Button für alle Screens im Tab-Navigator definiert
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/profile')}
            style={({ pressed }) => ({
              marginRight: 15,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Ionicons name="person-circle-outline" size={32} color="#2f95dc" />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: 'Wellness',
          tabBarIcon: ({ color }) => <Ionicons name="heart" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: ({ color }) => <Ionicons name="fitness" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}