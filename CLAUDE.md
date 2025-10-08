# Hair Salon Booking System - Architecture Documentation

> **Project Goal:** Build a hair salon booking system similar to Fresha  
> **Last Updated:** October 2025  
> **Architecture:** Server-Side with Service Role

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
- **Storage:** Supabase Storage (for user photos)
- **Data Access:** Service Role (server-side) for all operations

---

## 🏗️ Architecture Overview

### Core Principles

1. **Unified User Table**

   - Single `users` table for all user types (clients, team members, admins)
   - Avoids data duplication and inconsistencies
   - Handles role transitions seamlessly (e.g., client becomes team member)

2. **Role-Based Access Control**

   - Users can have multiple roles stored as an array: `['client', 'team_member', 'admin']`
   - Permissions enforced server-side with explicit filtering
   - Middleware protects routes based on roles

3. **Server-Side Data Access Pattern**

   - **All operations use Service Role** (`supabaseAdmin`)
   - Server-side filtering ensures users only access their data
   - Auth checks via `requireAuth()`, `requireStaff()`, `requireAdmin()`
   - RLS policies disabled (Service Role bypasses them anyway)

4. **Clerk as Single Source of Truth**
   - Clerk handles all authentication
   - Supabase syncs user data via webhooks
   - Clerk user ID links the two systems
   - Roles synced to Clerk metadata for JWT claims

### Architecture Flow

```
┌─────────────────────────────────────────────────┐
│         Authentication Flow                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  User Sign-up/Sign-in                           │
│         ↓                                        │
│    Clerk Authentication                         │
│         ↓                                        │
│    Clerk Webhook Trigger                        │
│         ↓                                        │
│  Supabase Users Table (Create/Update)           │
│         ↓                                        │
│  Roles Synced to Clerk Metadata                 │
│         ↓                                        │
│  Onboarding (if needed)                         │
│         ↓                                        │
│  Dashboard                                       │
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

### Why Service Role for Everything?

**Advantages:**

- ✅ **Simpler**: One authentication pattern throughout
- ✅ **More Secure**: Server-side code can't be inspected/modified by users
- ✅ **Easier to Debug**: Clear error messages, server logs
- ✅ **Better for Business Logic**: Complex validations, calculations, emails
- ✅ **Faster Development**: No JWT config, no RLS policies to maintain

**Security via Server-Side Filtering:**

```typescript
// Client viewing own profile - filtered by their ID
const { userId } = await requireAuth();
const user = await supabaseAdmin
  .from('users')
  .select('*')
  .eq('clerk_user_id', userId) // ✅ Only their data
  .single();

// Admin viewing all users - no filter
await requireAdmin();
const users = await supabaseAdmin.from('users').select('*'); // ✅ All data (admin verified)
```

---

## 🔐 Authentication Strategy

### Clerk + Supabase Integration Method

**Current Approach:** Server-side authentication with Service Role

**How It Works:**

1. **User Authentication**

   - Clerk handles sign-in/sign-up
   - JWT token stored in browser (for Clerk sessions)
   - Server extracts `userId` from Clerk session

2. **Data Access**

   - All data queries use `supabaseAdmin` (Service Role)
   - Server-side code validates auth and filters data
   - Users never directly access Supabase

3. **Role Management**
   - Roles stored in Supabase `users.roles` array
   - Synced to Clerk `publicMetadata.roles` via webhook
   - Middleware checks roles for route protection
   - Server actions verify roles before operations

### Setup Requirements

1. **Clerk Configuration**

   - Email/Password authentication enabled
   - Google OAuth enabled
   - JWT template: `supabase` (optional, for future use)
   - Webhook endpoint configured

2. **Supabase Configuration**

   - Service Role key in environment variables
   - Storage bucket: `user-photos` (public read)
   - Tables: users, client_notes, team_members

3. **Clerk Webhooks**
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Endpoint: `/api/webhooks/clerk`
   - Syncs user data and roles between systems

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
  .single();
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
- Change user roles
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
Webhook → Sync roles to Clerk metadata
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

### Workflow 2: Self Sign-up (Google OAuth)

```
User → Sign up with Google
  ↓
Clerk OAuth (auto-fills name from Google)
  ↓
Webhook → Create user in Supabase (Service Role)
  - clerk_user_id: set
  - first_name & last_name: from Google
  - is_registered: true
  - roles: ['client']
  - onboarding_completed: false
  ↓
Webhook → Sync roles to Clerk metadata
  ↓
Redirect to /onboarding
  ↓
User fills: phone number, photo (optional)
  ↓
Server Action: Complete onboarding (Service Role)
  ↓
Redirect to dashboard
```

### Workflow 3: Admin Creates Unregistered Client

```
Admin → Open "Add Client" form
  ↓
Admin enters: first name (required), other fields (optional)
  ↓
Server Action: Verify admin role
  ↓
Server Action: Create user (Service Role)
  - clerk_user_id: null
  - is_registered: false
  - roles: ['client']
  - onboarding_completed: true
  ↓
Client exists in database but cannot sign in
  ↓
Optional: Send invite email (future feature)
```

**Use Case:** Walk-in clients, phone bookings, or clients without email

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
  - Sync name to Clerk
  - Cannot modify: roles, alert_note
  ↓
Success → Refresh page with updated data
```

### Workflow 5: Admin Manages User Roles

```
Admin → Go to /admin/clients/[id]
  ↓
Server Component: Load user data
  - requireAdmin() verifies admin role
  - Load full user data including roles
  ↓
Admin → Update roles array
  ↓
Server Action: Update user roles
  - Verify admin role
  - Update roles in Supabase (Service Role)
  - Sync roles to Clerk metadata
  ↓
User → Sign out and sign in
  ↓
New roles active in JWT and middleware
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

### Data Access Security

**Pattern for All Operations:**

```typescript
// 1. Server Component or Server Action
'use server';

export async function someOperation() {
  // 2. Verify authentication and role
  const { userId } = await requireAuth(); // or requireStaff/requireAdmin

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

1. **Middleware** - Protects routes based on authentication and roles
2. **Auth Helpers** - Verify user identity and permissions
3. **Server-Side Filtering** - Explicit queries ensure data isolation
4. **Validation** - Check input data before database operations
5. **Audit Trail** - Log all sensitive operations

### Photo Upload Security

- Allowed file types: JPEG, PNG, WebP only
- Max file size: 5MB (configured in next.config.ts)
- Server-side validation of file type and size
- Upload via Service Role (server action)
- Path structure: `{clerk_user_id}/{timestamp}-{filename}`
- Public bucket with read access only
- Delete old photos when uploading new ones

---

## 💻 Implementation Patterns

### Server Actions vs API Routes

**Use Server Actions for:**

- ✅ Form submissions (onboarding, profile updates, client management)
- ✅ Data mutations (create, update, delete)
- ✅ Internal operations
- ✅ Type-safe operations
- ✅ File uploads

**Use API Routes for:**

- ✅ Webhooks (Clerk, Stripe)
- ✅ External integrations
- ✅ Public endpoints
- ✅ OAuth callbacks

### Data Loading Pattern

**Server Component Pattern:**

```typescript
// app/some-page/page.tsx
export default async function Page() {
  // 1. Auth check
  const { userId } = await requireAuth();

  // 2. Load data with Service Role + filtering
  const data = await supabaseAdmin
    .from('table')
    .select('*')
    .eq('user_id', userId);

  // 3. Pass to client component
  return <ClientComponent data={data} />;
}
```

**Client Component Pattern:**

```typescript
// components/some-component.tsx
'use client';

export default function ClientComponent({ data }) {
  const [state, setState] = useState(data);

  async function handleSubmit() {
    // Call Server Action
    const result = await updateSomething(formData);
    if (result.success) {
      router.refresh(); // Reload server component
    }
  }

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Simplified Type Management

**Minimal types approach:**

```typescript
// types/database.ts - Simple and maintainable
export type UserRole = 'client' | 'team_member' | 'admin';

export interface User {
  id: string;
  clerk_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string | null;
  phone_number: string | null;
  birthday: string | null;
  photo_url: string | null;
  roles: UserRole[];
  is_registered: boolean;
  onboarding_completed: boolean;
  alert_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientNote {
  id: string;
  client_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface TeamMember {
  id: string;
  user_id: string;
  position: string | null;
  bio: string | null;
  specialties: string[] | null;
  is_active: boolean;
  hire_date: string | null;
  created_at: string;
  updated_at: string;
}
```

**Why simple types?**

- Easy to maintain
- Less boilerplate
- Works perfectly with `supabaseAdmin`
- Add complex types only when needed

### Auth Helper Pattern

**Centralized auth functions:**

```typescript
// lib/auth.ts
export async function getCurrentUser() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;
  const roles =
    (sessionClaims?.metadata as { roles?: UserRole[] })?.roles || [];
  return { userId, roles, sessionClaims };
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
- [x] Role sync between Clerk and Supabase

### Phase 3: Admin Panel (READY TO START) 🎯

- [ ] Admin dashboard layout with navigation
- [ ] Client list page with search/filter
- [ ] "Add Client" form with validation
- [ ] Client detail page
- [ ] Client notes CRUD interface
- [ ] Alert note management
- [ ] "Add Team Member" form
- [ ] Team member list view
- [ ] Role management interface

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

### Phase 6: Advanced Features (FUTURE)

- [ ] Payment integration
- [ ] Loyalty program
- [ ] Gift cards
- [ ] Product sales
- [ ] Reporting and analytics
- [ ] Multi-location support
- [ ] Staff scheduling
- [ ] Marketing automation

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
│   │   └── sync-roles.ts             # ✅ Manual role sync utility
│   ├── api/
│   │   └── webhooks/
│   │       └── clerk/
│   │           └── route.ts          # ✅ Clerk webhook handler
│   ├── onboarding/
│   │   └── page.tsx                  # ✅ Onboarding flow
│   ├── profile/
│   │   └── page.tsx                  # ✅ Profile page (server component)
│   ├── dashboard/
│   │   └── page.tsx                  # ✅ Client dashboard
│   ├── admin/
│   │   ├── page.tsx                  # ✅ Admin dashboard
│   │   ├── clients/
│   │   │   ├── page.tsx              # Client list (TODO)
│   │   │   ├── add/page.tsx          # Add client form (TODO)
│   │   │   └── [id]/page.tsx         # Client detail (TODO)
│   │   └── team/
│   │       ├── page.tsx              # Team member list (TODO)
│   │       └── add/page.tsx          # Add team member form (TODO)
│   ├── sign-in/
│   │   └── [[...sign-in]]/
│   │       └── page.tsx              # ✅ Sign-in/Sign-up page
│   ├── unauthorized/
│   │   └── page.tsx                  # ✅ 403 page
│   └── middleware.ts                 # ✅ Route protection
├── components/
│   └── profile-form.tsx              # ✅ Profile form component
├── lib/
│   ├── auth.ts                       # ✅ Auth helper functions
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

| Decision                   | Choice                         | Rationale                                        |
| -------------------------- | ------------------------------ | ------------------------------------------------ |
| **Data Access Pattern**    | Service Role (server-side)     | Simpler, more secure, easier to maintain         |
| **Client Data Access**     | Server-side with filtering     | Users access own data via filtered queries       |
| **RLS Policies**           | Disabled                       | Not needed with Service Role                     |
| **User Table Structure**   | Unified table with roles array | Handles role transitions, single source of truth |
| **Authentication**         | Clerk                          | Industry standard, OAuth support                 |
| **Role Storage**           | Supabase + Clerk metadata      | Supabase is source of truth, synced to Clerk     |
| **Client Notes**           | Separate table                 | Better audit trail, performance, queryability    |
| **Unregistered Clients**   | clerk_user_id nullable         | Supports walk-in clients, admin-created records  |
| **Photo Storage**          | Supabase Storage               | Integrated with database, simple permissions     |
| **Photo Upload**           | Server-side (Service Role)     | Secure, no body size limits                      |
| **Team Access to Notes**   | Full CRUD access               | Team members need client history for service     |
| **Client Access to Notes** | No access                      | Privacy, professionalism, industry standard      |
| **Server Actions**         | Preferred for all mutations    | Type-safe, simpler, better DX                    |
| **Type Management**        | Simplified, minimal types      | Easy to maintain, less boilerplate               |

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
- ✅ Implemented Service Role architecture (server-side for all operations)
- ✅ Removed JWT client-side dependency
- ✅ Created auth helper functions for DRY code
- ✅ Built complete onboarding flow with server-side photo upload
- ✅ Implemented profile editing with server-side data loading
- ✅ Set up role syncing between Supabase and Clerk
- ✅ Configured middleware for route protection
- 🎯 Ready to start Phase 3: Admin Panel

**Architecture Decision:**

- Chose **Service Role (server-side)** over **JWT (client-side)** for simplicity, security, and maintainability
- All data access goes through server components and server actions
- Security enforced via server-side filtering and role checks
- RLS policies not used (Service Role bypasses them)

---

## 🔮 Future Considerations

### If You Need JWT Client-Side Later

JWT with RLS might be useful for:

- Real-time collaborative features (multiple users editing simultaneously)
- Client-side subscriptions (live updates)
- Mobile app with offline sync
- Public-facing features with automatic permission enforcement

**Setup would require:**

- Clerk JWT template configuration
- Supabase JWT issuer configuration
- RLS policies created
- Helper functions for JWT claims

**Current Status:** Not needed for current requirements. Service Role meets all needs.

---

**Document Status:** Living document - update as architecture evolves  
**Next Review:** After Phase 3 completion (Admin Panel)  
**Architecture:** Server-Side with Service Role (Finalized)
