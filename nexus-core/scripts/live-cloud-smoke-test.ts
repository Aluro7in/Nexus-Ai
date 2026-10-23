/**
 * Nexus AI — Safe Live Cloud Firestore Smoke Test & Persistence Validator
 *
 * Runs an isolated live verification against Google Cloud Firestore:
 * 1. Verifies ADC / GOOGLE_APPLICATION_CREDENTIALS presence.
 * 2. Connects to the configured project and named database.
 * 3. Writes a temporary probe document to a dedicated health-check collection (`nexus_health_checks`).
 * 4. Reads the probe document back and asserts field integrity.
 * 5. Deletes the temporary probe document and verifies cleanup.
 * 6. Tests real task persistence across backend restarts against live Firestore.
 * 7. Cleans up the test task.
 *
 * Safety Invariants:
 * - Never reads, modifies, or deletes existing application or user records.
 * - Never prints credential contents, access tokens, or private keys.
 */

import crypto from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { GoogleAuth } from 'google-auth-library';
import {
  FirestoreStorageAdapter,
  DEFAULT_FIREBASE_PROJECT_ID,
  DEFAULT_FIRESTORE_DATABASE_ID,
} from '../src/store/firestore.js';

async function main() {
  console.log('================================================================');
  console.log('🚀 Nexus AI — Cloud Firestore Live Smoke Test');
  console.log('================================================================\n');

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    DEFAULT_FIREBASE_PROJECT_ID;

  const databaseId =
    process.env.FIRESTORE_DATABASE_ID ||
    DEFAULT_FIRESTORE_DATABASE_ID;

  console.log(`📌 Target Project ID:   ${projectId}`);
  console.log(`📌 Target Database ID:  ${databaseId}`);

  // ── Step 1: Credential Discovery Check ─────────────────────────────────────
  console.log('\n[1/5] Checking Google Cloud Credentials...');
  const auth = new GoogleAuth();
  let client;
  try {
    client = await auth.getApplicationDefault();
    console.log('✅ ADC or Service Account Credentials detected successfully.');
  } catch (err: any) {
    console.error('❌ Credential check failed: Could not load credentials.');
    console.error(`   Details: ${err.message}`);
    console.error('\n⚠️  Stopping live-cloud smoke test. Cloud connectivity cannot be claimed without valid credentials.');
    process.exit(1);
  }

  // ── Step 2: Initialize Live Firestore Client ──────────────────────────────
  console.log('\n[2/5] Initializing Google Cloud Firestore client...');
  const firestore = new Firestore({
    projectId,
    databaseId,
  });

  // ── Step 3: Isolated Probe Document (Write, Read, Delete) ──────────────────
  console.log('\n[3/5] Performing isolated probe test on dedicated "nexus_health_checks" collection...');
  const probeId = `probe_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const probeRef = firestore.collection('nexus_health_checks').doc(probeId);
  const probeData = {
    probeId,
    purpose: 'live_cloud_smoke_test',
    createdAt: new Date().toISOString(),
    environment: 'nexus-core-phase-8b',
    status: 'ACTIVE',
  };

  try {
    // 3a. Write probe document
    await probeRef.set(probeData);
    console.log(`   ✅ Successfully wrote probe document: nexus_health_checks/${probeId}`);

    // 3b. Read probe document back
    const snap = await probeRef.get();
    if (!snap.exists) {
      throw new Error(`Probe document ${probeId} was not found after write.`);
    }
    const readBack = snap.data();
    if (readBack?.probeId !== probeId || readBack?.status !== 'ACTIVE') {
      throw new Error(`Probe document data mismatch: ${JSON.stringify(readBack)}`);
    }
    console.log('   ✅ Successfully read back probe document. Field values match expected.');

    // 3c. Delete probe document
    await probeRef.delete();
    const afterDelete = await probeRef.get();
    if (afterDelete.exists) {
      throw new Error(`Probe document ${probeId} still exists after deletion.`);
    }
    console.log('   ✅ Successfully deleted temporary probe document. Cleanup confirmed.');
  } catch (err: any) {
    console.error(`❌ Probe test failed on database "${databaseId}":`, err.message);
    process.exit(1);
  }

  // ── Step 4: Real Task Persistence Across Backend Restart ──────────────────
  console.log('\n[4/5] Testing real task persistence across server restart on live Firestore...');
  const testUserId = `smoke_test_user_${Date.now()}`;
  const clientRequestId = `req_smoke_${Date.now()}`;

  // Process 1: Create task
  const adapterInstance1 = new FirestoreStorageAdapter({
    firestore,
    projectId,
    databaseId,
  });

  const createdTask = await adapterInstance1.createTask({
    title: 'Live Cloud Smoke Test Task',
    description: 'Verifies real persistence across restarts on live Google Cloud Firestore.',
    priority: 'HIGH',
    userId: testUserId,
    clientRequestId,
  });
  console.log(`   ✅ Task created: ${createdTask.id} (Owner: ${createdTask.userId})`);

  // Direct Firestore document check
  const directTaskDoc = await firestore.collection('tasks').doc(createdTask.id).get();
  if (!directTaskDoc.exists) {
    throw new Error(`Task document ${createdTask.id} not found in Firestore tasks collection.`);
  }
  console.log(`   ✅ Task verified directly in Firestore /tasks/${createdTask.id}`);

  // Process 2: Simulate backend restart with a new adapter instance
  console.log('   🔄 Simulating backend restart (instantiating new adapter instance)...');
  const adapterInstance2 = new FirestoreStorageAdapter({
    firestore: new Firestore({ projectId, databaseId }),
    projectId,
    databaseId,
  });

  const recoveredTask = await adapterInstance2.getTask(createdTask.id, testUserId);
  if (!recoveredTask) {
    throw new Error(`Task ${createdTask.id} could not be retrieved by the restarted backend instance.`);
  }

  if (
    recoveredTask.id !== createdTask.id ||
    recoveredTask.title !== createdTask.title ||
    recoveredTask.userId !== testUserId ||
    recoveredTask.status !== 'PENDING'
  ) {
    throw new Error(`Recovered task attribute mismatch: ${JSON.stringify(recoveredTask)}`);
  }
  console.log('   ✅ Recovered task matches all attributes (ID, owner, title, status) across restart.');

  // ── Step 5: Clean Up Test Task ────────────────────────────────────────────
  console.log('\n[5/5] Cleaning up test task...');
  const deleted = await adapterInstance2.deleteTask(createdTask.id, testUserId);
  if (!deleted) {
    throw new Error(`Failed to delete smoke test task ${createdTask.id}`);
  }
  const afterTaskDelete = await adapterInstance2.getTask(createdTask.id, testUserId);
  if (afterTaskDelete !== null) {
    throw new Error(`Task ${createdTask.id} still exists after cleanup.`);
  }
  console.log('   ✅ Test task cleaned up successfully.');

  console.log('\n================================================================');
  console.log('🎉 ALL LIVE CLOUD FIRESTORE SMOKE TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\nFatal smoke test error:', err);
  process.exit(1);
});
