import { SignJWT } from 'jose';

// Use the same secret as the app
const JWT_SECRET = 'LKvxdhbxdyyGGGHvdqgkLkbXZADGjgfd';
const secret = new TextEncoder().encode(JWT_SECRET);

async function createTestToken() {
  const payload = {
    userId: 'test-user-123',
    name: 'Test Parent',
    email: 'test@example.com',
    userType: 'Parent',
    childIds: ['test123'],
    darkMode: false,
    needsSpacer: false
  };

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
    
  console.log('TEST JWT TOKEN:');
  console.log(jwt);
  console.log('\nFull test URL:');
  console.log(`https://dcmsg2.vercel.app/?view=logs&childId=test123&childName=TestBaby&timezone=America/New_York&token=${jwt}`);
}

createTestToken().catch(console.error);