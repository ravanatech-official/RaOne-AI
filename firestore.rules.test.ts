import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RULES_PATH = path.join(process.cwd(), 'firestore.rules');
const STORAGE_RULES_PATH = path.join(process.cwd(), 'storage.rules');
const BLUEPRINT_PATH = path.join(process.cwd(), 'firebase-blueprint.json');
const SECURITY_SPEC_PATH = path.join(process.cwd(), 'security_spec.md');

test('Firestore rules enforce Eight Pillars, Dirty Dozen protections, and zero blanket access', () => {
  const rules = fs.readFileSync(RULES_PATH, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8'));
  const spec = fs.readFileSync(SECURITY_SPEC_PATH, 'utf8');

  // Pillar 1: Global catch-all default deny + zero unguarded `if true;`
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
  assert.equal(/allow\s+(read|write)\s*:\s*if\s+true\s*;/.test(rules), false);

  // Pillar 2: Strict identity + verified email checks
  assert.match(rules, /function isSignedIn\(\)\s*\{\s*return request\.auth != null;\s*\}/);
  assert.match(rules, /function isVerifiedUser\(\)\s*\{\s*return isSignedIn\(\) && request\.auth\.token\.email_verified == true;\s*\}/);
  assert.match(rules, /request\.auth\.token\.email == null \|\| data\.email == request\.auth\.token\.email/);

  // Pillar 3 & 4: Ownership + no collection scraping on /users or /public_policies
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*allow list:\s*if false;/);
  assert.match(rules, /match \/public_policies\/\{policyId\}[\s\S]*allow list:\s*if false;[\s\S]*allow write:\s*if false;/);

  // Pillar 5: strict hasAll + hasOnly + non-empty trimmed strings + email regex
  assert.match(rules, /data\.keys\(\)\.hasAll\(/);
  assert.match(rules, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rules, /val\.trim\(\)\.size\(\) >= 1/);
  assert.match(rules, /data\.email\.matches\(/);

  // Pillar 6: Immutable ownership & timestamps + server time enforcement
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rules, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(rules, /incoming\(\)\.ownerId == existing\(\)\.ownerId/);
  assert.match(rules, /diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/);

  // Pillar 7: Backend Admin-SDK-only paths explicitly locked from client SDK
  for (const lockedPath of [
    '/tenants/{tenantId}/{document=**}',
    '/shared/{document=**}',
    '/audit_logs/{logId}',
    '/rate_limits/{limitId}',
    '/billing/{docId}',
    '/webhooks/{docId}',
  ]) {
    assert.ok(rules.includes(lockedPath), `Expected backend-only path lock for ${lockedPath}`);
  }

  // Blueprint alignment for every client collection
  for (const bpPath of [
    '/users/{userId}',
    '/users/{userId}/conversations/{conversationId}',
    '/users/{userId}/projects/{projectId}',
    '/users/{userId}/settings/{settingId}',
    '/users/{userId}/studioApps/{appId}',
    '/users/{userId}/documents/{docId}',
    '/public_policies/{policyId}',
  ]) {
    assert.ok(blueprint.firestore[bpPath], `Missing blueprint schema entry for ${bpPath}`);
  }
  assert.ok(spec.includes('Dirty Dozen Attack Payloads'));
});

test('Firebase Storage rules enforce strict default-deny against direct client access', () => {
  assert.equal(fs.existsSync(STORAGE_RULES_PATH), true, 'storage.rules must exist');
  const storageRules = fs.readFileSync(STORAGE_RULES_PATH, 'utf8');
  assert.match(storageRules, /service firebase\.storage/);
  assert.match(storageRules, /match \/\{allPaths=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});
