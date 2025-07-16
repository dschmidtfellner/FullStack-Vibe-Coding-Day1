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
      const startTime = Date.now();
      const minLoadingTime = 800; // Minimum 800ms loading time for smooth experience
      
      try {
        // Get token from URL
        const token = getTokenFromURL();
        
        if (token) {
          // Validate JWT token
          const user = await validateJWTToken(token);
          
          // Calculate remaining time to meet minimum loading duration
          const elapsed = Date.now() - startTime;
          const remainingTime = Math.max(0, minLoadingTime - elapsed);
          
          // Wait for remaining time if needed
          if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          }
          
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
          // Calculate remaining time to meet minimum loading duration
          const elapsed = Date.now() - startTime;
          const remainingTime = Math.max(0, minLoadingTime - elapsed);
          
          // Wait for remaining time if needed
          if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          }
          
          // No token provided
          setAuthState({
            user: null,
            isLoading: false,
            error: 'No authentication token provided',
          });
        }
      } catch (error) {
        console.error('❌ Authentication initialization failed:', error);
        
        // Calculate remaining time to meet minimum loading duration
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsed);
        
        // Wait for remaining time if needed
        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        setAuthState({
          user: null,
          isLoading: false,
          error: 'Authentication failed',
        });
      }
    };

    void initializeAuth();
  }, []); // Run once on mount

  return authState;
}

/**
 * Helper hook to check if user has access to a specific child
 */
export function useChildAccess(childId: string | null): boolean {
  const { user } = useBubbleAuth();
  
  if (!user || !childId) return false;
  
  // Debug logging (commented out to reduce console noise)
  // console.log('🔍 Permission check:', {
  //   requestedChildId: childId,
  //   requestedChildIdType: typeof childId,
  //   userChildIds: user.childIds,
  //   userChildIdsExpanded: JSON.stringify(user.childIds),
  //   firstChildId: user.childIds[0],
  //   firstChildIdType: typeof user.childIds[0],
  //   hasAccess: user.childIds.includes(childId),
  //   userType: user.userType,
  //   userName: user.name
  // });
  
  // Check if user has explicit access to this child
  // The childIds array from Bubble already contains all children this user can access
  // (including own child for Parents, direct clients + shared clients + teammate clients for Coaches)
  return user.childIds.includes(childId);
}