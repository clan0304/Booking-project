# Hair Salon Booking System - Architecture Documentation

> **Project Goal:** Build a hair salon booking system similar to Fresha  
> **Last Updated:** October 2025  
> **Architecture:** Clerk for Authentication, Supabase for Authorization (Simplified)

---

## 📋 Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Authentication Strategy](#authentication-strategy)
4. [Database Schema](#database-schema)
5. [User Types & Permissions](#user-types--permissions)
6. [Key Workflows](#key-workflows)
7. [Security Principles](#security-principles)
8. [Implementation Patterns](#implementation-patterns)
9. [Next Steps](#next-steps)

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 15+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js Server Actions, API Routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Clerk (Email/Password + Google OAuth)
- **Authorization:** Supabase (roles stored in database only)
- **Storage:** Supabase Storage (for user photos)
- **Data Access:** Service Role (server-side) for all operations

---

## 🏗️ Architecture Overview

### Core Principles

1. **Unified User Table**

   - Single `users` table for all user types (clients, team members, admins)
   - Avoids data duplication and inconsistencies
   - Handles role transitions seamlessly (e.g., client becomes team member)

2. **Separation of Concerns: Authentication vs Authorization**

   - **Clerk**: Handles authentication only (sign in/up, user identity)
   - **Supabase**: Single source of truth for authorization (roles, permissions)
   - No syncing needed between systems!
   - Roles stored ONLY in Supabase

3. **Role-Based Access Control**

   - Users can have multiple roles stored as an array: `['client', 'team_member', 'admin']`
   - Permissions enforced server-side with explicit filtering
   - Middleware queries Supabase to check roles for route protection
   - Role changes take effect immediately (no sign out/in required!)

4. **Server-Side Data Access Pattern**
   - **All operations use Service Role** (`supabaseAdmin`)
   - Server-side filtering ensures users only access their data
   - Auth checks via `requireAuth()`, `requireStaff()`, `requireAdmin()`
   - RLS policies disabled (Service Role bypasses them anyway)

### Architecture Flow

```
┌─────────────────────────────────────────────────┐
│         Authentication Flow                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  User Sign-up/Sign-in                           │
│         ↓                                        │
│    Clerk Authentication ✅                      │
│         ↓                                        │
│    Clerk Webhook Trigger                        │
│         ↓                                        │
│  Supabase Users Table (Create/Update)           │
│    - Stores user data + roles                   │
│    - NO sync back to Clerk!                     │
│         ↓                                        │
│  Onboarding (if needed)                         │
│         ↓                                        │
│  Dashboard                                       │
│                                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         Authorization Flow (NEW!)                │
├─────────────────────────────────────────────────┤
│                                                  │
│  User accesses protected route                  │
│         ↓                                        │
│  Middleware queries Supabase for roles          │
│    - Single DB query (~5-10ms)                  │
│    - Reads from users.roles column              │
│         ↓                                        │
│  Check permissions                               │
│         ↓                                        │
│  Allow or Redirect                               │
│                                                  │
│  ✅ Instant role changes!                       │
│  ✅ No JWT caching issues!                      │
│  ✅ Single source of truth!                     │
│                                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         Data Access Pattern                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  SERVER-SIDE ONLY (All Users)                   │
│         ↓                                        │
│  1. Server Component/Action                     │
│         ↓                                        │
│  2. Auth Check (requireAuth/requireStaff)       │
│    - Queries Supabase for user + roles          │
│         ↓                                        │
│  3. Service Role Query (supabaseAdmin)          │
│         ↓                                        │
│  4. Explicit Filtering by User/Role             │
│         ↓                                        │
│  5. Return Filtered Data                        │
│                                                  │
│  ✅ Simple, Secure, Easy to Maintain            │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Why This Architecture?

**Key Benefits:**

- ✅ **Simpler**: No role syncing between systems
- ✅ **More Secure**: Server-side code can't be inspected/modified by users
- ✅ **Easier to Debug**: Single source of truth for roles
- ✅ **Better for Business Logic**: Complex validations, calculations
- ✅ **Faster Development**: No sync utilities to maintain
- ✅ **Instant Updates**: Role changes take effect immediately without re-authentication

**Security via Server-Side Filtering:**

```typescript
// Client viewing own profile - filtered by their ID
const { userId } = await requireAuth();
const user = await supabaseAdmin
  .from('users')
  .select('*')
  .eq('clerk_user_id', userId) // ✅ Only their data
  .maybeSingle();

// Admin viewing all users - no filter
await requireAdmin();
const users = await supabaseAdmin.from('users').select('*'); // ✅ All data (admin verified)
```

---

## 🔐 Authentication Strategy

### Clerk + Supabase Integration Method

**Current Approach:** Clerk for Authentication, Supabase for Authorization

**How It Works:**

1. **User Authentication (Clerk)**

   - Clerk handles sign-in/sign-up
   - JWT token stored in browser (for Clerk sessions)
   - Server extracts `userId` from Clerk session

2. **User Authorization (Supabase)**

   - All role checks query Supabase directly
   - Middleware: One DB query per protected route
   - Auth helpers: Query Supabase for user + roles
   - Single source of truth: `users.roles` column

3. **Role Management**
   - Roles stored ONLY in Supabase `users.roles` array
   - NO syncing to Clerk metadata
   - Middleware checks roles by querying Supabase
   - Role changes effective immediately (no sign out needed!)

### Setup Requirements

1. **Clerk Configuration**

   - Email/Password authentication enabled
   - Google OAuth enabled
   - Webhook endpoint configured
   - NO JWT template needed!

2. **Supabase Configuration**

   - Service Role key in environment variables
   - Storage bucket: `user-photos` (public read)
   - Tables: users, client_notes, team_members
   - Index on `clerk_user_id` for fast lookups

3. **Clerk Webhooks**
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Endpoint: `/api/webhooks/clerk`
   - Syncs user data (email, name, photo) to Supabase
   - Does NOT sync roles (roles stay in Supabase only!)

### Two User Types

| Type                    | clerk_user_id | is_registered | Can Sign In? | Created By                   |
| ----------------------- | ------------- | ------------- | ------------ | ---------------------------- |
| **Registered User**     | ✅ Present    | `true`        | ✅ Yes       | Self sign-up or Admin invite |
| **Unregistered Client** | ❌ `null`     | `false`       | ❌ No        | Admin manual entry           |

**Key Insight:** Unregistered clients exist in the database for record-keeping but cannot authenticate until they claim their account.

---

## 🗄️ Database Schema

### Table Structure Overview

**1. Users Table**

- Stores all users (clients, team members, admins)
- Fields: id, clerk_user_id (nullable), email, first_name, last_name, phone_number, birthday, photo_url, roles (array), is_registered, onboarding_completed, alert_note
- Indexes on: clerk_user_id, email, roles
- **RLS:** Disabled (Service Role bypasses it)
- **IMPORTANT:** `roles` array is the ONLY source of truth for permissions

**2. Client Notes Table**

- Stores notes about clients (for team/admin reference)
- Fields: id, client_id, note, created_by, updated_by, timestamps
- Separate table for better audit trail and performance
- **RLS:** Disabled

**3. Team Members Table**

- Additional info for team members
- Fields: id, user_id (FK to users), position, bio, specialties (array), is_active, hire_date
- One-to-one relationship with users table
- **RLS:** Disabled

**4. Supabase Storage Bucket**

- Bucket: `user-photos`
- Public read access
- Server-side upload/delete (via Service Role)
- Path structure: `{clerk_user_id}/{timestamp}-{filename}`

### Why This Structure?

- **Unified users table:** Handles role transitions seamlessly
- **Separate notes table:** Better performance, audit trail, and queryability
- **Team members extension:** Keeps user data normalized while allowing role-specific fields
- **No RLS policies:** Simpler maintenance, security enforced in application code
- **Roles in database only:** No syncing complexity, instant updates

---

## 👥 User Types & Permissions

### Access Control Matrix

```
┌──────────────────────────────────────────────────────┐
│  Operation       │ Client  │ Team    │ Admin        │
├──────────────────┼─────────┼─────────┼──────────────┤
│ View own profile │ ✅      │ ✅      │ ✅           │
│ Edit own profile │ ✅      │ ✅      │ ✅           │
│ View all users   │ ❌      │ ✅      │ ✅           │
│ Edit any user    │ ❌      │ ❌      │ ✅           │
│ View alert_note  │ ❌      │ ✅      │ ✅           │
│ Edit alert_note  │ ❌      │ ✅      │ ✅           │
│ View notes       │ ❌      │ ✅      │ ✅           │
│ Manage notes     │ ❌      │ ✅      │ ✅           │
│ Manage roles     │ ❌      │ ❌      │ ✅           │
│ Admin panel      │ ❌      │ ✅      │ ✅           │
└──────────────────┴─────────┴─────────┴──────────────┘
```

### Permission Enforcement

**Server-Side Filtering Examples:**

```typescript
// CLIENT: View own profile only
const { userId } = await requireAuth();
const user = await supabaseAdmin
  .from('users')
  .select('first_name, last_name, phone_number, birthday, photo_url')
  .eq('clerk_user_id', userId)
  .maybeSingle();
// ✅ Returns only their data
// ❌ No roles, no alert_note, no other users

// TEAM MEMBER: View all clients
await requireStaff();
const clients = await supabaseAdmin
  .from('users')
  .select('*, alert_note')
  .contains('roles', ['client'])
  .order('created_at', { ascending: false });
// ✅ Returns all clients with alert notes
// ✅ Team member role verified server-side

// ADMIN: Full access
await requireAdmin();
const users = await supabaseAdmin.from('users').select('*');
// ✅ Returns all users, all fields
// ✅ Admin role verified server-side
```

### Role Capabilities

**Client**

- View and edit their own profile (name, phone, birthday, photo)
- Book appointments (future feature)
- Cannot see internal notes or alerts about themselves
- Cannot see other users
- Server filters all queries by their user ID

**Team Member**

- View all client profiles including alert notes
- Create, read, update, delete client notes
- Update client alert notes (allergies, preferences)
- View other team member profiles
- Access booking calendar (future feature)
- Cannot manage user roles or team member records

**Admin**

- Full access to all features
- Create/update/delete any user
- Add team members and manage their profiles
- Manage all client notes
- Change user roles (changes effective immediately!)
- All team member capabilities plus system administration

### Why Clients Can't See Their Own Notes

- **Privacy & Professionalism:** Internal notes may contain sensitive observations
- **Industry Standard:** Matches how professional salon systems (like Fresha) operate
- **Team Communication:** Notes are for staff-to-staff communication

---

## 🔄 Key Workflows

### Workflow 1: Self Sign-up (Email/Password)

```
User → Sign up with email/password
  ↓
Clerk creates account
  ↓
Webhook → Create user in Supabase (Service Role)
  - clerk_user_id: set
  - is_registered: true
  - roles: ['client']
  - onboarding_completed: false
  ↓
(NO sync back to Clerk!)
  ↓
Redirect to /onboarding
  ↓
User fills: phone number, photo (optional)
  ↓
Server Action: Upload photo (Service Role)
  ↓
Server Action: Update user (Service Role)
  - onboarding_completed: true
  ↓
Redirect to dashboard
```

### Workflow 2: Admin Adds Team Member

```
Admin → Fill out "Add Team Member" form
  ↓
Check if email exists in database
  ↓
IF user exists:
  - Add 'team_member' to roles array
  - Update Supabase only (no Clerk sync!)
  - Changes effective immediately!
  ↓
IF user doesn't exist:
  - Create unregistered user
  - roles: ['client', 'team_member']
  - clerk_user_id: null
  ↓
User can register later (account claiming)
  ↓
Webhook links Clerk ID to existing record
  ↓
Roles preserved, access granted immediately!
```

### Workflow 3: Admin Changes User Roles

```
Admin → Update user roles in database
  ↓
Server Action: Update roles in Supabase
  - Only updates users.roles column
  - NO sync to Clerk needed!
  ↓
User refreshes page
  ↓
Middleware queries Supabase for new roles
  ↓
✅ New permissions active immediately!
  ↓
(No sign out/in required!)
```

### Workflow 4: Client Edits Profile

```
Client → Go to /profile
  ↓
Server Component: Load user data
  - requireAuth() verifies authentication
  - Query filtered by user's clerk_user_id
  - Returns only their data (no roles, no alert_note)
  ↓
Client → Update form and submit
  ↓
Server Action: Update profile
  - Verify authentication
  - Upload photo if provided (Service Role)
  - Update allowed fields only
  - Cannot modify: roles, alert_note
  ↓
Success → Refresh page with updated data
```

---

## 🔒 Security Principles

### Authentication Security

✅ **DO:**

- Use `supabaseAdmin` (Service Role) for all database operations
- Always verify authentication with `requireAuth()` in server components/actions
- Always verify roles with `requireStaff()` or `requireAdmin()` for protected operations
- Filter queries by user ID for personal data (`.eq('clerk_user_id', userId)`)
- Store Service Role key in environment variables (never expose to client)
- Verify Clerk webhook signatures
- Use Server Actions for all data mutations

❌ **DON'T:**

- Never expose SUPABASE_SERVICE_ROLE_KEY to client-side code
- Don't trust client-side data without server validation
- Don't skip authentication checks in server actions
- Don't allow users to query data without proper filtering
- Don't store passwords or secrets in code repository
- Don't sync roles to Clerk (keep them in Supabase only!)

### Data Access Security

**Pattern for All Operations:**

```typescript
// 1. Server Component or Server Action
'use server';

export async function someOperation() {
  // 2. Verify authentication and role
  const { userId, roles } = await requireAuth(); // Queries Supabase

  // 3. Use Service Role with explicit filtering
  const data = await supabaseAdmin
    .from('table')
    .select('*')
    .eq('clerk_user_id', userId); // Filter by authenticated user

  // 4. Return only appropriate data
  return data;
}
```

**Security Layers:**

1. **Middleware** - Queries Supabase for roles, protects routes
2. **Auth Helpers** - Verify user identity and fetch permissions from DB
3. **Server-Side Filtering** - Explicit queries ensure data isolation
4. **Validation** - Check input data before database operations
5. **Audit Trail** - Log all sensitive operations

---

## 💻 Implementation Patterns

### Auth Helper Pattern

**Centralized auth functions:**

```typescript
// lib/auth.ts - Queries Supabase for roles
export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  // Fetch roles from Supabase (single source of truth)
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, roles')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!user) return null;

  return { userId, supabaseUserId: user.id, roles: user.roles };
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  return user;
}

export async function requireStaff() {
  const user = await requireAuth();
  const hasAccess = user.roles.some((r) =>
    ['admin', 'team_member'].includes(r)
  );
  if (!hasAccess) redirect('/unauthorized');
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!user.roles.includes('admin')) redirect('/unauthorized');
  return user;
}
```

**Benefits:**

- DRY principle
- Consistent auth checks
- Easy to test
- Type-safe
- Centralized redirect logic
- Single DB query per auth check

### Role Management Pattern

```typescript
// lib/role-management.ts - Simple role management
export async function updateUserRoles(userId: string, newRoles: UserRole[]) {
  // Just update Supabase - no sync needed!
  const { error } = await supabaseAdmin
    .from('users')
    .update({ roles: newRoles })
    .eq('id', userId);

  if (error) return { success: false, error: 'Failed to update roles' };

  // ✅ Changes effective immediately on next request!
  return { success: true };
}

export async function addRoleToUser(userId: string, role: UserRole) {
  // Get current roles
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('roles')
    .eq('id', userId)
    .single();

  if (user.roles.includes(role)) return { success: true };

  const newRoles = [...user.roles, role];
  return await updateUserRoles(userId, newRoles);
}
```

---

## 🚀 Development Roadmap

### Phase 1: Foundation ✅ (COMPLETED)

- [x] Architecture design
- [x] Supabase database setup
- [x] Database migration files
- [x] Webhook handler implementation
- [x] Supabase server utilities (supabaseAdmin)
- [x] Auth helper functions (lib/auth.ts)
- [x] Simplified type definitions
- [x] Environment configuration

### Phase 2: Authentication & Onboarding ✅ (COMPLETED)

- [x] Clerk authentication setup
- [x] Onboarding flow (email/password)
- [x] Onboarding flow (Google OAuth)
- [x] Photo upload functionality (server-side)
- [x] Middleware for route protection
- [x] Account claiming flow
- [x] Dashboard with onboarding check
- [x] Profile page with edit functionality

### Phase 2.5: Architecture Simplification ✅ (COMPLETED)

- [x] Removed role syncing between Clerk and Supabase
- [x] Updated auth helpers to query Supabase for roles
- [x] Updated middleware to check Supabase for authorization
- [x] Simplified webhook (no role sync)
- [x] Created role management utilities
- [x] Updated team member management
- [x] Instant role changes (no sign out/in needed!)

### Phase 3: Admin Panel (IN PROGRESS) 🎯

- [x] Team member list view
- [x] "Add Team Member" form with account claiming
- [x] Role management utilities
- [ ] Admin dashboard layout with navigation
- [ ] Client list page with search/filter
- [ ] "Add Client" form with validation
- [ ] Client detail page
- [ ] Client notes CRUD interface
- [ ] Alert note management

### Phase 4: Client Management (FUTURE)

- [ ] Advanced client search and filtering
- [ ] Bulk operations (export, delete)
- [ ] Client tags/categories
- [ ] Client communication history
- [ ] Booking history view
- [ ] Client preferences management

### Phase 5: Booking System (FUTURE)

- [ ] Services table design
- [ ] Service categories
- [ ] Appointment booking schema
- [ ] Booking flow for clients
- [ ] Calendar view for team
- [ ] Availability management
- [ ] Email notifications
- [ ] SMS reminders
- [ ] Booking confirmations

---

## 📚 Key Files Structure

```
project-root/
├── CLAUDE.md                          # This file
├── .env.local                         # Environment variables
├── next.config.ts                     # Next.js configuration
├── app/
│   ├── actions/
│   │   ├── onboarding.ts             # ✅ Onboarding server action
│   │   ├── profile.ts                # ✅ Profile update server action
│   │   └── team-members.ts           # ✅ Team member management (simplified)
│   ├── api/
│   │   └── webhooks/
│   │       └── clerk/
│   │           └── route.ts          # ✅ Clerk webhook (no role sync!)
│   ├── onboarding/
│   │   └── page.tsx                  # ✅ Onboarding flow
│   ├── profile/
│   │   └── page.tsx                  # ✅ Profile page (server component)
│   ├── dashboard/
│   │   └── page.tsx                  # ✅ Client dashboard
│   ├── admin/
│   │   ├── page.tsx                  # ✅ Admin dashboard
│   │   ├── team/
│   │   │   ├── page.tsx              # ✅ Team member list
│   │   │   └── add/page.tsx          # ✅ Add team member form
│   │   └── clients/
│   │       ├── page.tsx              # Client list (TODO)
│   │       ├── add/page.tsx          # Add client form (TODO)
│   │       └── [id]/page.tsx         # Client detail (TODO)
│   ├── sign-in/
│   │   └── [[...sign-in]]/
│   │       └── page.tsx              # ✅ Sign-in/Sign-up page
│   ├── unauthorized/
│   │   └── page.tsx                  # ✅ 403 page
│   └── middleware.ts                 # ✅ Route protection (queries Supabase)
├── components/
│   ├── profile-form.tsx              # ✅ Profile form component
│   ├── add-team-member-form.tsx      # ✅ Team member form
│   └── navbar.tsx                    # ✅ Navigation bar (created in progress)
├── lib/
│   ├── auth.ts                       # ✅ Auth helpers (query Supabase for roles)
│   ├── role-management.ts            # ✅ Role management (no Clerk sync)
│   └── supabase/
│       ├── client.ts                 # ✅ Client-side Supabase (for future use)
│       └── server.ts                 # ✅ Server-side Supabase (supabaseAdmin)
├── types/
│   └── database.ts                   # ✅ Simplified TypeScript types
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql    # ✅ Database schema
```

---

## 🎯 Critical Decisions Summary

| Decision                   | Choice                            | Rationale                                           |
| -------------------------- | --------------------------------- | --------------------------------------------------- |
| **Data Access Pattern**    | Service Role (server-side)        | Simpler, more secure, easier to maintain            |
| **Authorization Pattern**  | Supabase only (no Clerk metadata) | Single source of truth, instant updates, no syncing |
| **Role Storage**           | Supabase users.roles ONLY         | No JWT caching issues, instant changes, simpler     |
| **Role Changes**           | Immediate (no re-auth)            | Better UX, middleware queries DB on each request    |
| **Client Data Access**     | Server-side with filtering        | Users access own data via filtered queries          |
| **RLS Policies**           | Disabled                          | Not needed with Service Role                        |
| **User Table Structure**   | Unified table with roles array    | Handles role transitions, single source of truth    |
| **Authentication**         | Clerk                             | Industry standard, OAuth support, handles auth only |
| **Client Notes**           | Separate table                    | Better audit trail, performance, queryability       |
| **Unregistered Clients**   | clerk_user_id nullable            | Supports walk-in clients, admin-created records     |
| **Photo Storage**          | Supabase Storage                  | Integrated with database, simple permissions        |
| **Photo Upload**           | Server-side (Service Role)        | Secure, no body size limits                         |
| **Team Access to Notes**   | Full CRUD access                  | Team members need client history for service        |
| **Client Access to Notes** | No access                         | Privacy, professionalism, industry standard         |
| **Server Actions**         | Preferred for all mutations       | Type-safe, simpler, better DX                       |
| **Type Management**        | Simplified, minimal types         | Easy to maintain, less boilerplate                  |
| **Performance Trade-off**  | +5-10ms per request (DB query)    | Worth it for simplicity and instant updates         |

---

## 🔧 Environment Variables

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

---

## 📖 References

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Clerk Documentation](https://clerk.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Component Library](https://ui.shadcn.com/)

---

## 📝 Recent Updates

**October 2025:**

- ✅ Completed Phase 1: Foundation
- ✅ Completed Phase 2: Authentication & Onboarding
- ✅ **Completed Phase 2.5: Major Architecture Simplification**
  - Removed all role syncing between Clerk and Supabase
  - Roles now stored ONLY in Supabase (single source of truth)
  - Auth helpers query Supabase for roles on every request
  - Middleware queries Supabase for authorization checks
  - Role changes take effect immediately (no sign out/in needed!)
  - Simplified codebase: removed `lib/clerk-sync.ts`, `lib/role-sync.ts`, `app/actions/sync-roles.ts`
  - Created `lib/role-management.ts` for simple role updates
  - Updated webhook to NOT sync roles back to Clerk
  - Team member management now works with instant role updates
- 🎯 In Progress: Phase 3 - Admin Panel
  - Created team member list page
  - Created add team member form with account claiming
  - Next: Client management pages

**Architecture Decision - MAJOR CHANGE:**

- **Previous:** Roles synced between Clerk metadata and Supabase (complex, JWT caching issues)
- **Current:** Roles stored ONLY in Supabase, queried on each request (simple, instant updates!)
- **Benefit:**
  - 50% less code to maintain
  - No more "sign out and sign in again" messages
  - Role changes effective immediately
  - Single source of truth
  - Industry standard pattern: "Clerk for authn, DB for authz"

---

## 🔮 Comparison: Before vs After

### Before (Complex)

```
Admin changes role:
1. Update Supabase ✍️
2. Sync to Clerk metadata ✍️
3. User signs out ✍️
4. User signs in ✍️
5. New JWT issued with roles ✍️
6. Middleware reads JWT ✍️
7. ✅ Access granted

Problems:
- Multiple steps
- User friction
- JWT caching issues
- Two sources of truth
- Sync failures possible
```

### After (Simple!)

```
Admin changes role:
1. Update Supabase ✍️
2. User refreshes page ✍️
3. Middleware queries Supabase ✍️
4. ✅ Access granted immediately!

Benefits:
- Single step
- No user action needed
- No caching issues
- Single source of truth
- Always consistent
```

---

**Document Status:** Living document - update as architecture evolves  
**Next Review:** After Phase 3 completion (Admin Panel)  
**Architecture:** Clerk for Authentication, Supabase for Authorization (Finalized & Simplified)  
**Last Major Change:** Removed role syncing, simplified authorization pattern
