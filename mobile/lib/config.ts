import { Platform } from 'react-native';
import Constants from 'expo-constants';

const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;

// Dynamically extract the laptop's IP address if running in Expo Go
let expoGoHost = null;
const hostUri = Constants.expoConfig?.hostUri;
if (hostUri) {
  expoGoHost = `http://${hostUri.split(':')[0]}:8000`;
}

const defaultByPlatform =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : expoGoHost
    ? expoGoHost
    : Platform.OS === 'android'
    ? 'http://10.0.2.2:8000'
    : 'http://127.0.0.1:8000';

export const API_BASE_URL = fromEnv ?? defaultByPlatform;
