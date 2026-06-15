import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthProvider } from './src/context/AuthContext'
import LoginScreen from './src/screens/LoginScreen'
import UserDashboard from './src/screens/UserDashboard'
import OutletDashboard from './src/screens/OutletDashboard'
import AdminDashboard from './src/screens/AdminDashboard'
import QrScanScreen from './src/screens/QrScanScreen'

const Stack = createNativeStackNavigator()

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login"  component={LoginScreen}     />
          <Stack.Screen name="User"   component={UserDashboard}   />
          <Stack.Screen name="Outlet" component={OutletDashboard} />
          <Stack.Screen name="Admin"  component={AdminDashboard}  />
          <Stack.Screen name="QrScan" component={QrScanScreen}    />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  )
}
