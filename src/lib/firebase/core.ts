import { getStorage } from 'firebase/storage';
import { db } from '../firebase';

// Re-export the database instance
export { db };

// Initialize storage instance
export const storage = getStorage();

// Shared utility functions that multiple modules might need
export function getAppVersion(): string {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('version') || 'live'; // Default to live if not specified
  } catch (error) {
    console.warn('Error getting app version from URL:', error);
    return 'live'; // Fallback to live
  }
}