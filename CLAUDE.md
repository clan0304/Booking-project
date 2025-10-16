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

5. **Timezone-Safe Date Handling** ✅
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

**5. Venue Operating Hours Table** ✅

- Stores regular business hours for each venue
- Fields: id, venue_id (FK), day_of_week (0-6), start_time, end_time, is_closed
- Unique constraint: (venue_id, day_of_week)
- **Purpose:** Define when venue is open/closed each day of week

**6. Team Member Venues Table** ✅

- Junction table for team member assignments to venues
- Fields: id, team_member_id (FK to users), venue_id (FK), is_active
- Unique constraint: (team_member_id, venue_id)
- **Purpose:** Track which team members work at which venues
- **Note:** Uses `is_active` for soft deletes (preserves assignment history)

**7. Shifts Table** ✅

- Stores individual work shifts for team members
- Fields: id, team_member_id (FK), venue_id (FK), shift_date (date), start_time, end_time, notes, created_by
- Unique constraint: (team_member_id, venue_id, shift_date)
- Indexes on: shift_date, team_member_id, venue_id
- **Purpose:** Schedule management and availability tracking

**8. Venue Closed Days Table** ✅

- Stores dates when venue is closed (holidays, special events)
- Fields: id, venue_id (FK), closed_date (date), reason, is_recurring, recurrence_rule, created_by
- Unique constraint: (venue_id, closed_date)
- **Purpose:** Mark venue closures, prevent bookings on closed days

**9. Service Categories Table** ✅

- Organizes services into categories
- Fields: id, name, description, color (hex), display_order, is_active, timestamps
- Indexes on: is_active + display_order, name
- **Purpose:** Group services (e.g., Hair, Nails, Beauty)

**10. Services Table** ✅

- Stores all service offerings with three types
- Fields: id, name, category_id (FK), description, parent_service_id (FK), type (service/variant_group/bundle), price_type (fixed/from), price, duration_minutes, is_bookable, display_order, is_active, created_by, timestamps
- Types:
  - `service`: Regular bookable service or variant option
  - `variant_group`: Parent service with variants (shows modal on booking)
  - `bundle`: Package with multiple services
- Indexes on: category_id, type, parent_service_id, is_active, is_bookable, display_order
- **Purpose:** Core service catalog with flexible pricing models

**11. Bundle Items Table** ✅

- Links services to bundle packages
- Fields: id, bundle_id (FK), service_id (FK), sequence_order, timestamps
- Unique constraint: (bundle_id, service_id)
- Check constraint: bundle_id != service_id
- **Purpose:** Define which services are included in bundles

**12. Service Venues Table** ✅

- Junction table for service-venue availability
- Fields: id, service_id (FK), venue_id (FK), is_active, timestamps
- Unique constraint: (service_id, venue_id)
- **Purpose:** Control which services are available at which venues

**13. Service Team Members Table** ✅

- Junction table with custom pricing support
- Fields: id, service_id (FK), team_member_id (FK), custom_price (nullable), custom_duration_minutes (nullable), is_active, timestamps
- Unique constraint: (service_id, team_member_id)
- **Purpose:** Assign services to team members with optional custom pricing
- **Key Feature:** NULL values use service defaults, set values override

**14. Staff Time Entries Table** ✅

- Tracks team member work hours and shifts
- Fields: id, team_member_id (FK), venue_id (FK), shift_date, clock_in_time, clock_out_time, breaks (jsonb), current_break_start, status (clocked_in/on_break/completed), total_hours, total_paid_hours, total_break_minutes, notes, created_by, updated_by, timestamps
- Unique constraint: Only one active shift per team member
- Indexes on: team_member_id, venue_id, shift_date, status
- **Purpose:** Time tracking, payroll calculations, shift history

**15. Staff Default Pay Rates Table** ✅

- Stores default hourly rates for all team members
- Fields: id (fixed UUID), weekday_rate, saturday_rate, sunday_rate, public_holiday_rate, paid_break_minutes, updated_by, timestamps
- Single row system-wide defaults
- **Purpose:** Base pay rates applied to all team members unless custom rate set

**16. Staff Pay Rates Table** ✅

- Custom pay rates per team member (overrides defaults)
- Fields: id, team_member_id (FK), weekday_rate, saturday_rate, sunday_rate, public_holiday_rate, paid_break_minutes, notes, updated_by, timestamps
- Unique constraint: team_member_id
- **Purpose:** Individual pay rate overrides for specific team members
- **Note:** NULL values use defaults, set values override

**17. Public Holidays Table** ✅

- Tracks public holidays for payroll calculations
- Fields: id, date, name, is_recurring, recurrence_rule, created_by, timestamps
- Unique constraint: date
- Indexes on: date, is_recurring
- **Purpose:** Apply holiday rates automatically, prevent double-booking

**18. Supabase Storage Buckets**

- **`user-photos`**: User profile photos
  - Public read access
  - Server-side upload/delete (via Service Role)
  - Path: `{clerk_user_id}/{timestamp}-{filename}` or `clients/{timestamp}-{filename}`
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
- **Service architecture:** Flexible three-type system handles variants and bundles elegantly
- **Custom pricing per team member:** Allows individualized rates without duplicating services
- **Staff time tracking:** Complete payroll system with break tracking and multiple rate types
- **Flexible pay rates:** Default rates with per-member overrides, automatic effective rate calculation
- **Public holidays:** Automatic holiday rate application, recurring holiday support
- **Soft deletes:** `is_active` flag preserves assignment history for auditing
- **No RLS policies:** Simpler maintenance, security enforced in application code
- **Roles in database only:** No syncing complexity, instant updates

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

### Phase 3.5: Scheduling System ✅ (COMPLETED)

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
  - [x] Team-venue assignments (assign/unassign)
  - [x] Bulk operations for multiple team members
  - [x] Closed days management
- [x] **UI Components**
  - [x] Venue selector dropdown
  - [x] Week navigator (prev/next/this week)
  - [x] Calendar grid view (Mon-Sun)
  - [x] Team member row with shifts
  - [x] Assign venue modal
  - [x] Repeating shifts modal
  - [x] Single shift modal (add/edit/delete)
  - [x] Context menu for shift actions

### Phase 4: Client Management ✅ (COMPLETED)

- [x] **Client List Page**
  - [x] Table-based layout (Fresha-inspired design)
  - [x] Search by name, email, phone
  - [x] Filter by status (All, Registered, Unregistered)
  - [x] Stats dashboard (Total, Registered, Unregistered, With Alerts)
  - [x] Profile photos with gradient fallback
  - [x] Alert note indicators with tooltips
  - [x] Note count badges
  - [x] Sales placeholder (£0.00 - ready for Phase 5)
  - [x] Bulk selection checkboxes (ready for future)
  - [x] Sortable columns
  - [x] Created date display
- [x] **Add Client Functionality**
  - [x] Add client modal with form validation
  - [x] Email uniqueness check
  - [x] Photo upload (optional)
  - [x] Alert note field for important warnings
  - [x] Account claiming support (unregistered → registered)
  - [x] Photo preview and removal
- [x] **Edit Client Functionality**
  - [x] Edit client modal
  - [x] Update all client fields
  - [x] Email is read-only (cannot be changed)
  - [x] Photo management (upload/remove)
  - [x] Alert note updates
  - [x] Registration status display
- [x] **Delete Client Functionality**
  - [x] Delete unregistered clients only
  - [x] Protection for registered clients (have active accounts)
  - [x] Photo cleanup on deletion
  - [x] Confirmation dialog
- [x] **Client Filtering**
  - [x] Show only pure clients (users with ONLY 'client' role)
  - [x] Exclude team members (roles: ['client', 'team_member'])
  - [x] Exclude admins (roles: ['client', 'admin'])
  - [x] JavaScript-based filtering for reliability
- [x] **UI/UX Improvements**
  - [x] Fresha-inspired table design
  - [x] Responsive grid layout
  - [x] Hover effects and transitions
  - [x] Icon-only action buttons
  - [x] Gradient avatars for clients without photos
  - [x] Visual indicators for alerts and notes
  - [x] Clean, professional appearance

### Phase 4.5: Service Management ✅ (COMPLETED)

- [x] **Database Schema**
  - [x] Service categories table with color coding
  - [x] Services table with three types (service/variant_group/bundle)
  - [x] Bundle items junction table
  - [x] Service venues assignment table
  - [x] Service team members with custom pricing
  - [x] Helper functions (get_effective_price, get_effective_duration, get_service_variants)
  - [x] Updated_at triggers for all tables
- [x] **Service Categories Management**
  - [x] Create, edit, delete categories
  - [x] Color picker with 12 preset colors
  - [x] Category display order
  - [x] Category grouping in sidebar
  - [x] Service count per category
  - [x] Double-click to edit category
- [x] **Services Management**
  - [x] Three service types support:
    - [x] Regular Service (standalone bookable)
    - [x] Service with Variants (shows variant options modal)
    - [x] Service Bundle (package of multiple services)
  - [x] 2-step service creation/editing modal:
    - [x] Step 1: Basic info (type, name, category, description, price, duration)
    - [x] Step 2: Locations & team members
  - [x] Price types: Fixed or "From" pricing
  - [x] Duration selection (15min to 3h in intervals)
  - [x] Venue assignments (select which locations offer service)
  - [x] Team member assignments (select who can perform service)
  - [x] Service search by name
  - [x] Filter by category
  - [x] Edit existing services
  - [x] Delete services (soft delete)
  - [x] Service card display with type indicators
- [x] **Variants System**
  - [x] Add variants to variant group services
  - [x] Variant list modal showing all options
  - [x] Delete individual variants
  - [x] Calculated "from" pricing (min variant price)
  - [x] Variant-specific pricing and duration
  - [x] Visual display: "from £X" for variant groups
- [x] **Custom Pricing per Team Member**
  - [x] CustomPricingModal component
  - [x] Override service default price per team member
  - [x] Override service default duration per team member
  - [x] Enable/disable custom pricing with checkboxes
  - [x] Reset to default button
  - [x] Visual indicators:
    - [x] "Custom" badge on team members with custom pricing
    - [x] "Customize" button for each selected team member
  - [x] Service default display for reference
  - [x] Auto-refresh after pricing changes
- [x] **Server Actions**
  - [x] getCategories, createCategory, updateCategory, deleteCategory
  - [x] getServices, getServiceById, createService, updateService, deleteService
  - [x] getServiceVariants, createVariant, deleteVariant
  - [x] assignServiceVenues, assignServiceTeamMembers
  - [x] updateTeamMemberCustomPricing, resetTeamMemberToDefault
  - [x] getAllVenues, getAllTeamMembers (helper functions)
- [x] **Technical Improvements**
  - [x] TypeScript type safety (no 'any' types)
  - [x] Proper interface definitions for nested data
  - [x] useCallback for data fetching functions
  - [x] useEffect dependency warnings resolved
  - [x] State synchronization on modal open/close
  - [x] Loading states during mutations
  - [x] Router.refresh() integration for real-time updates
  - [x] Props usage instead of state for list data
- [x] **UI/UX Features**
  - [x] Category sidebar with service counts
  - [x] Service cards with type badges
  - [x] Search functionality
  - [x] Category filtering
  - [x] Loading overlay during refresh
  - [x] Disabled states during operations
  - [x] Error handling and display
  - [x] Confirmation dialogs for deletions
  - [x] Modal-based workflows for all operations
  - [x] Clean, professional Fresha-inspired design

### Phase 4.75: Staff Management ✅ (COMPLETED)

- [x] **Database Schema**
  - [x] Staff time entries table with break tracking
  - [x] Staff default pay rates table (system-wide)
  - [x] Staff custom pay rates table (per team member)
  - [x] Public holidays table with recurring support
  - [x] Helper functions (calculate_shift_hours, get_effective_pay_rate, get_long_running_shifts)
  - [x] Unique constraints for active shifts and pay rates
  - [x] Indexes for performance (team_member_id, shift_date, status)
- [x] **Time Tracking System**
  - [x] Clock in/out functionality with venue selection
  - [x] Break management (start/end break)
  - [x] Automatic break tracking in JSONB array
  - [x] Live duration timer during active shifts
  - [x] Status tracking (clocked_in, on_break, completed)
  - [x] Break history display on active shifts
  - [x] Current break indicator
- [x] **Kiosk Mode (Admin Feature)**
  - [x] Staff member selector dropdown for admins
  - [x] Admin can clock in/out for any team member
  - [x] Admin can start/end breaks for any team member
  - [x] Non-admin users only see their own shifts
  - [x] Selected staff display with photo and name
  - [x] Kiosk-style UI for easy touch operation
- [x] **Pay Rates Management (Admin Only)**
  - [x] Default pay rates card (system-wide defaults):
    - [x] Weekday rate (e.g., $25/hr)
    - [x] Saturday rate (e.g., $30/hr)
    - [x] Sunday rate (e.g., $35/hr)
    - [x] Public holiday rate (e.g., $50/hr)
    - [x] Paid break duration (e.g., 30 minutes)
  - [x] Custom pay rates per team member:
    - [x] Override individual rates (NULL = use default)
    - [x] Team member list with custom rate indicators
    - [x] Notes field for rate justification
    - [x] Edit custom rates modal
    - [x] Delete custom rates (revert to defaults)
  - [x] Effective rate calculation based on date and team member
  - [x] Automatic rate application to time entries
- [x] **Public Holidays Management (Admin Only)**
  - [x] Add public holidays with date and name
  - [x] Recurring holiday support (annual dates)
  - [x] Delete holidays
  - [x] Holiday list with visual indicators
  - [x] Automatic holiday rate application in payroll
- [x] **Payroll Reports (Admin Only)**
  - [x] Date range selection with quick presets:
    - [x] This Week / Last Week
    - [x] This Fortnight / Last Fortnight
    - [x] This Month / Last Month
  - [x] Period type selector (Weekly/Fortnightly/Monthly)
  - [x] Team member filter (All or specific member)
  - [x] Generate report button with loading state
  - [x] Summary statistics:
    - [x] Total payroll amount
    - [x] Total paid hours
    - [x] Staff count
    - [x] Average hours per staff
  - [x] Detailed breakdown per team member:
    - [x] Weekday hours and pay
    - [x] Saturday hours and pay
    - [x] Sunday hours and pay
    - [x] Public holiday hours and pay
    - [x] Total paid hours and total pay
    - [x] Number of shifts
  - [x] Expandable rows showing individual shifts
  - [x] Export to CSV functionality
- [x] **Time Entries Table**
  - [x] Historical shift records with pagination
  - [x] Date, venue, clock in/out times
  - [x] Total hours and paid hours display
  - [x] Status badges (Active, On Break, Completed)
  - [x] Team member column (admin view only)
  - [x] Sortable columns
  - [x] Filter by date range
- [x] **Long-Running Shifts Alert (Admin Only)**
  - [x] Automatic detection of shifts > 12 hours
  - [x] Visual alert banner with warning icon
  - [x] List of long-running shifts with:
    - [x] Team member name and photo
    - [x] Venue name
    - [x] Hours elapsed
    - [x] Clock in time
    - [x] Current status
  - [x] Alert badge on staff management page
- [x] **Payroll Calculations**
  - [x] Automatic calculation of:
    - [x] Total hours worked
    - [x] Total paid hours (minus unpaid breaks)
    - [x] Break duration (paid vs unpaid)
    - [x] Rate based on day type (weekday/Saturday/Sunday/holiday)
  - [x] Rate precedence: Custom > Default
  - [x] Paid break threshold (e.g., first 30min paid, rest unpaid)
  - [x] Database function for shift hour calculations
  - [x] Effective pay rate function with date awareness
- [x] **Server Actions**
  - [x] clockIn, clockOut (with kiosk mode support)
  - [x] startBreak, endBreak (with kiosk mode support)
  - [x] getActiveShift, getTimeEntries, getLongRunningShifts
  - [x] getDefaultPayRates, updateDefaultPayRates
  - [x] getCustomPayRates, upsertCustomPayRates, deleteCustomPayRates
  - [x] getEffectivePayRates (date and team member aware)
  - [x] getPublicHolidays, addPublicHoliday, deletePublicHoliday
  - [x] calculatePayroll (with date range and filtering)
- [x] **UI Components**
  - [x] StaffManagementClient (main container with tabs)
  - [x] TimeClockPanel (clock in interface)
  - [x] ActiveShiftDisplay (active shift with timer)
  - [x] TimeEntriesTable (shift history)
  - [x] LongRunningAlert (warning banner)
  - [x] PayRatesTab (default + custom rates)
  - [x] DefaultPayRatesCard (edit system defaults)
  - [x] CustomPayRatesList (per-member overrides)
  - [x] PublicHolidaysManager (holiday CRUD)
  - [x] PayrollReportsTab (reporting interface)
- [x] **Technical Implementation**
  - [x] Full TypeScript type safety
  - [x] Proper Supabase relationship hints for foreign keys
  - [x] useCallback for performance optimization
  - [x] Loading states for all async operations
  - [x] Error handling with user feedback
  - [x] Revalidation after mutations
  - [x] Kiosk mode security checks in all actions
  - [x] UTC-safe time handling throughout
- [x] **Security & Authorization**
  - [x] requireAuth() for all time tracking actions
  - [x] requireAdmin() for pay rates and payroll
  - [x] Kiosk mode: Admin can manage any team member
  - [x] Non-admin: Can only manage own time entries
  - [x] Server-side filtering based on user role
  - [x] Audit trail with created_by and updated_by

### Phase 5: Booking System (FUTURE)

- [ ] Appointment booking schema
- [ ] Booking flow for clients
- [ ] Availability management based on shifts and services
- [ ] Email notifications
- [ ] SMS reminders
- [ ] Booking confirmations
- [ ] Payment integration
- [ ] Public booking pages (using venue slugs)
- [ ] Calendar view for appointments
- [ ] Conflict detection and resolution
- [ ] Cancellation and rescheduling

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
│   │   ├── clients.ts                # ✅ Client CRUD operations
│   │   ├── venues.ts                 # ✅ Venue CRUD operations
│   │   ├── shifts.ts                 # ✅ Shift CRUD + repeating shifts
│   │   ├── venue-hours.ts            # ✅ Venue hours management
│   │   ├── team-venue-assignments.ts # ✅ Assign/unassign team to venues
│   │   ├── venue-closed-days.ts      # ✅ Closed days management
│   │   ├── services.ts               # ✅ Services, categories, variants, custom pricing
│   │   ├── staff-management.ts       # ✅ Time tracking, clock in/out, breaks
│   │   └── staff-pay-rates.ts        # ✅ Pay rates, holidays, payroll calculations
│   ├── api/
│   │   ├── webhooks/
│   │   │   └── clerk/
│   │   │       └── route.ts          # ✅ Clerk webhook
│   │   ├── admin/
│   │   │   └── team/
│   │   │       └── all-members/
│   │   │           └── route.ts      # ✅ Fetch all team members API
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
│   │   ├── clients/
│   │   │   └── page.tsx              # ✅ Client list page
│   │   ├── services/
│   │   │   └── page.tsx              # ✅ Services management
│   │   └── staff-management/
│   │       └── page.tsx              # ✅ Staff management with tabs
│   └── middleware.ts                 # ✅ Route protection
├── components/
│   ├── admin/
│   │   ├── sidebar.tsx               # ✅ Admin sidebar
│   │   ├── navbar.tsx                # ✅ Admin navbar
│   │   ├── admin-layout.tsx          # ✅ Layout wrapper
│   │   ├── marketplace/              # ✅ Venue components
│   │   ├── clients/
│   │   │   ├── client-list-client.tsx # ✅ Client list table
│   │   │   ├── add-client-modal.tsx   # ✅ Add client modal
│   │   │   ├── edit-client-modal.tsx  # ✅ Edit client modal
│   │   │   └── index.ts               # ✅ Exports
│   │   ├── services/
│   │   │   ├── service-list-client.tsx # ✅ Services list with categories
│   │   │   ├── service-card.tsx        # ✅ Individual service card
│   │   │   ├── add-category-modal.tsx  # ✅ Create category
│   │   │   ├── edit-category-modal.tsx # ✅ Edit/delete category
│   │   │   ├── add-service-modal.tsx   # ✅ Create service (2 steps)
│   │   │   ├── edit-service-modal.tsx  # ✅ Edit/delete service (2 steps)
│   │   │   ├── add-variant-modal.tsx   # ✅ Add variant to service
│   │   │   ├── variant-list-modal.tsx  # ✅ View/manage variants
│   │   │   ├── custom-pricing-modal.tsx # ✅ Team member custom pricing
│   │   │   └── index.ts                # ✅ Exports
│   │   ├── staff-management/
│   │   │   ├── staff-management-client.tsx # ✅ Main container with tabs
│   │   │   ├── time-clock-panel.tsx       # ✅ Clock in interface
│   │   │   ├── active-shift-display.tsx   # ✅ Active shift with timer
│   │   │   ├── time-entries-table.tsx     # ✅ Shift history
│   │   │   ├── long-running-alert.tsx     # ✅ Warning banner
│   │   │   ├── pay-rates-tab.tsx          # ✅ Pay rates container
│   │   │   ├── default-pay-rates-card.tsx # ✅ System defaults
│   │   │   ├── custom-pay-rates-list.tsx  # ✅ Per-member overrides
│   │   │   ├── public-holidays-manager.tsx # ✅ Holiday CRUD
│   │   │   ├── payroll-reports-tab.tsx    # ✅ Reporting interface
│   │   │   └── index.ts                   # ✅ Exports
│   │   └── team/
│   │       ├── team-list-client.tsx  # ✅ Team member list
│   │       ├── team-member-modal.tsx # ✅ Add/Edit team modal
│   │       ├── team-tabs.tsx         # ✅ Team/Scheduling tabs
│   │       ├── scheduled-shifts-client.tsx # ✅ Calendar grid
│   │       ├── venue-selector.tsx    # ✅ Venue dropdown
│   │       ├── week-navigator.tsx    # ✅ Week navigation
│   │       ├── assign-venue-modal.tsx # ✅ Assign/unassign team modal
│   │       ├── repeating-shifts-modal.tsx # ✅ Set schedule modal
│   │       └── single-shift-modal.tsx # ✅ Add/edit/delete shift modal
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
        ├── 003_scheduling_system.sql # ✅ Shifts, hours, assignments
        ├── 004_services_system.sql   # ✅ Services, categories, pricing
        └── 005_staff_management.sql  # ✅ Time tracking, pay rates, holidays
```

---

## 🎯 Critical Decisions Summary

| Decision                     | Choice                                 | Rationale                                              |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------ |
| **Data Access Pattern**      | Service Role (server-side)             | Simpler, more secure, easier to maintain               |
| **Authorization Pattern**    | Supabase only (no Clerk metadata)      | Single source of truth, instant updates, no syncing    |
| **Role Storage**             | Supabase users.roles ONLY              | No JWT caching issues, instant changes, simpler        |
| **Role Changes**             | Immediate (no re-auth)                 | Better UX, middleware queries DB on each request       |
| **Client Data Access**       | Server-side with filtering             | Users access own data via filtered queries             |
| **RLS Policies**             | Disabled                               | Not needed with Service Role                           |
| **User Table Structure**     | Unified table with roles array         | Handles role transitions, single source of truth       |
| **Authentication**           | Clerk                                  | Industry standard, OAuth support, handles auth only    |
| **Timezone Handling**        | UTC-safe everywhere                    | Prevents bugs in Melbourne (UTC+10/+11), handles DST   |
| **Date Storage**             | YYYY-MM-DD strings                     | No timezone, consistent across all systems             |
| **Date Parsing**             | Always add 'Z' suffix                  | Forces UTC interpretation, no local timezone issues    |
| **Date Methods**             | Use getUTCDay(), setUTCDate()          | Ensures consistent behavior regardless of local time   |
| **Week Format**              | Monday-Sunday (ISO 8601)               | Industry standard, aligns with business week           |
| **Client Filtering**         | Fetch + Filter in JavaScript           | Reliable for <10K records, easier to maintain          |
| **Array Filtering**          | JavaScript over PostgREST              | PostgREST array syntax is tricky and version-dependent |
| **Performance Trade-off**    | Slight over-fetching acceptable        | <100ms impact for typical salon, optimize when needed  |
| **Service Types**            | Three-type system                      | Flexible: regular, variants, bundles                   |
| **Variant Groups**           | Parent-child relationship              | Clean hierarchy, calculated pricing                    |
| **Custom Pricing**           | NULL = default, value = override       | Flexible per-stylist rates without duplication         |
| **Service State Management** | Props over state                       | Auto-updates after router.refresh()                    |
| **Modal Workflows**          | Multi-step for complex forms           | Better UX, logical grouping                            |
| **Time Tracking**            | JSONB breaks array                     | Flexible, tracks multiple breaks per shift             |
| **Pay Rates**                | Default + Custom (per member)          | System defaults with individual overrides              |
| **Break Calculation**        | Paid threshold (e.g., 30min)           | First X minutes paid, remainder unpaid                 |
| **Kiosk Mode**               | Admin manages any team member          | Efficient for physical time clock stations             |
| **Rate Precedence**          | Custom > Default                       | Member-specific rates override system defaults         |
| **Holiday Detection**        | Database lookup by date                | Automatic rate application without manual flagging     |
| **Shift Status**             | Enum (clocked_in/on_break/completed)   | Clear state machine, prevents invalid transitions      |
| **Payroll Grouping**         | By rate type (weekday/sat/sun/holiday) | Transparent breakdown for accounting                   |
| **Loading States**           | Show during data refresh               | Clear user feedback, prevents confusion                |
| **TypeScript Types**         | Explicit interfaces, no `any`          | Type safety, better IDE support, fewer bugs            |

---

## 📝 Recent Updates

**October 2025:**

- ✅ **Completed Phase 4.75: Staff Management** 🎉

  - Built complete time tracking and payroll system
  - Implemented kiosk mode for admin management
  - Created flexible pay rates system (default + custom)
  - Built public holidays management
  - Implemented comprehensive payroll reports
  - Added break tracking with paid/unpaid calculation
  - Created long-running shift alerts
  - Real-time shift duration timer

- ✅ **Time Tracking Architecture**

  - Clock in/out with venue selection
  - Break management (multiple breaks per shift)
  - JSONB array for flexible break storage
  - Status state machine (clocked_in → on_break → clocked_in → completed)
  - Automatic hour calculations with database functions
  - UTC-safe time handling throughout

- ✅ **Kiosk Mode Implementation**

  - Admins can select any team member from dropdown
  - Admin actions pass selectedStaffId to server
  - Non-admin users only see/manage own shifts
  - Visual staff selector with photos
  - Selected staff display banner
  - Security enforced in all server actions

- ✅ **Pay Rates System**

  - System-wide default rates (weekday/Saturday/Sunday/holiday)
  - Per-member custom rate overrides
  - NULL values = use defaults (auto-update with system changes)
  - Set values = locked overrides (don't change with system updates)
  - Effective rate calculation based on date and member
  - Paid break duration threshold
  - Automatic rate application in payroll

- ✅ **Payroll Reporting**

  - Date range selection with quick presets
  - Period types (weekly/fortnightly/monthly)
  - Team member filtering (all or specific)
  - Summary statistics (total pay, hours, averages)
  - Breakdown by rate type (weekday/Saturday/Sunday/holiday)
  - Expandable rows showing individual shifts
  - CSV export functionality

- ✅ **Technical Quality**
  - Full TypeScript type safety
  - Proper Supabase foreign key relationship hints
  - useCallback optimization for performance
  - Loading states for all async operations
  - Error handling with user feedback
  - Audit trail with created_by/updated_by
  - Security checks for kiosk mode operations

**Previous Updates:**

- ✅ **Completed Phase 4.5: Service Management** (October 2025)
- ✅ **Completed Phase 4: Client Management** (October 2025)
- ✅ **Completed Phase 3.5: Scheduling System** (October 2025)
- ✅ **Completed Phase 3: Admin Panel** (October 2025)

---

## 🔮 Lessons Learned

### Kiosk Mode Security Pattern

**Implementation:**

- Admin functions receive optional `teamMemberId` parameter
- Server actions check: `isAdmin && teamMemberId ? teamMemberId : supabaseUserId`
- Non-admin users automatically restricted to own ID
- Admin with no teamMemberId also restricted to own ID
- Security enforced server-side, not client-side

**Key Principle:**

> "For multi-user management, pass target user ID as optional parameter. Always verify admin status server-side before using provided ID."

### JSONB for Flexible Data

**Break Tracking Implementation:**

- Breaks stored as JSONB array: `[{start: timestamp, end: timestamp | null}]`
- Allows unlimited breaks per shift
- Current break tracked separately: `current_break_start`
- Easy to query and calculate total break time
- Schema remains flexible for future additions

**Key Principle:**

> "Use JSONB for arrays of structured data that don't need complex queries. Simpler than junction tables for 1:N relationships when N items are always queried together."

### Pay Rate Precedence Pattern

**NULL vs Set Value Overrides:**

- NULL in custom rate = use system default (auto-updates)
- Set value in custom rate = locked override (manual updates only)
- Database function checks custom first, falls back to default
- Clear intent: NULL means "no preference", value means "locked"

**Key Principle:**

> "For override patterns, NULL = 'inherit default' (auto-updates), explicit value = 'locked override' (manual only). Makes intent clear and behavior predictable."

### Effective Rate Calculation

**Date-Aware Rate Logic:**

- Check if date is public holiday → use holiday rate
- Else check day of week → use weekday/Saturday/Sunday rate
- Always check custom rates first, then default rates
- Database function keeps logic centralized
- Single source of truth for all payroll calculations

**Key Principle:**

> "Centralize complex business logic in database functions. Ensures consistency across all application layers and simplifies testing."

### Modal State Synchronization

**Problem Discovered:**

- Edit modals initialized state from props only on first render
- When data updated after submission, modal state didn't sync
- `useState(initialValue)` ignores new prop values after first render
- Had to refresh entire page to see updated values in edit modal

**Solution Implemented:**

- Added `useEffect` to sync state when modal opens or props change
- Reset all form fields from props when `isOpen` becomes true
- Monitors both `isOpen` and data props in dependency array
- Clears error states and resets UI when modal opens

```typescript
useEffect(() => {
  if (isOpen) {
    setName(category.name);
    setDescription(category.description || '');
    setSelectedColor(category.color);
    setError('');
  }
}, [isOpen, category]);
```

**Key Principle:**

> "Edit modals must sync state with props when opened. `useState` initial values only run once—use `useEffect` to re-sync when props change."

### List State Management with Router Refresh

**Problem Discovered:**

- List component stored data in state: `const [services] = useState(initialServices)`
- After mutations, `router.refresh()` fetched new data from server
- Parent component re-rendered with fresh props
- But child component's state never updated (stale data)
- UI showed old values until full page refresh

**Solution Implemented:**

- Changed from state to direct props usage: `const services = initialServices`
- Removed unnecessary state that duplicates props
- Now when parent re-renders with new data, child automatically shows it
- `router.refresh()` pattern works perfectly

```typescript
// ❌ BEFORE: State never updates
const [services] = useState(initialServices);

// ✅ AFTER: Auto-updates with props
const services = initialServices;
```

**Key Principle:**

> "Don't store props in state if you want automatic updates. Use props directly—they update when parent re-renders. Reserve state for UI-only values like search queries."

### Service Types Architecture

**Decision Made:**

- Three service types in one table with `type` field
- `service`: Regular bookable service or variant option
- `variant_group`: Parent showing variant options modal (not directly bookable)
- `bundle`: Package of multiple services

**Why This Works:**

- Single table with flexible `type` field is simpler than 3 separate tables
- Parent-child relationship via `parent_service_id` for variants
- Bundles use junction table `bundle_items` for many-to-many
- Price calculation: variants show "from £X" (minimum variant price)
- `is_bookable` flag controls booking behavior per type

**Key Principle:**

> "Use type discriminators in a single table when entities share 80% of fields. Separate tables when they're fundamentally different."

### Custom Pricing Architecture

**Decision Made:**

- Store custom price/duration in `service_team_members` table
- NULL = use service default (auto-updates with service changes)
- Set value = locked override (won't change with service updates)
- Helper functions: `get_effective_price()`, `get_effective_duration()`

**Why This Works:**

- No service duplication needed for different team members
- Service updates automatically apply to all team members (unless overridden)
- Team members can have individualized rates when needed
- Database functions encapsulate pricing logic
- Clean separation of concerns

**Key Principle:**

> "For optional overrides, use NULL to mean 'use default' and explicit values to mean 'locked override'. Provides flexibility without complexity."

### Client Role Filtering

**Problem Discovered:**

- PostgREST array operators are tricky and version-dependent
- `.not('roles', 'cs', '{team_member}')` syntax confusing
- `cs` (contains), `cd` (contained by), `ov` (overlaps) operators unclear
- Array negation doesn't always work as expected

**Solution Implemented:**

- Fetch all users with 'client' role first
- Filter in JavaScript to exclude team members and admins
- More reliable and easier to debug
- Performance negligible for typical salon size (<10K clients)

**Key Principle:**

> "For small to medium datasets (<10K records), JavaScript filtering after fetch is more maintainable than complex database queries. Optimize when you have real performance data."

### Date Formatting Hydration

**Problem Discovered:**

- `toLocaleDateString()` without locale caused hydration mismatch
- Server used one locale (AU: DD/MM/YYYY), client used another (US: MM/DD/YYYY)
- React hydration error: "text didn't match the client"

**Solution Implemented:**

- Always specify locale in `toLocaleDateString('en-US', {...})`
- Consistent formatting on both server and client
- Prevents hydration mismatches

**Key Principle:**

> "Always specify locale and format options for date/time rendering to ensure server-client consistency."

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

**Key Principle:**

> "When working with dates in databases, always think in UTC, never in local time."

### TypeScript Type Safety

**Problem Discovered:**

- Using `any` types in complex data structures led to runtime errors
- Supabase query results have nested objects that need proper typing
- Modal state management became error-prone without explicit types

**Solution Implemented:**

- Created explicit interfaces for all database query results
- Added proper types for component props and state
- Handled both array and single object returns from Supabase
- Used type assertions only when necessary with proper validation

**Key Principle:**

> "Invest time in proper TypeScript types upfront—they catch bugs before they reach production."

---

**Document Status:** Living document - update as architecture evolves  
**Next Review:** After Booking System (Phase 5) planning  
**Architecture:** Clerk for Authentication, Supabase for Authorization (Finalized & Simplified)  
**Last Major Change:** Completed Phase 4.75 - Staff Management (October 2025)
