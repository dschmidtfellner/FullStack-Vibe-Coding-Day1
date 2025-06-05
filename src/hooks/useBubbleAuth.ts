import { useState, useEffect } from 'react';
import { BubbleUser, validateJWTToken, getTokenFromURL } from '@/lib/jwt-auth';

interface AuthState {
  user: BubbleUser | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook for Bubble JWT authentication
 * Replaces Clerk authentication with JWT token validation
 */
export function useBubbleAuth(): AuthState {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get token from URL
        const token = getTokenFromURL();
        
        if (token) {
          // Validate JWT token
          const user = await validateJWTToken(token);
          
          if (user) {
            setAuthState({
              user,
              isLoading: false,
              error: null,
            });
          } else {
            setAuthState({
              user: null,
              isLoading: false,
              error: 'Invalid authentication token',
            });
          }
        } else {
          // No token provided
          setAuthState({
            user: null,
            isLoading: false,
            error: 'No authentication token provided',
          });
        }
      } catch (error) {
        console.error('❌ Authentication initialization failed:', error);
        setAuthState({
          user: null,
          isLoading: false,
          error: 'Authentication failed',
        });
      }
    };

    initializeAuth();
  }, []); // Run once on mount

  return authState;
}

/**
 * Helper hook to check if user has access to a specific child
 */
export function useChildAccess(childId: string | null): boolean {
  const { user } = useBubbleAuth();
  
  if (!user || !childId) return false;
  
  // Check if user has explicit access to this child
  // The childIds array from Bubble already contains all children this user can access
  // (including own child for Parents, direct clients + shared clients + teammate clients for Coaches)
  return user.childIds.includes(childId);
}