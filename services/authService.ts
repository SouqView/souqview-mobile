import AsyncStorage from '@react-native-async-storage/async-storage';
import { postRequest, getRequest } from './api';

const USER_KEY = '@souqview_user';
const AUTH_KEY = '@souqview_auth';

export interface User {
  name: string;
  plan?: {
    name: string;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

/**
 * Store user data in AsyncStorage
 */
export const storeUser = async (user: User): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn('Error storing user:', error);
    throw error;
  }
};

/**
 * Get user data from AsyncStorage
 */
export const getUser = async (): Promise<User | null> => {
  try {
    const userJson = await AsyncStorage.getItem(USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  } catch (error) {
    console.warn('Error getting user:', error);
    return null;
  }
};

/**
 * Remove user data from AsyncStorage
 */
export const removeUser = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch (error) {
    console.warn('Error removing user:', error);
  }
};

/**
 * Login user with email/phone and password
 */
export const login = async (identifier: string, password: string): Promise<{ user: User; message: string }> => {
  try {
    const response = await postRequest('/auth/login', {
      identifier,
      password,
    });

    if (response?.user) {
      await storeUser(response.user);
      return {
        user: response.user,
        message: response.message || 'Login successful',
      };
    }

    throw new Error(response?.message || 'Login failed');
  } catch (error: any) {
    console.warn('Login error:', error);
    throw new Error(error?.message || 'Login failed. Please check your credentials.');
  }
};

/**
 * Sign in with Apple (wire to Firebase Auth or Supabase in your project).
 * Until configured, throws so the user sees a clear message.
 */
export const signInWithApple = async (): Promise<{ user: User }> => {
  // TODO: Integrate expo-apple-authentication + Firebase/Supabase
  // Example: const credential = await AppleAuthentication.signInAsync(...); then Firebase.auth().signInWithCredential(credential);
  throw new Error(
    'Sign in with Apple is not configured. Use Email to sign in, or add Firebase/Supabase and wire signInWithApple in authService.ts.'
  );
};

/**
 * Sign in with Google (wire to Firebase Auth or Supabase in your project).
 * Until configured, throws so the user sees a clear message.
 */
export const signInWithGoogle = async (): Promise<{ user: User }> => {
  // TODO: Integrate @react-native-google-signin/google-signin or Firebase/Supabase OAuth
  throw new Error(
    'Sign in with Google is not configured. Use Email to sign in, or add Firebase/Supabase and wire signInWithGoogle in authService.ts.'
  );
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  try {
    await postRequest('/auth/logout', {});
    await removeUser();
  } catch (error) {
    console.warn('Logout error:', error);
    // Remove user locally even if API call fails
    await removeUser();
  }
};

/**
 * Check if user is authenticated by calling /auth/me
 */
export const checkAuth = async (): Promise<User | null> => {
  try {
    const response = await getRequest('/auth/me');
    
    if (response?.user) {
      await storeUser(response.user);
      return response.user;
    }
    
    return null;
  } catch (error) {
    console.warn('Auth check error:', error);
    // If auth fails, remove stored user
    await removeUser();
    return null;
  }
};
