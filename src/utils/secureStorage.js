import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const webStorage = {
  async getItemAsync(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  async setItemAsync(key, value) {
    try { window.localStorage.setItem(key, value); } catch {}
  },
  async deleteItemAsync(key) {
    try { window.localStorage.removeItem(key); } catch {}
  },
};

export const secureStorage = Platform.OS === 'web' ? webStorage : SecureStore;
export default secureStorage;
