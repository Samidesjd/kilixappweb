import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, sizes } from '../theme/theme';
import { useLanguage } from '../context/LanguageContext';

import HomeScreen from '../screens/HomeScreen';
import OrdersScreen from '../screens/OrdersScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  الرئيسية: 'home',
  طلباتي: 'inventory-2',
  الرسائل: 'chat-bubble',
  حسابي: 'person',
};

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const bottomInset = Math.max(0, Number(insets.bottom) || 0);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.orangeVibrant,
        tabBarInactiveTintColor: colors.outline,
        tabBarStyle: {
          // Keep the app tab bar completely above Android/iOS system navigation
          // controls. The previous fixed height ignored the device bottom inset,
          // so the bar could slide underneath the system navigation area.
          height: sizes.navBarHeight + bottomInset,
          paddingBottom: Math.max(8, bottomInset),
          paddingTop: 6,
          backgroundColor: colors.surface,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: sizes.borderHairline,
        },
        tabBarItemStyle: { minHeight: sizes.touchTarget },
        tabBarIcon: ({ color, size }) => (
          <MaterialIcons name={ICONS[route.name]} size={sizes.iconLg} color={color} />
        ),
        tabBarLabel: t(route.name),
        tabBarLabelStyle: { fontFamily: 'Cairo_600SemiBold', fontSize: 11, letterSpacing: 0.1 },
      })}
    >
      <Tab.Screen name="الرئيسية" component={HomeScreen} />
      <Tab.Screen name="طلباتي" component={OrdersScreen} />
      <Tab.Screen name="الرسائل" component={MessagesScreen} />
      <Tab.Screen name="حسابي" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
