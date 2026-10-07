import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabs from './MainTabs';

import WelcomeScreen from '../screens/WelcomeScreen';
import CreateStoreScreen from '../screens/CreateStoreScreen';
import OtpVerificationScreen from '../screens/OtpVerificationScreen';
import PersonalInfoScreen from '../screens/PersonalInfoScreen';
import CountrySelectionScreen from '../screens/CountrySelectionScreen';
import CurrencySelectionScreen from '../screens/CurrencySelectionScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import CartScreen from '../screens/CartScreen';
import SupportScreen from '../screens/SupportScreen';
import AboutScreen from '../screens/AboutScreen';
import GuideScreen from '../screens/GuideScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import AuthorizationManagementScreen from '../screens/AuthorizationManagementScreen';
import CookiePreferencesScreen from '../screens/CookiePreferencesScreen';
import ReferralScreen from '../screens/ReferralScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ChatScreen from '../screens/ChatScreen';
import OrderReviewScreen from '../screens/OrderReviewScreen';
import ReviewSuccessScreen from '../screens/ReviewSuccessScreen';
import { useAuth } from '../context/AuthContext';
import ImageSearchScreen from '../screens/ImageSearchScreen';
import StoreDetailScreen from '../screens/StoreDetailScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { initializing, isAuthenticated, user } = useAuth();

  // عرض شاشة تحميل بيضاء خالية من الوميض ريثما يتحقق النظام من حالة المصادقة
  if (initializing) {
    return (
      <View style={styles.loadingScreen}>
        <Image
          source={require('../../assets/images/kilix-splash.png')}
          style={styles.loadingImage}
          resizeMode="cover"
        />
      </View>
    );
  }

  // تحديد الشاشة الأولى بشكل صارم وآمن تماماً
  const getInitialRoute = () => {
    if (!isAuthenticated || !user) return 'Welcome';
    return 'Main';
  };

  return (
    <Stack.Navigator
        initialRouteName={getInitialRoute()}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      {/* Onboarding / auth flow */}
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="CreateStore" component={CreateStoreScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <Stack.Screen name="CountrySelection" component={CountrySelectionScreen} />
      <Stack.Screen name="CurrencySelection" component={CurrencySelectionScreen} />

      {/* Main app (bottom tabs) */}
      <Stack.Screen name="Main" component={MainTabs} />

      {/* Screens pushed on top of the tabs */}
      <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Guide" component={GuideScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="AuthorizationManagement" component={AuthorizationManagementScreen} />
      <Stack.Screen name="CookiePreferences" component={CookiePreferencesScreen} />
      <Stack.Screen name="Referral" component={ReferralScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="OrderReview" component={OrderReviewScreen} />
      <Stack.Screen name="ReviewSuccess" component={ReviewSuccessScreen} />
      <Stack.Screen name="ImageSearch" component={ImageSearchScreen} />
      <Stack.Screen name="StoreDetail" component={StoreDetailScreen} />
    </Stack.Navigator>
  );
}
const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#FF6B00',
  },
  loadingImage: {
    width: '100%',
    height: '100%',
  },
});
