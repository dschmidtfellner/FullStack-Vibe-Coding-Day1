import { jwtVerify, SignJWT } from 'jose';

// JWT payload interface - what Bubble will send
export interface JWTPayload {
  userId: string;        // Bubble user ID
  name: string;          // User's display name
  email?: string;        // Optional email
  userType: string;      // "Coach" or "Parent"
  childIds: string[];    // Array of child IDs this user can access
  darkMode?: boolean;    // Whether to use dark mode
  needsSpacer?: boolean; // Whether to add extra top spacing for free trial header
  exp?: number;          // Token expiration
  iat?: number;          // Token issued at
}

// User context interface - what our app will use
export interface BubbleUser {
  id: string;
  name: string;
  email?: string;
  userType: string;      // "Coach" or "Parent"
  childIds: string[];
  darkMode: boolean;     // Whether to use dark mode
  needsSpacer: boolean;  // Whether to add extra top spacing
  isAuthenticated: boolean;
}

// JWT Secret - must match what your Bubble app uses
// Set VITE_JWT_SECRET in your .env.local file
const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'LKvxdhbxdyyGGGHvdqgkLkbXZADGjgfd';
const secret = new TextEncoder().encode(JWT_SECRET);

/**
 * Validate and decode a JWT token from Bubble
 */
export async function validateJWTToken(token: string): Promise<BubbleUser | null> {
  try {
    // Debug logging only in development
    if (import.meta.env.DEV) {
      console.log('JWT_SECRET from env:', JWT_SECRET?.substring(0, 10) + '...');
      console.log('Token to validate:', token.substring(0, 20) + '...');
    }
    
    // Decode and verify the token
    const { payload } = await jwtVerify(token, secret);
    const decoded = payload as unknown as JWTPayload;
    
    // Validate required fields
    if (!decoded.userId || !decoded.name || !decoded.userType || !Array.isArray(decoded.childIds)) {
      if (import.meta.env.DEV) {
        console.error('Invalid JWT payload: missing required fields');
      }
      return null;
    }
    
    // Handle childIds - if it's an array with comma-separated strings, split them
    let childIds = decoded.childIds;
    if (Array.isArray(childIds) && childIds.length === 1 && typeof childIds[0] === 'string' && childIds[0].includes(',')) {
      // Split the comma-separated string into separate IDs
      childIds = childIds[0].split(',').map(id => id.trim());
    }
    
    // Return user object
    return {
      id: decoded.userId,
      name: decoded.name,
      email: decoded.email,
      userType: decoded.userType,
      childIds: childIds,
      darkMode: decoded.darkMode || false,
      needsSpacer: decoded.needsSpacer || false,
      isAuthenticated: true,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('JWT validation failed:', error);
    }
    return null;
  }
}

/**
 * Create a test JWT token (for development/testing)
 * This simulates what Bubble would generate
 */
export async function createTestJWTToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const jwt = await new SignJWT({
    ...payload,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
    
  return jwt;
}

/**
 * Parse JWT token from URL parameters
 */
export function getTokenFromURL(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
}