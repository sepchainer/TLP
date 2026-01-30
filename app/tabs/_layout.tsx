import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2f95dc',
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