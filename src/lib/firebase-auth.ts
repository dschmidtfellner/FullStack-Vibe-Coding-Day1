import { useAuth } from '@clerk/clerk-react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Custom hook to authenticate Firebase with Clerk token
 */
export function useFirebaseAuth() {
  const { getToken, isSignedIn } = useAuth();

  const signInToFirebase = async () => {
    if (!isSignedIn) return null;
    
    try {
      // Get custom token from Clerk
      const token = await getToken({ template: 'firebase' });
      
      if (token) {
        // Sign in to Firebase with the custom token
        const userCredential = await signInWithCustomToken(auth, token);
        return userCredential.user;
      }
    } catch (error) {
      console.error('Error signing in to Firebase:', error);
    }
    
    return null;
  };

  return { signInToFirebase };
}