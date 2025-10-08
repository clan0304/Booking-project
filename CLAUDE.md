# Hair Salon Booking System - Architecture Documentation

> **Project Goal:** Build a hair salon booking system similar to Fresha  
> **Last Updated:** October 2025

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

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js Server Actions, API Routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Clerk (Email/Password + Google OAuth)
- **Storage:** Supabase Storage (for user photos)

---

## 🏗️ Architecture Overview

### Core Principles

1. **Unified User Table**

   - Single `users` table for all user types (clients, team members, admins)
   - Avoids data duplication and inconsistencies
   - Handles role transitions seamlessly (e.g., client becomes team member)

2. **Role-Based Access Control**

   - Users can have multiple roles stored as an array: `['client', 'team_member', 'admin']`
   - Flexible permission system enforced at database level

3. **JWT + Service Role Hybrid Authentication**

   - **Client-side:** All authenticated users use JWT (RLS enforced)
   - **Server-side:** Admin operations use Service Role (bypasses RLS)
   - Ensures security while maintaining flexibility

4. **Clerk as Single Source of Truth**
   - Clerk handles all authentication
   - Supabase syncs user data via webhooks
   - Clerk user ID links the two systems

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
│  Onboarding (if needed)                         │
│         ↓                                        │
│  Dashboard                                       │
│                                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         Data Access Pattern                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  Client-Side (All Authenticated Users)          │
│         ↓                                        │
│    Supabase Client with JWT                     │
│         ↓                                        │
│    RLS Policies Auto-Enforce Permissions        │
│                                                  │
│  Server-Side (Admin Operations Only)            │
│         ↓                                        │
│    supabaseAdmin (Service Role)                 │
│         ↓                                        │
│    Bypasses RLS for Admin Tasks                 │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 🔐 Authentication Strategy

### Clerk + Supabase Integration Method

**Approach:** JWT-based authentication with Row Level Security (RLS)

**Why JWT?**

- Stateless and scalable
- Database-level security via RLS
- Single source of truth (Clerk)
- Automatic permission enforcement

### Setup Requirements

1. **Clerk JWT Template**

   - Name: `supabase`
   - Custom claims: `metadata.roles`
   - Minimal configuration for simplicity

2. **Supabase JWT Validation**

   - Configured to accept Clerk's JWKS URL
   - Validates JWT signature automatically

3. **Clerk Webhooks**
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Keeps Supabase synchronized with Clerk

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

**2. Client Notes Table**

- Stores notes about clients (for team/admin reference)
- Fields: id, client_id, note, created_by, updated_by, timestamps
- Separate table for better audit trail and performance

**3. Team Members Table**

- Additional info for team members
- Fields: id, user_id (FK to users), position, bio, specialties (array), is_active, hire_date
- One-to-one relationship with users table

**4. Supabase Storage Bucket**

- Bucket: `user-photos`
- Public read access
- Authenticated write access
- Path structure: `{clerk_user_id}/{timestamp}-{filename}`

### Why This Structure?

- **Unified users table:** Handles role transitions seamlessly
- **Separate notes table:** Better performance, audit trail, and queryability
- **Team members extension:** Keeps user data normalized while allowing role-specific fields

---

## 👥 User Types & Permissions

### Access Control Matrix

```
┌──────────────────────────────────────────────────────┐
│  Table/Field │ Client  │ Team    │ Admin            │
├──────────────┼─────────┼─────────┼──────────────────┤
│ users        │         │         │                  │
│  - own data  │ ✅ R/W  │ ✅ R/W  │ ✅ R/W           │
│  - others    │ ❌      │ ✅ R    │ ✅ R/W           │
│  - alert_note│ ❌      │ ✅ R/W  │ ✅ R/W           │
├──────────────┼─────────┼─────────┼──────────────────┤
│ client_notes │ ❌      │ ✅ R/W/D│ ✅ R/W/D         │
├──────────────┼─────────┼─────────┼──────────────────┤
│ team_members │ ❌      │ ✅ R    │ ✅ R/W/D         │
└──────────────┴─────────┴─────────┴──────────────────┘

R = Read  |  W = Write/Update  |  D = Delete
```

### Role Capabilities

**Client**

- View and edit their own profile (name, phone, birthday, photo)
- Book appointments (future feature)
- Cannot see internal notes or alerts about themselves
- Cannot see other users

**Team Member**

- View all client profiles including alert notes
- Create, read, update, delete client notes
- Update client alert notes (allergies, preferences)
- View other team member profiles
- Access booking calendar (future feature)
- Cannot manage users or team member records

**Admin**

- Full access to all features
- Create/update/delete any user
- Add team members and manage their profiles
- Manage all client notes
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
Webhook → Create user in Supabase
  - clerk_user_id: set
  - is_registered: true
  - roles: ['client']
  - onboarding_completed: false
  ↓
Redirect to /onboarding
  ↓
User fills: phone number, photo (optional)
  ↓
Photo uploaded to Supabase Storage
  ↓
Update: onboarding_completed: true
  ↓
Redirect to dashboard
```

### Workflow 2: Self Sign-up (Google OAuth)

```
User → Sign up with Google
  ↓
Clerk OAuth (auto-fills name from Google)
  ↓
Webhook → Create user in Supabase
  - clerk_user_id: set
  - first_name & last_name: from Google
  - is_registered: true
  - roles: ['client']
  - onboarding_completed: false
  ↓
Redirect to /onboarding
  ↓
User fills: phone number, photo (optional)
  ↓
Update: onboarding_completed: true
  ↓
Redirect to dashboard
```

### Workflow 3: Admin Creates Unregistered Client

```
Admin → Open "Add Client" form
  ↓
Admin enters: first name (required), other fields (optional)
  ↓
Server Action (Service Role)
  - Create user with clerk_user_id: null
  - is_registered: false
  - roles: ['client']
  - onboarding_completed: true
  ↓
Client exists in database but cannot sign in
  ↓
Optional: Send invite email (future feature)
```

**Use Case:** Walk-in clients, phone bookings, or clients without email

### Workflow 4: Admin Adds Team Member

```
Admin → Enter team member email
  ↓
Check if email exists in database
  ↓
IF exists:
  - Add 'team_member' to roles array
  - Send Clerk invite if not registered
  - Create team_members record
  ↓
IF doesn't exist:
  - Create user with roles: ['team_member']
  - clerk_user_id: null, is_registered: false
  - Send Clerk invite
  - Create team_members record
  ↓
User receives invitation email → Signs up via Clerk
  ↓
Webhook updates: clerk_user_id set, is_registered: true
  ↓
User completes onboarding (if needed)
  ↓
User gains access to team features
```

### Workflow 5: Account Claiming

```
Scenario: Unregistered client (email: john@example.com) exists
  ↓
User signs up with same email via Clerk
  ↓
Clerk webhook fires
  ↓
Webhook handler detects existing email
  ↓
Update existing user:
  - clerk_user_id: set
  - is_registered: true
  - Keep all existing data (phone, birthday, notes, bookings)
  ↓
Redirect to onboarding if incomplete
  ↓
User can now sign in and access their history
```

**Key Benefit:** Preserves client history and notes when they create an account

---

## 🔒 Security Principles

### Authentication Security

✅ **DO:**

- Use JWT client for all authenticated user operations
- Use Service Role (`supabaseAdmin`) only for admin operations on server-side
- Store Service Role key in environment variables (never expose to client)
- Validate user roles before sensitive operations
- Use RLS policies as the primary security layer
- Verify Clerk webhook signatures

❌ **DON'T:**

- Never expose SUPABASE_SERVICE_ROLE_KEY to client-side code
- Don't bypass RLS for regular user operations
- Don't trust client-side role checks alone (always verify server-side)
- Don't store passwords or secrets in code repository
- Don't skip webhook signature verification

### Data Access Security

**Client-Side Pattern:**

- All authenticated users → Supabase client with JWT
- RLS automatically enforces permissions based on JWT claims
- No manual permission checks needed (database handles it)

**Server-Side Pattern:**

- Admin operations → `supabaseAdmin` (Service Role, bypasses RLS)
- Manually verify admin role before any operation
- Use Server Actions or API Routes (never client components)

### Photo Upload Security

- Allowed file types: JPEG, PNG, WebP only
- Max file size: 5MB
- Path structure: `{clerk_user_id}/{timestamp}-{filename}`
- Public bucket with read access, authenticated write access
- Validate file type and size on upload

---

## 💻 Implementation Patterns

### Server Actions vs API Routes

**Use Server Actions for:**

- ✅ Form submissions (onboarding, profile updates)
- ✅ Data mutations (create, update, delete)
- ✅ Internal operations
- ✅ Type-safe operations

**Use API Routes for:**

- ✅ Webhooks (Clerk, Stripe)
- ✅ External integrations
- ✅ Public endpoints
- ✅ OAuth callbacks

### Simplified Type Management

**Minimal types approach:**

```typescript
// types/database.ts - Simple and maintainable
export type UserRole = 'client' | 'team_member' | 'admin';
export interface User {
  /* fields */
}
export interface ClientNote {
  /* fields */
}
export interface TeamMember {
  /* fields */
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
  /* ... */
}
export async function requireAuth() {
  /* ... */
}
export async function requireStaff() {
  /* ... */
}
export async function requireAdmin() {
  /* ... */
}
```

**Benefits:**

- DRY principle
- Consistent auth checks
- Easy to test
- Type-safe

---

## 🚀 Development Roadmap

### Phase 1: Foundation ✅ (COMPLETED)

- [x] Architecture design
- [x] Supabase database setup
- [x] Database migration files
- [x] Clerk JWT template configuration
- [x] Webhook handler implementation
- [x] Supabase client utilities (supabaseAdmin)
- [x] Auth helper functions (lib/auth.ts)
- [x] Simplified type definitions

### Phase 2: Authentication & Onboarding ✅ (COMPLETED)

- [x] Onboarding flow (email/password)
- [x] Onboarding flow (Google OAuth)
- [x] Photo upload functionality
- [x] Middleware for incomplete onboarding redirect
- [x] Account claiming flow
- [x] Dashboard with onboarding check

### Phase 3: Admin Panel (IN PROGRESS)

- [ ] Admin dashboard layout
- [ ] "Add Client" form with validation
- [ ] "Add Team Member" form with Clerk invitations
- [ ] Client list view with search/filter
- [ ] Team member list view
- [ ] Client detail page

### Phase 4: Client Management

- [ ] Client profile view (for team/admin)
- [ ] Client notes CRUD interface
- [ ] Alert note management
- [ ] RLS permission testing
- [ ] Client search and filtering
- [ ] Bulk operations

### Phase 5: Booking System (Future)

- [ ] Services table design
- [ ] Service categories
- [ ] Appointment booking schema
- [ ] Booking flow for clients
- [ ] Calendar view for team
- [ ] Availability management
- [ ] Email notifications
- [ ] SMS reminders
- [ ] Booking confirmations

### Phase 6: Advanced Features (Future)

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
├── app/
│   ├── actions/
│   │   └── onboarding.ts             # ✅ Onboarding server action
│   ├── api/
│   │   └── webhooks/
│   │       └── clerk/
│   │           └── route.ts          # ✅ Clerk webhook handler
│   ├── onboarding/
│   │   └── page.tsx                  # ✅ Onboarding flow
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
├── lib/
│   ├── auth.ts                       # ✅ Auth helper functions
│   └── supabase/
│       ├── client.ts                 # ✅ Client-side Supabase
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
| **User Table Structure**   | Unified table with roles array | Handles role transitions, single source of truth |
| **Authentication**         | Clerk + Supabase JWT           | Industry standard, secure, scalable              |
| **Authorization**          | RLS with JWT claims            | Database-level security, automatic enforcement   |
| **Client Notes**           | Separate table                 | Better audit trail, performance, queryability    |
| **Unregistered Clients**   | clerk_user_id nullable         | Supports walk-in clients, admin-created records  |
| **Photo Storage**          | Supabase Storage               | Integrated with database, simple permissions     |
| **Team Access to Notes**   | Full CRUD access               | Team members need client history for service     |
| **Client Access to Notes** | No access                      | Privacy, professionalism, industry standard      |
| **Server Actions**         | Preferred for internal ops     | Type-safe, simpler, better DX                    |
| **Type Management**        | Simplified, minimal types      | Easy to maintain, less boilerplate               |
| **Supabase Client**        | `supabaseAdmin` constant       | Simple, no generics, works perfectly             |

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

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Clerk + Supabase Integration Guide](https://clerk.com/docs/integrations/databases/supabase)
- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [shadcn/ui Component Library](https://ui.shadcn.com/)

---

## 📝 Recent Updates

**October 2025:**

- ✅ Completed Phase 1: Foundation
- ✅ Completed Phase 2: Authentication & Onboarding
- ✅ Implemented simplified type management
- ✅ Created auth helper functions for DRY code
- ✅ Built complete onboarding flow with photo upload
- ✅ Set up Server Actions pattern for internal operations
- 🔄 Starting Phase 3: Admin Panel

---

**Document Status:** Living document - update as architecture evolves  
**Next Review:** After Phase 3 completion (Admin Panel)
