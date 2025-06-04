import { useAuth } from '@clerk/clerk-react';

/**
 * Custom hook to authenticate Firebase with Clerk token
 */
export function useFirebaseAuth() {
  const { getToken, isSignedIn } = useAuth();

  const signInToFirebase = async () => {
    if (!isSignedIn) return null;
    
    // TODO: Configure Firebase JWT template in Clerk dashboard
    // For now, skip Firebase auth since messaging works without it
    console.log('Firebase auth integration not configured yet - messaging still works');
    return null;
  };

  return { signInToFirebase };
}