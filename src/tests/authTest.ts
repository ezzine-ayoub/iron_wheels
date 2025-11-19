/**
 * 🧪 Test Auth Service - User ID Storage
 * 
 * Ce test vérifie que le login sauvegarde correctement l'ID utilisateur
 * et que getStoredAuthData() retourne bien toutes les données incluant l'ID
 */

import { authService } from '../services/authService';

export async function testAuthStorage() {
  console.log('\n🧪 ========== TEST AUTH STORAGE ==========\n');

  try {
    // 1. Test: Vérifier la session actuelle
    console.log('📋 Test 1: Checking current session...');
    const currentAuth = await authService.getStoredAuthData();
    
    if (currentAuth) {
      console.log('✅ Session found:');
      console.log('   - User ID:', currentAuth.id || '❌ MISSING');
      console.log('   - Name:', currentAuth.name || 'Not set');
      console.log('   - Email:', currentAuth.email || 'Not set');
      console.log('   - Phone:', currentAuth.phone || 'Not set');
      console.log('   - Personal No:', currentAuth.personalNo || 'Not set');
      
      if (!currentAuth.id) {
        console.error('❌ CRITICAL: User ID is missing from session!');
        return false;
      } else {
        console.log('✅ User ID is present in session');
      }
    } else {
      console.log('⚠️ No active session found');
      console.log('💡 Please login first to test the storage');
      return false;
    }

    // 2. Test: Vérifier isAuthenticated
    console.log('\n📋 Test 2: Checking authentication status...');
    const isAuth = await authService.isAuthenticated();
    console.log(isAuth ? '✅ User is authenticated' : '❌ User is NOT authenticated');

    // 3. Test: Vérifier getCurrentUser
    console.log('\n📋 Test 3: Getting current user...');
    const currentUser = await authService.getCurrentUser();
    
    if (currentUser) {
      console.log('✅ Current user retrieved:');
      console.log('   - User ID:', currentUser.id || '❌ MISSING');
      console.log('   - Name:', currentUser.name);
      console.log('   - Email:', currentUser.email);
      
      if (!currentUser.id) {
        console.error('❌ CRITICAL: User ID is missing from getCurrentUser!');
        return false;
      }
    } else {
      console.log('❌ Could not retrieve current user');
      return false;
    }

    console.log('\n✅ ========== ALL TESTS PASSED ==========\n');
    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

/**
 * 🧪 Test complet du flow Login -> Storage -> Retrieve
 */
export async function testFullLoginFlow(credentials: { driverNo: string; password: string }) {
  console.log('\n🧪 ========== TEST FULL LOGIN FLOW ==========\n');

  try {
    // 1. Login
    console.log('📋 Step 1: Login...');
    const loginResponse = await authService.login(credentials);
    
    console.log('✅ Login successful');
    console.log('   - User ID from login:', loginResponse.id || '❌ MISSING');
    console.log('   - Password Changed:', loginResponse.passwordChanged);
    console.log('   - Profile Completed:', loginResponse.profileCompleted);

    if (!loginResponse.id) {
      console.error('❌ CRITICAL: Login response has no user ID!');
      return false;
    }

    // 2. Wait a bit for storage to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Retrieve from storage
    console.log('\n📋 Step 2: Retrieving from storage...');
    const storedAuth = await authService.getStoredAuthData();

    if (!storedAuth) {
      console.error('❌ CRITICAL: Could not retrieve stored auth data!');
      return false;
    }

    console.log('✅ Data retrieved from storage');
    console.log('   - User ID from storage:', storedAuth.id || '❌ MISSING');
    console.log('   - Name:', storedAuth.name);
    console.log('   - Email:', storedAuth.email);

    // 4. Verify ID matches
    if (loginResponse.id !== storedAuth.id) {
      console.error('❌ CRITICAL: User ID mismatch!');
      console.error('   - Login response ID:', loginResponse.id);
      console.error('   - Stored ID:', storedAuth.id);
      return false;
    }

    console.log('\n✅ ========== FULL LOGIN FLOW TEST PASSED ==========\n');
    return true;

  } catch (error) {
    console.error('❌ Full login flow test failed:', error);
    return false;
  }
}

/**
 * 🧪 Fonction helper pour exécuter tous les tests
 */
export async function runAllAuthTests(credentials?: { driverNo: string; password: string }) {
  console.log('\n🚀 Running all auth tests...\n');
  
  // Test 1: Storage test
  const storageTestPassed = await testAuthStorage();
  
  // Test 2: Full flow test (only if credentials provided)
  let fullFlowTestPassed = true;
  if (credentials) {
    fullFlowTestPassed = await testFullLoginFlow(credentials);
  } else {
    console.log('\n⚠️ Skipping full login flow test (no credentials provided)');
  }
  
  // Summary
  console.log('\n📊 ========== TEST SUMMARY ==========');
  console.log(`Storage Test: ${storageTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Full Flow Test: ${credentials ? (fullFlowTestPassed ? '✅ PASSED' : '❌ FAILED') : '⏭️ SKIPPED'}`);
  console.log('=====================================\n');
  
  return storageTestPassed && fullFlowTestPassed;
}
