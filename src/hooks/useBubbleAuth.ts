import { useState, useEffect } from 'react';
import { BubbleUser, validateJWTToken, getTokenFromURL, createTestUsers } from '@/lib/jwt-auth';

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
    const initializeAuth = () => {
      try {
        // Get token from URL
        const token = getTokenFromURL();
        
        if (token) {
          // Validate JWT token
          const user = validateJWTToken(token);
          
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
          // No token provided - check if we're in development mode
          if (import.meta.env.DEV) {
            // For development, show test user options or use default
            console.log('Development mode: No token provided');
            console.log('Available test tokens:', createTestUsers());
            
            // Use a default test user for development
            const testUsers = createTestUsers();
            const defaultTestUser = validateJWTToken(testUsers.parent1);
            
            if (defaultTestUser) {
              setAuthState({
                user: defaultTestUser,
                isLoading: false,
                error: null,
              });
              console.log('Using default test user:', defaultTestUser);
            } else {
              setAuthState({
                user: null,
                isLoading: false,
                error: 'No authentication token provided',
              });
            }
          } else {
            // Production mode - require token
            setAuthState({
              user: null,
              isLoading: false,
              error: 'No authentication token provided',
            });
          }
        }
      } catch (error) {
        console.error('Authentication initialization failed:', error);
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
  
  // Admin role has access to all children
  if (user.role === 'admin') return true;
  
  // Check if user has explicit access to this child
  return user.childIds.includes(childId);
}