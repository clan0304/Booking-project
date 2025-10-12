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
- **Storage:** Supabase Storage (for user photos, team member photos, venue photos)
- **Data Access:** Service Role (server-side) for all operations
- **Timezone Handling:** UTC-safe date/time utilities for Melbourne (UTC+10/+11)

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

5. **Timezone-Safe Date Handling** ✅ NEW
   - All dates stored as YYYY-MM-DD strings (no timezone)
   - UTC-safe parsing prevents timezone conversion bugs
   - Works correctly in Melbourne (UTC+10/+11) year-round
   - Handles daylight saving time transitions automatically

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

**4. Venues Table**

- Stores salon/venue locations for marketplace
- Fields: id, name, address, phone_number (nullable), photo_url (nullable), slug (unique), is_listed, created_by, timestamps
- Slug format: `venue-name-123456` (auto-generated, 6 unique digits)
- Indexes on: slug, is_listed, created_at
- **RLS:** Disabled
- **Purpose:** Multi-location support, each venue gets unique booking URL

**5. Venue Operating Hours Table** ✅ NEW

- Stores regular business hours for each venue
- Fields: id, venue_id (FK), day_of_week (0-6), start_time, end_time, is_closed
- Unique constraint: (venue_id, day_of_week)
- **Purpose:** Define when venue is open/closed each day of week

**6. Team Member Venues Table** ✅ NEW

- Junction table for team member assignments to venues
- Fields: id, team_member_id (FK to users), venue_id (FK), is_active
- Unique constraint: (team_member_id, venue_id)
- **Purpose:** Track which team members work at which venues

**7. Shifts Table** ✅ NEW

- Stores individual work shifts for team members
- Fields: id, team_member_id (FK), venue_id (FK), shift_date (date), start_time, end_time, notes, created_by
- Unique constraint: (team_member_id, venue_id, shift_date)
- Indexes on: shift_date, team_member_id, venue_id
- **Purpose:** Schedule management and availability tracking

**8. Venue Closed Days Table** ✅ NEW

- Stores dates when venue is closed (holidays, special events)
- Fields: id, venue_id (FK), closed_date (date), reason, is_recurring, recurrence_rule, created_by
- Unique constraint: (venue_id, closed_date)
- **Purpose:** Mark venue closures, prevent bookings on closed days

**9. Supabase Storage Buckets**

- **`user-photos`**: User profile photos
  - Public read access
  - Server-side upload/delete (via Service Role)
  - Path: `{clerk_user_id}/{timestamp}-{filename}`
- **`team-member-photos`**: Team member profile photos
  - Public read access
  - Server-side upload/delete (via Service Role)
  - Path: `{timestamp}-{random}.{ext}`
- **`venue-photos`**: Venue/location photos
  - Public read access
  - Server-side upload/delete (via Service Role)
  - Path: `venues/{timestamp}-{filename}`

### Why This Structure?

- **Unified users table:** Handles role transitions seamlessly
- **Separate notes table:** Better performance, audit trail, and queryability
- **Team members extension:** Keeps user data normalized while allowing role-specific fields
- **Venues table:** Supports multi-location businesses, unique booking URLs per venue
- **Scheduling tables:** Flexible shift management with venue assignments
- **Closed days tracking:** Prevents conflicts and handles special closures
- **No RLS policies:** Simpler maintenance, security enforced in application code
- **Roles in database only:** No syncing complexity, instant updates

---

## 🔄 Key Workflows

### Workflow 8: Admin Manages Shifts ✅ NEW

```
Admin → Navigate to /admin/team → Scheduled Shifts tab
  ↓
Select venue from dropdown
  ↓
View week calendar (Mon-Sun)
  - Displays all team members assigned to venue
  - Shows existing shifts for each day
  ↓
Click "Set Schedule" for a team member
  ↓
Repeating Shifts Modal Opens:
  - Select date range (start/end)
  - Select days of week (Mon-Fri default)
  - Set shift hours (10:00 AM - 6:00 PM default)
  - Handle conflicts (skip or replace existing)
  ↓
Server Action: createRepeatingShifts()
  - Generates shifts using UTC-safe date functions
  - Dates remain as YYYY-MM-DD strings (no conversion!)
  - Checks for existing shifts
  - Inserts new shifts or skips conflicts
  ↓
✅ Shifts saved correctly to database
✅ Calendar refreshes with new shifts
✅ No timezone conversion bugs!
```

### Workflow 9: Assign Team Members to Venue ✅ NEW

```
Admin → Click "Assign Team" button
  ↓
Modal shows unassigned team members
  ↓
Select one or multiple team members
  ↓
Server Action: Bulk assign to venue
  - Creates team_member_venues records
  - Sets is_active: true
  ↓
✅ Team members now appear in calendar
✅ Can create shifts for assigned members
```

---

## 💻 Implementation Patterns

### Timezone-Safe Date Handling Pattern ✅ NEW

**Critical for Melbourne (UTC+10/+11):**

```typescript
// lib/shift-helpers.ts

// ALWAYS parse dates in UTC to avoid timezone bugs
function parseUTCDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z'); // Z = UTC!
}

// ALWAYS use UTC methods
export function getDayOfWeek(dateStr: string): number {
  const date = parseUTCDate(dateStr);
  return date.getUTCDay(); // Not .getDay()!
}

// ALWAYS format dates in UTC
export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**Why This Matters:**

- Database stores dates as `YYYY-MM-DD` (no timezone)
- JavaScript `new Date("2025-10-15")` interprets as local time
- In Melbourne, this can shift the date by 1 day in UTC
- Using UTC methods ensures dates stay correct year-round
- Handles daylight saving transitions automatically

**Example Bug Without UTC:**

```typescript
// ❌ WRONG: Timezone-dependent
const date = new Date('2025-10-15T00:00:00'); // Melbourne time!
date.getDay(); // Returns wrong day in UTC!

// ✅ CORRECT: UTC-explicit
const date = new Date('2025-10-15T00:00:00Z'); // UTC!
date.getUTCDay(); // Always correct!
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

### Phase 3: Admin Panel ✅ (COMPLETED)

- [x] Admin dashboard layout with navigation (Fresha-inspired)
- [x] Sidebar with icon navigation (11 menu items)
- [x] Top navbar with search, notifications, user menu
- [x] Admin layout wrapper with sticky header/sidebar
- [x] **Marketplace/Venues Management**
  - [x] Venues database table with auto-slug generation
  - [x] Create, read, update, delete venues
  - [x] Venue photo uploads
  - [x] Search venues by name/address
  - [x] Filter by status (All, Listed, Unlisted)
  - [x] Sort by newest, oldest, name
  - [x] Add/Edit modals with photo preview
  - [x] Unique booking URLs (format: `domain.com/venue-name-123456`)
- [x] **Team Member Management**
  - [x] Team list page with search/filter
  - [x] Add team member modal with photo upload
  - [x] Edit team member modal
  - [x] Toggle active/inactive status
  - [x] Remove team member role
  - [x] Public API endpoint (`/api/public/team`)
  - [x] Privacy protection (only id, first_name, photo_url exposed)
  - [x] Stats dashboard (total, active, inactive)
  - [x] Account claiming support for unregistered members

### Phase 3.5: Scheduling System ✅ (COMPLETED) 🎉 NEW

- [x] **Database Schema**
  - [x] Venue operating hours table
  - [x] Team member venues junction table
  - [x] Shifts table with unique constraints
  - [x] Venue closed days table
  - [x] Database functions and triggers
- [x] **Timezone-Safe Date Utilities**
  - [x] UTC-safe date parsing (Melbourne UTC+10/+11)
  - [x] Week calculation (Mon-Sun format)
  - [x] Date range formatting
  - [x] Day of week calculations
  - [x] Handles daylight saving time
- [x] **Server Actions**
  - [x] Create/update/delete shifts
  - [x] Repeating shifts pattern generation
  - [x] Conflict detection and resolution
  - [x] Venue hours management
  - [x] Team-venue assignments
  - [x] Closed days management
- [x] **UI Components**
  - [x] Venue selector dropdown
  - [x] Week navigator (prev/next/this week)
  - [x] Calendar grid view (Mon-Sun)
  - [x] Team member row with shifts
  - [x] Assign venue modal (bulk assign)
  - [x] Repeating shifts modal
  - [x] Set Schedule button functionality
- [x] **Bug Fixes**
  - [x] Fixed timezone conversion bugs
  - [x] Fixed calendar week display (Sat-Fri → Mon-Sun)
  - [x] Fixed date range calculation (6 days → 7 days)
  - [x] Fixed shift dates off by 1 day
  - [x] Fixed Set Schedule button not opening modal
  - [x] Fixed TypeScript type errors
  - [x] Fixed useEffect dependency warnings

### Phase 4: Client Management (NEXT)

- [ ] Client list page with search/filter
- [ ] "Add Client" form with validation
- [ ] Client detail page
- [ ] Client notes CRUD interface
- [ ] Alert note management
- [ ] Client tags/categories
- [ ] Client communication history
- [ ] Booking history view

### Phase 5: Booking System (FUTURE)

- [ ] Services table design
- [ ] Service categories
- [ ] Appointment booking schema
- [ ] Booking flow for clients
- [ ] Availability management based on shifts
- [ ] Email notifications
- [ ] SMS reminders
- [ ] Booking confirmations
- [ ] Public booking pages (using venue slugs)

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
│   │   ├── admin.ts                  # ✅ Admin operations (users, roles)
│   │   ├── team-members.ts           # ✅ Team member management
│   │   ├── venues.ts                 # ✅ Venue CRUD operations
│   │   ├── shifts.ts                 # ✅ Shift CRUD + repeating shifts
│   │   ├── venue-hours.ts            # ✅ Venue hours management
│   │   ├── team-venue-assignments.ts # ✅ Team-venue relationships
│   │   └── venue-closed-days.ts      # ✅ Closed days management
│   ├── api/
│   │   ├── webhooks/
│   │   │   └── clerk/
│   │   │       └── route.ts          # ✅ Clerk webhook
│   │   └── public/
│   │       └── team/
│   │           └── route.ts          # ✅ Public team API
│   ├── admin/
│   │   ├── layout.tsx                # ✅ Admin layout wrapper
│   │   ├── page.tsx                  # ✅ Admin dashboard
│   │   ├── marketplace/
│   │   │   └── page.tsx              # ✅ Venues management
│   │   ├── team/
│   │   │   └── page.tsx              # ✅ Team + Scheduling tabs
│   │   └── clients/
│   │       └── page.tsx              # Client list (TODO)
│   └── middleware.ts                 # ✅ Route protection
├── components/
│   ├── admin/
│   │   ├── sidebar.tsx               # ✅ Admin sidebar
│   │   ├── navbar.tsx                # ✅ Admin navbar
│   │   ├── admin-layout.tsx          # ✅ Layout wrapper
│   │   ├── marketplace/              # ✅ Venue components
│   │   └── team/
│   │       ├── team-list-client.tsx  # ✅ Team member list
│   │       ├── team-tabs.tsx         # ✅ Team/Scheduling tabs
│   │       ├── scheduled-shifts-client.tsx # ✅ Calendar grid
│   │       ├── venue-selector.tsx    # ✅ Venue dropdown
│   │       ├── week-navigator.tsx    # ✅ Week navigation
│   │       ├── assign-venue-modal.tsx # ✅ Assign team modal
│   │       └── repeating-shifts-modal.tsx # ✅ Set schedule modal
│   └── profile-form.tsx              # ✅ Profile form
├── lib/
│   ├── auth.ts                       # ✅ Auth helpers
│   ├── role-management.ts            # ✅ Role management
│   ├── shift-helpers.ts              # ✅ UTC-safe date utilities
│   └── supabase/
│       ├── client.ts                 # ✅ Client-side Supabase
│       └── server.ts                 # ✅ Server-side Supabase
├── types/
│   └── database.ts                   # ✅ TypeScript types
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql    # ✅ Users, notes, team
        ├── 002_venues.sql            # ✅ Venues + slug generator
        └── 003_scheduling_system.sql # ✅ Shifts, hours, assignments
```

---

## 🎯 Critical Decisions Summary

| Decision                   | Choice                            | Rationale                                            |
| -------------------------- | --------------------------------- | ---------------------------------------------------- |
| **Data Access Pattern**    | Service Role (server-side)        | Simpler, more secure, easier to maintain             |
| **Authorization Pattern**  | Supabase only (no Clerk metadata) | Single source of truth, instant updates, no syncing  |
| **Role Storage**           | Supabase users.roles ONLY         | No JWT caching issues, instant changes, simpler      |
| **Role Changes**           | Immediate (no re-auth)            | Better UX, middleware queries DB on each request     |
| **Client Data Access**     | Server-side with filtering        | Users access own data via filtered queries           |
| **RLS Policies**           | Disabled                          | Not needed with Service Role                         |
| **User Table Structure**   | Unified table with roles array    | Handles role transitions, single source of truth     |
| **Authentication**         | Clerk                             | Industry standard, OAuth support, handles auth only  |
| **Timezone Handling**      | UTC-safe everywhere               | Prevents bugs in Melbourne (UTC+10/+11), handles DST |
| **Date Storage**           | YYYY-MM-DD strings                | No timezone, consistent across all systems           |
| **Date Parsing**           | Always add 'Z' suffix             | Forces UTC interpretation, no local timezone issues  |
| **Date Methods**           | Use getUTCDay(), setUTCDate()     | Ensures consistent behavior regardless of local time |
| **Week Format**            | Monday-Sunday (ISO 8601)          | Industry standard, aligns with business week         |
| **Shift Constraints**      | Unique per team/venue/date        | Prevents double-booking, ensures data integrity      |
| **Team-Venue Assignments** | Junction table with is_active     | Flexible multi-venue support, preserves history      |
| **Closed Days**            | Separate table with recurrence    | Supports one-time and recurring closures             |
| **Conflict Resolution**    | User choice (skip or replace)     | Flexible, prevents accidental data loss              |
| **Calendar View**          | Weekly grid Mon-Sun               | Standard business view, matches team expectations    |
| **Performance Trade-off**  | +5-10ms per request (DB query)    | Worth it for simplicity and instant updates          |
| **Venue Slugs**            | Auto-generated (name-6digits)     | Unique, short, SEO-friendly booking URLs             |
| **Multi-location Support** | Venues table + assignments        | Each location gets unique booking page               |
| **Public API Security**    | Whitelist fields only             | Only expose id, first_name, photo_url publicly       |

---

## 📝 Recent Updates

**October 2025:**

- ✅ **Completed Phase 3.5: Scheduling System** 🎉
  - Built complete shift management system with calendar view
  - Implemented repeating shifts with conflict detection
  - Created team-venue assignment system
  - Added venue operating hours management
  - Implemented venue closed days tracking
  - Built week navigation (Mon-Sun format)
  - Calendar grid showing all team members and their shifts
  - "Set Schedule" button opens modal for repeating shifts
  - Bulk team assignment to venues
- ✅ **Fixed Critical Timezone Bugs**
  - Discovered Melbourne timezone (UTC+10/+11) was causing date shifts
  - Implemented UTC-safe date parsing throughout application
  - All dates now parsed with 'Z' suffix to force UTC interpretation
  - Changed all date methods to UTC versions (getUTCDay, setUTCDate, etc.)
  - Fixed calendar week display (was showing Sat-Fri, now Mon-Sun)
  - Fixed date range showing only 6 days (now correctly shows 7)
  - Fixed shifts saving 1 day earlier than selected
  - Handles daylight saving time transitions automatically
- ✅ **Technical Improvements**
  - Created `lib/shift-helpers.ts` with 30+ UTC-safe date utilities
  - Implemented proper TypeScript types for scheduling
  - Fixed all useEffect dependency warnings
  - Fixed Supabase ambiguous relationship errors
  - Added refresh mechanism for real-time calendar updates
  - Optimized database queries with proper indexes
- ✅ **Database Additions**
  - Added 4 new tables: venue_operating_hours, team_member_venues, shifts, venue_closed_days
  - Created unique constraints to prevent conflicts
  - Added indexes for performance optimization
  - Implemented database functions and triggers

**Architecture Highlights:**

- **Timezone-Safe by Design**: All date handling uses UTC methods to prevent bugs in Melbourne (UTC+10/+11)
- **Flexible Scheduling**: Repeating shifts with conflict resolution options
- **Multi-Venue Support**: Team members can work at multiple venues
- **Calendar View**: Industry-standard Mon-Sun weekly view
- **Real-Time Updates**: Changes reflected immediately without page reload

---

## 🔮 Lessons Learned

### Timezone Handling in Melbourne

**Problem Discovered:**

- JavaScript `new Date("2025-10-15T00:00:00")` interprets as local Melbourne time
- When converted to UTC, date could shift by 10-11 hours
- Caused calendar to show wrong days and shifts to save 1 day off

**Solution Implemented:**

- Always parse dates with UTC: `new Date("2025-10-15T00:00:00Z")`
- Always use UTC methods: `getUTCDay()`, `setUTCDate()`, `getUTCFullYear()`
- Never use local timezone methods: `getDay()`, `setDate()`, `getFullYear()`
- Keep dates as YYYY-MM-DD strings throughout application
- No Date object conversions in browser or server until final display

**Key Principle:**

> "When working with dates in databases, always think in UTC, never in local time."

This applies to ANY timezone, not just Melbourne! The issue affects all locations during daylight saving transitions.

---

**Document Status:** Living document - update as architecture evolves  
**Next Review:** After Client Management completion  
**Architecture:** Clerk for Authentication, Supabase for Authorization (Finalized & Simplified)  
**Last Major Change:** Completed Scheduling System with Timezone-Safe Date Handling (Phase 3.5)
