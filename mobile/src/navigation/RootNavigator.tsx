import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, MessageSquare, Compass, Calendar, DollarSign, Briefcase, Award, ShieldAlert, Smile, User, Users, UserCheck } from 'lucide-react-native';
import { Theme } from '../theme';

// Pre-login screens
import LandingScreen from '../screens/landing/LandingScreen';
import AboutScreen from '../screens/landing/AboutScreen';
import PlansScreen from '../screens/landing/PlansScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import ClerkAuthScreen from '../screens/auth/ClerkAuthScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';

// Seeker / Individual screens
import UserDashboardScreen from '../screens/user/DashboardScreen';
import ChatScreen from '../screens/user/ChatScreen';
import TherapistListScreen from '../screens/user/TherapistListScreen';
import TherapistDetailScreen from '../screens/user/TherapistDetailScreen';
import BookingScreen from '../screens/user/BookingScreen';
import UserBookingsScreen from '../screens/user/UserBookingsScreen';
import BreatheScreen from '../screens/user/BreatheScreen';
import CBTJournalScreen from '../screens/user/CBTJournalScreen';
import MoodDiaryScreen from '../screens/user/MoodDiaryScreen';
import NotificationInboxScreen from '../screens/user/NotificationInboxScreen';
import SessionScreen from '../screens/user/SessionScreen';
import WalletScreen from '../screens/user/WalletScreen';
import ReportsScreen from '../screens/user/ReportsScreen';

// Therapist screens
import TherapistDashboardScreen from '../screens/therapist/TherapistDashboardScreen';
import TherapistBriefScreen from '../screens/therapist/TherapistBriefScreen';
import TherapistScheduleScreen from '../screens/therapist/TherapistScheduleScreen';
import TherapistEarningsScreen from '../screens/therapist/TherapistEarningsScreen';
import TherapistProfileScreen from '../screens/therapist/TherapistProfileScreen';

// Org screens
import OrgDashboardScreen from '../screens/org/OrgDashboardScreen';
import OrgTherapistsScreen from '../screens/org/OrgTherapistsScreen';
import OrgRequestsScreen from '../screens/org/OrgRequestsScreen';
import OrgMembersScreen from '../screens/org/OrgMembersScreen';

// Super admin screens
import SuperAdminOverviewScreen from '../screens/admin/SuperAdminOverviewScreen';
import SuperAdminApprovalsScreen from '../screens/admin/SuperAdminApprovalsScreen';
import SuperAdminSubscriptionsScreen from '../screens/admin/SuperAdminSubscriptionsScreen';
import SuperAdminPlansScreen from '../screens/admin/SuperAdminPlansScreen';
import SuperAdminEarningsScreen from '../screens/admin/SuperAdminEarningsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 1. User Bottom Navigator
const UserTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 15) : Math.max(insets.bottom, 8);
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: Theme.colors.outline,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: Theme.colors.surfaceHigh,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Theme.fonts.bodyBold,
          fontSize: 10,
        }
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={UserDashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{
          tabBarLabel: 'Manas AI',
          tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Therapists" 
        component={TherapistListScreen}
        options={{
          tabBarLabel: 'Therapists',
          tabBarIcon: ({ color, size }) => <Compass size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Bookings" 
        component={UserBookingsScreen}
        options={{
          tabBarLabel: 'Sessions',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Mood" 
        component={MoodDiaryScreen}
        options={{
          tabBarLabel: 'Mood',
          tabBarIcon: ({ color, size }) => <Smile size={size} color={color} />
        }}
      />
    </Tab.Navigator>
  );
};

// 2. Therapist Bottom Navigator
const TherapistTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 15) : Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: Theme.colors.outline,
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: Theme.colors.surfaceHigh,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Theme.fonts.bodyBold,
          fontSize: 10,
        }
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={TherapistDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Briefcase size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Schedule" 
        component={TherapistScheduleScreen}
        options={{
          tabBarLabel: 'Schedule',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Earnings" 
        component={TherapistEarningsScreen}
        options={{
          tabBarLabel: 'Earnings',
          tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={TherapistProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />
        }}
      />
    </Tab.Navigator>
  );
};

// 3. Org Bottom Navigator
const OrgTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 15) : Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: Theme.colors.outline,
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: Theme.colors.surfaceHigh,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Theme.fonts.bodyBold,
          fontSize: 10,
        }
      }}
    >
      <Tab.Screen 
        name="Overview" 
        component={OrgDashboardScreen}
        options={{
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color, size }) => <Award size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Therapists" 
        component={OrgTherapistsScreen}
        options={{
          tabBarLabel: 'Therapists',
          tabBarIcon: ({ color, size }) => <Smile size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Requests" 
        component={OrgRequestsScreen}
        options={{
          tabBarLabel: 'Requests',
          tabBarIcon: ({ color, size }) => <UserCheck size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Members" 
        component={OrgMembersScreen}
        options={{
          tabBarLabel: 'Members',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />
        }}
      />
    </Tab.Navigator>
  );
};

// 4. Super Admin Bottom Navigator
const AdminTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 15) : Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: Theme.colors.outline,
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: Theme.colors.surfaceHigh,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Theme.fonts.bodyBold,
          fontSize: 10,
        }
      }}
    >
      <Tab.Screen 
        name="AdminOverview" 
        component={SuperAdminOverviewScreen}
        options={{
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="AdminApprovals" 
        component={SuperAdminApprovalsScreen}
        options={{
          tabBarLabel: 'Approvals',
          tabBarIcon: ({ color, size }) => <UserCheck size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="AdminEarnings" 
        component={SuperAdminEarningsScreen}
        options={{
          tabBarLabel: 'Earnings',
          tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="AdminSubscriptions" 
        component={SuperAdminSubscriptionsScreen}
        options={{
          tabBarLabel: 'Subs',
          tabBarIcon: ({ color, size }) => <Award size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="AdminPlans" 
        component={SuperAdminPlansScreen}
        options={{
          tabBarLabel: 'Plans',
          tabBarIcon: ({ color, size }) => <Briefcase size={size} color={color} />
        }}
      />
    </Tab.Navigator>
  );
};

// 5. Main Root Navigator Stack
export const RootNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Pre-login stack */}
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Plans" component={PlansScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ClerkAuth" component={ClerkAuthScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />

      {/* Post-login tab shell stack */}
      <Stack.Screen name="UserTabs" component={UserTabNavigator} />
      <Stack.Screen name="TherapistTabs" component={TherapistTabNavigator} />
      <Stack.Screen name="OrgTabs" component={OrgTabNavigator} />
      <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />

      {/* Seeker details and modals */}
      <Stack.Screen name="TherapistDetail" component={TherapistDetailScreen} />
      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="Breathe" component={BreatheScreen} />
      <Stack.Screen name="Journal" component={CBTJournalScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />

      {/* Practitioner specialized overlays */}
      <Stack.Screen name="TherapistBrief" component={TherapistBriefScreen} />

      {/* Shared authed screens */}
      <Stack.Screen name="Notifications" component={NotificationInboxScreen} />
      <Stack.Screen name="Session" component={SessionScreen} />
    </Stack.Navigator>
  );
};

export default RootNavigator;
