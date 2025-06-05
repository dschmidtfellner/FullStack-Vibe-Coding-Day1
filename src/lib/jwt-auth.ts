import { jwtVerify, SignJWT } from 'jose';

// JWT payload interface - what Bubble will send
export interface JWTPayload {
  userId: string;        // Bubble user ID
  name: string;          // User's display name
  email?: string;        // Optional email
  userType: string;      // "Coach" or "Parent"
  childIds: string[];    // Array of child IDs this user can access
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
  isAuthenticated: boolean;
}

// JWT Secret - must match what your Bubble app uses
// Set VITE_JWT_SECRET in your .env.local file
const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'your-production-jwt-secret-here';
const secret = new TextEncoder().encode(JWT_SECRET);

/**
 * Validate and decode a JWT token from Bubble
 */
export async function validateJWTToken(token: string): Promise<BubbleUser | null> {
  try {
    // Decode and verify the token
    const { payload } = await jwtVerify(token, secret);
    const decoded = payload as JWTPayload;
    
    // Validate required fields
    if (!decoded.userId || !decoded.name || !decoded.userType || !Array.isArray(decoded.childIds)) {
      console.error('Invalid JWT payload: missing required fields');
      return null;
    }
    
    // Return user object
    return {
      id: decoded.userId,
      name: decoded.name,
      email: decoded.email,
      userType: decoded.userType,
      childIds: decoded.childIds,
      isAuthenticated: true,
    };
  } catch (error) {
    console.error('JWT validation failed:', error);
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

/**
 * Create test users for development
 */
export async function createTestUsers() {
  return {
    parent1: await createTestJWTToken({
      userId: 'parent_1',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      role: 'parent',
      childIds: ['child_123']
    }),
    parent2: await createTestJWTToken({
      userId: 'parent_2', 
      name: 'Mike Wilson',
      email: 'mike@example.com',
      role: 'parent',
      childIds: ['child_456']
    }),
    provider: await createTestJWTToken({
      userId: 'provider_1',
      name: 'Dr. Lisa Chen',
      email: 'lisa@clinic.com',
      role: 'provider',
      childIds: ['child_123', 'child_456', 'child_789']
    }),
    admin: await createTestJWTToken({
      userId: 'admin_1',
      name: 'Admin User',
      email: 'admin@example.com', 
      role: 'admin',
      childIds: ['child_123', 'child_456', 'child_789', 'child_999']
    })
  };
}