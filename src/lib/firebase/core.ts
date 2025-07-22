import { getStorage } from 'firebase/storage';
import { db } from './app-init';

// Re-export the database instance
export { db };

// Initialize storage instance
export const storage = getStorage();