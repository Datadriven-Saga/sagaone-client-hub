import { useEffect, useCallback } from 'react';

const PREFERENCES_KEY = 'user_preferences';
const UI_STATE_KEY = 'user_ui_state';

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  layout?: string;
  colorConfig?: Record<string, string>;
}

export interface UIState {
  filters?: Record<string, any>;
  activeTab?: string;
  sortOrder?: Record<string, string>;
  selectedItems?: string[];
  expandedSections?: string[];
}

// Save preferences to localStorage (non-sensitive data only)
export function savePreferences(preferences: Partial<UserPreferences>): void {
  try {
    const existing = getPreferences();
    const updated = { ...existing, ...preferences };
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save preferences:', error);
  }
}

// Get preferences from localStorage
export function getPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to get preferences:', error);
    return {};
  }
}

// Save UI state to localStorage (non-sensitive data only)
export function saveUIState(state: Partial<UIState>): void {
  try {
    const existing = getUIState();
    const updated = { ...existing, ...state };
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save UI state:', error);
  }
}

// Get UI state from localStorage
export function getUIState(): UIState {
  try {
    const stored = localStorage.getItem(UI_STATE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to get UI state:', error);
    return {};
  }
}

// Hook to manage user preferences
export function useUserPreferences() {
  const updatePreferences = useCallback((preferences: Partial<UserPreferences>) => {
    savePreferences(preferences);
  }, []);

  const updateUIState = useCallback((state: Partial<UIState>) => {
    saveUIState(state);
  }, []);

  return {
    preferences: getPreferences(),
    uiState: getUIState(),
    updatePreferences,
    updateUIState,
  };
}

// Clear only auth-related data, keep preferences
export function clearAuthData(): void {
  // Remove any auth-related keys but keep preferences
  const keysToRemove = [
    'sb-karcxgnfiymlrkbzhewo-auth-token',
    'supabase.auth.token',
  ];
  
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (error) {
      // Ignore errors
    }
  });
}
