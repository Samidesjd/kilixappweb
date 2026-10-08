import 'react-native-gesture-handler';
import '@expo/metro-runtime';
import React from 'react';
import { I18nManager, View, StyleSheet, Text, Pressable, ActivityIndicator, Modal, Platform, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts as useCairoFonts,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk';

import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme/theme';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { DataProvider } from './src/context/DataContext';
import { CartProvider } from './src/context/CartContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import ErrorBoundary from './src/components/ErrorBoundary';

// Allow Arabic RTL without forcing French/English into RTL.
I18nManager.allowRTL(true);

SplashScreen.preventAutoHideAsync().catch(() => {});


const navigationRef = React.createRef();

function getWebProductId() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const queryId = url.searchParams.get('product');
  if (queryId) return queryId;
  const marker = '/kilixappweb/product/';
  if (url.pathname.indexOf(marker) === 0) {
    return decodeURIComponent(url.pathname.slice(marker.length).split('/')[0] || '');
  }
  return null;
}

function LanguageGate() {
  const { language, setLanguage, languages, isLanguageReady, hasSavedLanguage } = useLanguage();

  const handleSelect = async (nextLanguage) => {
    await setLanguage(nextLanguage);
  };

  if (!isLanguageReady) {
    return (
      <View style={styles.languageLoading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <DataProvider>
        <CartProvider>
          <FavoritesProvider>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
              <StatusBar style="dark" />
              <NavigationContainer
                ref={navigationRef}
                linking={Platform.OS === 'web' ? undefined : {
                  prefixes: [
                    'https://samidesjd.github.io/kilixappweb',
                    'kilix://',
                  ],
                  config: {
                    screens: {
                      ProductDetail: 'product/:id',
                    },
                  },
                }}
                onReady={() => {
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    const productId = getWebProductId();
                    if (productId) {
                      setTimeout(() => {
                        if (navigationRef.isReady()) {
                          navigationRef.dispatch(
                            CommonActions.reset({
                              index: 0,
                              routes: [{ name: 'ProductDetail', params: { id: productId } }],
                            })
                          );
                        }
                      }, 0);
                    }
                  }
                }}
              >
                <RootNavigator />
              </NavigationContainer>

              {!hasSavedLanguage && (
                <Modal
                  visible
                  transparent
                  animationType="fade"
                  statusBarTranslucent
                  onRequestClose={() => {}}
                >
                  <View style={styles.languageOverlay}>
                    <View style={styles.languageCard}>
                      <Text style={styles.languageTitle}>اختر لغة التطبيق</Text>
                      <Text style={styles.languageSubtitle}>Choose your app language</Text>

                      {Object.values(languages).map((item) => (
                        <Pressable
                          key={item.key}
                          onPress={() => handleSelect(item.key)}
                          style={[
                            styles.languageOption,
                            language === item.key && styles.languageOptionActive,
                          ]}
                        >
                          <Text style={styles.languageNative}>{item.nativeLabel}</Text>
                          <Text style={styles.languageEnglish}>
                            {item.key === 'ar' ? 'Arabic' : item.key === 'fr' ? 'French' : 'English'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </Modal>
              )}
            </View>
          </FavoritesProvider>
        </CartProvider>
      </DataProvider>
    </AuthProvider>
  );
}
export default function App() {
  const [fontsLoaded] = useCairoFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });

  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // Provider hierarchy is intentional:
  // SafeAreaProvider -> LanguageProvider -> ErrorBoundary -> app.
  // ErrorBoundary is kept inside LanguageProvider for the app tree, while its
  // fallback is context-independent so it remains safe even during provider errors.
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ErrorBoundary>
          <LanguageGate />
        </ErrorBoundary>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  languageLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  languageOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  languageCard: {
    width: '100%',
    maxWidth: 380,
    padding: 22,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  languageTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  languageSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 20,
  },
  languageOption: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 18,
    marginTop: 10,
    justifyContent: 'center',
  },
  languageOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#F5F8FF',
  },
  languageNative: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  languageEnglish: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.55,
    marginTop: 2,
  },
});