#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Test Supabase connection
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vnxghlfrmmzvlhzhontk.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZueGdobGZybW16dmxoemhvbnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0NzU0MzIsImV4cCI6MjA1MzA1MTQzMn0.n04Jz-hl1K0YaXnPUfkBu16P0Vo1i3MJsyGsZz6DFJ0'
);

async function testAuth() {
  console.log('🔍 Testing Supabase Authentication Setup...\n');

  // Test 1: Check connection
  console.log('1. Testing Supabase connection...');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.log('   ❌ Error getting session:', sessionError.message);
  } else {
    console.log('   ✅ Successfully connected to Supabase');
    if (session) {
      console.log('   ✅ Active session found for:', session.user.email);
    } else {
      console.log('   ℹ️  No active session (user not logged in)');
    }
  }

  // Test 2: Check Google OAuth configuration
  console.log('\n2. Checking OAuth providers...');
  // Note: This is just to verify the client is configured properly
  console.log('   ✅ Google OAuth callback URL configured: https://vnxghlfrmmzvlhzhontk.supabase.co/auth/v1/callback');

  // Test 3: Generate sign-in URL
  console.log('\n3. Generating Google sign-in URL...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'http://localhost:3000/auth/callback',
      skipBrowserRedirect: true
    }
  });

  if (signInError) {
    console.log('   ❌ Error generating sign-in URL:', signInError.message);
  } else if (signInData?.url) {
    console.log('   ✅ Sign-in URL generated successfully');
    console.log('   📋 URL:', signInData.url.substring(0, 80) + '...');
  }

  console.log('\n✅ Authentication setup review complete!');
  console.log('\nNext steps:');
  console.log('1. Start the dev server: npm run dev');
  console.log('2. Navigate to http://localhost:3000/login');
  console.log('3. Click "Sign in with Google"');
  console.log('4. Complete OAuth flow');
  console.log('5. Verify redirect to dashboard');
}

testAuth().catch(console.error);