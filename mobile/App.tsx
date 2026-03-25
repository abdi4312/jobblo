import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider, Text, Button, Card, Title, Paragraph } from 'react-native-paper';
import { Home, User, Settings as SettingsIcon } from 'lucide-react-native';
import "./global.css";

// Placeholder Screens
function HomeScreen() {
  return (
    <View style={styles.container} className="bg-slate-50">
      <Home color="#6200ee" size={48} />
      <Title style={styles.title}>Home Screen</Title>
      <Card style={styles.card}>
        <Card.Content>
          <Paragraph>Welcome to Jobblo Mobile! Your professional networking app on the go.</Paragraph>
        </Card.Content>
        <Card.Actions>
          <Button mode="contained">Get Started</Button>
        </Card.Actions>
      </Card>
      <StatusBar style="auto" />
    </View>
  );
}

function ProfileScreen() {
  return (
    <View style={styles.container}>
      <User color="#6200ee" size={48} />
      <Title style={styles.title}>Profile Screen</Title>
      <Text>Manage your profile and job applications here.</Text>
      <Button mode="outlined" style={{ marginTop: 20 }}>Edit Profile</Button>
    </View>
  );
}

function SettingsScreen() {
  return (
    <View style={styles.container}>
      <SettingsIcon color="#6200ee" size={48} />
      <Title style={styles.title}>Settings Screen</Title>
      <Text>App configuration, notifications, and logout.</Text>
      <Button mode="text" style={{ marginTop: 20 }}>Logout</Button>
    </View>
  );
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <Home color={color} size={size} />;
          if (route.name === 'Profile') return <User color={color} size={size} />;
          if (route.name === 'Settings') return <SettingsIcon color={color} size={size} />;
        },
        tabBarActiveTintColor: '#6200ee',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen 
            name="Main" 
            component={MainTabs} 
            options={{ headerShown: false }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});
