import { getStorage } from 'firebase/storage';
import { db } from '../firebase';

// Re-export the database instance
export { db };

// Initialize storage instance
export const storage = getStorage();