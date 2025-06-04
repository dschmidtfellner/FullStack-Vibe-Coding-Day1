const { SignJWT } = require('jose');

// Use the same secret as the app
const JWT_SECRET = 'your-bubble-jwt-secret-change-this-in-production';
const secret = new TextEncoder().encode(JWT_SECRET);

// Create test users
const testUsers = [
  {
    name: 'Sarah Johnson',
    userId: 'parent_1',
    role: 'parent',
    childIds: ['child_123'],
    email: 'sarah@example.com'
  },
  {
    name: 'Mike Wilson', 
    userId: 'parent_2',
    role: 'parent',
    childIds: ['child_456'],
    email: 'mike@example.com'
  },
  {
    name: 'Dr. Lisa Chen',
    userId: 'provider_1',
    role: 'provider', 
    childIds: ['child_123', 'child_456', 'child_789'],
    email: 'lisa@clinic.com'
  },
  {
    name: 'Admin User',
    userId: 'admin_1',
    role: 'admin',
    childIds: ['child_123', 'child_456', 'child_789', 'child_999'],
    email: 'admin@example.com'
  }
];

async function generateTokens() {
  console.log('🔑 JWT Test Tokens Generated\n');
  console.log('Copy these URLs to test different user scenarios:\n');

  for (const user of testUsers) {
    const token = await new SignJWT(user)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

  console.log(`\n📋 ${user.name} (${user.role})`);
  console.log(`   Access: ${user.childIds.join(', ')}`);
  console.log(`   Token: ${token}\n`);
  
  // Test URLs for different scenarios
  console.log('   Test URLs:');
  
  // Authorized access
  const authorizedChildId = user.childIds[0];
  console.log(`   ✅ Authorized: http://localhost:5173/?childId=${authorizedChildId}&token=${token}`);
  
  // Unauthorized access (if not admin)
  if (user.role !== 'admin') {
    const unauthorizedChildId = 'child_999';
    console.log(`   ❌ Unauthorized: http://localhost:5173/?childId=${unauthorizedChildId}&token=${token}`);
  }
  
    console.log('   ' + '-'.repeat(80));
  }

  // Generate some error case tokens
  console.log('\n\n🚨 Error Case Tests:\n');

  // Expired token
  const expiredToken = await new SignJWT({
    userId: 'test_user',
    name: 'Expired User',
    role: 'parent',
    childIds: ['child_123'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 1000)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 500) // Expired 500 seconds ago
    .sign(secret);

  console.log('❌ Expired Token Test:');
  console.log(`   http://localhost:5173/?childId=child_123&token=${expiredToken}`);

  console.log('\n❌ Invalid Token Test:');
  console.log(`   http://localhost:5173/?childId=child_123&token=invalid.token.here`);

  console.log('\n❌ No Token Test:');
  console.log(`   http://localhost:5173/?childId=child_123`);

  console.log('\n\n🧪 Testing Instructions:');
  console.log('1. Start your dev server: pnpm run dev');
  console.log('2. Copy and paste the URLs above into your browser');
  console.log('3. Verify that users can only access authorized conversations');
  console.log('4. Check that error cases show appropriate error messages');
  console.log('5. Test all messaging features (send, reactions, audio, etc.)');
}

// Run the async function
generateTokens().catch(console.error);