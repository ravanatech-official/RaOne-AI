# RaOne AI — Firestore Security Specification (Phase 0 TDD)

## Data Invariants
1. **Default Deny**: All unmatched Firestore paths deny read and write access (`match /{document=**} { allow read, write: if false; }`).
2. **Backend-Managed Multi-Tenant Isolation**: `/tenants/{tenantId}/**` and `/shared/**` are strictly server-only via `firebase-admin` (`server_cloud_persistence.ts`) and deny all direct client SDK reads/writes.
3. **Strict Owner Isolation & Verified Identity**: Client-accessible `/users/{userId}` and its subcollections (`conversations`, `projects`, `settings`, `studioApps`, `documents`) require `request.auth != null`, `request.auth.uid == userId`, `request.auth.token.email_verified == true`, valid path IDs (`isValidId()`), strict allowlisted keys (`hasAll` + `hasOnly`), immutable ownership/timestamps (`ownerId`, `createdAt`), and server-time enforcement (`request.time`).
4. **PII Protection**: User profile records containing `email` are never readable by non-owners or via blanket signed-in list queries.
5. **Public Policies & Connection Probe**: `/public_policies/{policyId}` allows read-only `get`; `/test/connection` allows authenticated `get` for startup connectivity checks and denies all writes.

## Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/u1`.
2. Cross-tenant read/write by authenticated user `u2` on `/users/u1/projects/p1`.
3. Unverified email user (`email_verified == false`) attempting to create `/users/u1/projects/p1`.
4. Shadow field injection (`isAdmin: true`, `role: "admin"`) on `/users/u1` create or update.
5. Identity spoofing (`ownerId: "victim-uid"`) inside `/users/u1/conversations/c1`.
6. Oversized document ID (>128 chars) or invalid characters (`../etc/passwd`) on `/users/u1/projects/{projectId}`.
7. Oversized title string (>240 chars) or wrong field type (`title: 12345`) on `/users/u1/documents/d1`.
8. Client-spoofed `createdAt` or `updatedAt` timestamp not equal to `request.time`.
9. Mutating immutable `createdAt` or `ownerId` during an update on `/users/u1/studioApps/a1`.
10. Blanket `list` query on `/users` or `/public_policies` attempting collection scraping.
11. Direct client read or write on `/tenants/user_u1/state/byok_keys` (server Admin SDK vault).
12. Direct client write to `/public_policies/privacy` or `/test/connection`.
