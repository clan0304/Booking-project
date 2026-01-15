# Hair Salon Booking System - Architecture Documentation

> **Project Goal:** Build a hair salon booking system similar to Fresha  
> **Last Updated:** January 2025  
> **Architecture:** Clerk for Authentication, Supabase for Authorization (Simplified)

---

## 📋 Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema](#database-schema)
4. [Development Roadmap](#development-roadmap)
   - [Phase 1: Foundation](#phase-1-foundation--completed)
   - [Phase 2: Authentication & Onboarding](#phase-2-authentication--onboarding--completed)
   - [Phase 2.5: Architecture Simplification](#phase-25-architecture-simplification--completed)
   - [Phase 3: Admin Panel](#phase-3-admin-panel--completed)
   - [Phase 3.5: Scheduling System](#phase-35-scheduling-system--completed)
   - [Phase 4: Client Management](#phase-4-client-management--completed)
   - [Phase 4.5: Service Management](#phase-45-service-management--completed)
   - [Phase 4.75: Staff Management](#phase-475-staff-management--completed)
   - [Phase 4.8: Products Management (JWT + RLS)](#phase-48-products-management-jwt--rls--completed)
   - [Phase 4.85: Service Groups Migration](#phase-485-service-groups-migration--completed)
   - [Phase 5: Booking System & Admin Calendar](#phase-5-booking-system--admin-calendar--completed)
   - [Phase 5.5: Booking Holds](#phase-55-booking-holds--completed)
   - [Phase 6: Stripe Payment Integration](#phase-6-stripe-payment-integration--completed)
   - [Phase 6.5: Client Dashboard & Reviews](#phase-65-client-dashboard--reviews--completed)
   - [Phase 7: Email Notifications](#phase-7-email-notifications--todo)
   - [Phase 8: Future Enhancements](#phase-8-future-enhancements--todo)
5. [Key Files Structure](#key-files-structure)
6. [Lessons Learned](#lessons-learned)
7. [Critical Decisions Summary](#critical-decisions-summary)

---

## 🛠️ Tech Stack

| Category           | Technology                                                                |
| ------------------ | ------------------------------------------------------------------------- |
| **Frontend**       | Next.js 15+ (App Router), TypeScript, Tailwind CSS, shadcn/ui             |
| **Backend**        | Next.js Server Actions, API Routes                                        |
| **Database**       | Supabase (PostgreSQL)                                                     |
| **Authentication** | Clerk (Email/Password + Google OAuth)                                     |
| **Authorization**  | Supabase (roles stored in database only)                                  |
| **Payments**       | Stripe (cards, terminals, refunds)                                        |
| **Storage**        | Supabase Storage (user photos, team photos, venue photos, product images) |
| **Data Access**    | Service Role (server-side) for all operations                             |
| **Timezone**       | UTC-safe date/time utilities for Melbourne (UTC+10/+11)                   |

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
   - No syncing needed between systems
   - Roles stored ONLY in Supabase

3. **Role-Based Access Control**

   - Users can have multiple roles: `['client', 'team_member', 'admin']`
   - Permissions enforced server-side with explicit filtering
   - Middleware queries Supabase to check roles for route protection
   - Role changes take effect immediately (no sign out/in required)

4. **Server-Side Data Access Pattern**

   - All operations use Service Role (`supabaseAdmin`)
   - Server-side filtering ensures users only access their data
   - Auth checks via `requireAuth()`, `requireStaff()`, `requireAdmin()`
   - RLS policies disabled (Service Role bypasses them anyway)

5. **Timezone-Safe Date Handling**

   - All dates stored as YYYY-MM-DD strings (no timezone)
   - UTC-safe parsing prevents timezone conversion bugs
   - Works correctly in Melbourne (UTC+10/+11) year-round
   - Handles daylight saving time transitions automatically

6. **Service Groups Architecture**
   - Services are independent (no parent-child relationships)
   - Service Groups are optional UI presentation layers
   - Groups don't affect appointment creation or pricing
   - Clean separation: services = data, groups = UI organization

---

## 🗄️ Database Schema

### Core Tables

| Table            | Purpose                                   | Key Fields                                                                                                             |
| ---------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **users**        | All users (clients, team members, admins) | id, clerk_user_id, email, first_name, last_name, phone_number, birthday, photo_url, roles[], is_registered, alert_note |
| **client_notes** | Notes about clients                       | id, client_id, note, created_by                                                                                        |
| **team_members** | Additional team member info               | id, user_id, position, bio, specialties[], is_active, hire_date                                                        |

### Venue & Scheduling Tables

| Table                     | Purpose                  | Key Fields                                                  |
| ------------------------- | ------------------------ | ----------------------------------------------------------- |
| **venues**                | Salon locations          | id, name, address, phone_number, photo_url, slug, is_listed |
| **venue_operating_hours** | Business hours per venue | venue_id, day_of_week, start_time, end_time, is_closed      |
| **team_member_venues**    | Team-venue assignments   | team_member_id, venue_id, is_active                         |
| **shifts**                | Individual work shifts   | team_member_id, venue_id, shift_date, start_time, end_time  |
| **venue_closed_days**     | Venue closures           | venue_id, closed_date, reason, is_recurring                 |

### Service Tables

| Table                    | Purpose                              | Key Fields                                                                                     |
| ------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **service_categories**   | Service grouping                     | id, name, color, display_order, is_active                                                      |
| **services**             | Service offerings                    | id, name, category_id, type (service/bundle), price_type, price, duration_minutes, is_bookable |
| **bundle_items**         | Bundle contents                      | bundle_id, service_id, sequence_order                                                          |
| **service_venues**       | Service-venue availability           | service_id, venue_id, is_active                                                                |
| **service_team_members** | Service assignments + custom pricing | service_id, team_member_id, custom_price, custom_duration_minutes                              |
| **service_groups**       | UI presentation grouping             | id, name, category_id, display_mode, display_order                                             |
| **service_group_items**  | Services in groups                   | service_group_id, service_id, display_order                                                    |

### Staff Management Tables

| Table                       | Purpose                 | Key Fields                                                                            |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| **staff_time_entries**      | Work hours tracking     | team_member_id, venue_id, shift_date, clock_in_time, clock_out_time, breaks[], status |
| **staff_default_pay_rates** | System-wide pay rates   | weekday_rate, saturday_rate, sunday_rate, public_holiday_rate, paid_break_minutes     |
| **staff_pay_rates**         | Per-member custom rates | team_member_id, weekday_rate, saturday_rate, sunday_rate, public_holiday_rate         |
| **public_holidays**         | Holiday tracking        | date, name, is_recurring                                                              |

### Products Tables (JWT + RLS)

| Table                  | Purpose           | Key Fields                                                  |
| ---------------------- | ----------------- | ----------------------------------------------------------- |
| **products**           | Product inventory | id, venue_id, category_id, name, price, quantity, image_url |
| **product_categories** | Product grouping  | id, venue_id, name, color                                   |

### Booking Tables

| Table              | Purpose                     | Key Fields                                                                                     |
| ------------------ | --------------------------- | ---------------------------------------------------------------------------------------------- |
| **booking_groups** | Booking container           | venue_id, client_id, guest_info, booking_date, total_price, status, payment_status, total_paid |
| **appointments**   | Individual appointments     | booking_id, service_id, team_member_id, start_time, end_time, price, status                    |
| **booking_holds**  | Temporary slot reservations | venue_id, team_member_id, session_token, hold_date, start_time, expires_at                     |

### Review Tables

| Table       | Purpose                    | Key Fields                                                                             |
| ----------- | -------------------------- | -------------------------------------------------------------------------------------- |
| **reviews** | Client reviews per stylist | id, booking_group_id, client_id, venue_id, team_member_id, rating, review_text, status |

**Reviews Table Details:**

- Reviews are **per-stylist** within a booking (not per-venue like Fresha)
- Supports group bookings where multiple stylists can be reviewed independently
- Status: `published` or `hidden` (admin can hide inappropriate reviews)
- Unique constraint: One review per (booking_group_id, team_member_id, client_id)

### Payment Tables

| Table                     | Purpose                       | Key Fields                                                           |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| **stripe_customers**      | Client-Stripe link            | client_id, stripe_customer_id                                        |
| **payment_methods**       | Saved cards (references only) | stripe_customer_id, stripe_payment_method_id, last4, brand           |
| **stripe_terminals**      | EFTPOS machines per venue     | venue_id, stripe_location_id, stripe_reader_id                       |
| **cancellation_policies** | Per-venue fee rules           | venue_id, notice_hours, fee_percentage                               |
| **transactions**          | Payment records               | booking_id, stripe_payment_intent_id, amount, payment_method, status |
| **transaction_items**     | Line items per transaction    | transaction_id, appointment_id, amount                               |
| **refunds**               | Refund records                | transaction_id, stripe_refund_id, amount, reason                     |
| **refund_items**          | Refunded items                | refund_id, transaction_item_id, amount                               |
| **stripe_webhook_events** | Idempotency log               | stripe_event_id, event_type, processed_at                            |

### Storage Buckets

| Bucket                 | Purpose                    | Access                          |
| ---------------------- | -------------------------- | ------------------------------- |
| **user-photos**        | User profile photos        | Public read, Server upload      |
| **team-member-photos** | Team member photos         | Public read, Server upload      |
| **venue-photos**       | Venue/location photos      | Public read, Server upload      |
| **product-images**     | Product images (5MB limit) | Public read, Admin upload (RLS) |

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

---

### Phase 2: Authentication & Onboarding ✅ (COMPLETED)

- [x] Clerk authentication setup
- [x] Onboarding flow (email/password)
- [x] Onboarding flow (Google OAuth)
- [x] Photo upload functionality (server-side)
- [x] Middleware for route protection
- [x] Account claiming flow
- [x] Dashboard with onboarding check
- [x] Profile page with edit functionality

---

### Phase 2.5: Architecture Simplification ✅ (COMPLETED)

- [x] Removed role syncing between Clerk and Supabase
- [x] Updated auth helpers to query Supabase for roles
- [x] Updated middleware to check Supabase for authorization
- [x] Simplified webhook (no role sync)
- [x] Created role management utilities
- [x] Instant role changes (no sign out/in needed)

---

### Phase 3: Admin Panel ✅ (COMPLETED)

- [x] Admin dashboard layout with navigation (Fresha-inspired)
- [x] Sidebar with icon navigation (11 menu items)
- [x] Top navbar with search, notifications, user menu
- [x] **Marketplace/Venues Management**
  - [x] Venues CRUD with auto-slug generation
  - [x] Venue photo uploads
  - [x] Search, filter, sort functionality
  - [x] Unique booking URLs (`domain.com/venue-name-123456`)
- [x] **Team Member Management**
  - [x] Team list with search/filter
  - [x] Add/Edit team member modals
  - [x] Toggle active/inactive status
  - [x] Public API endpoint (`/api/public/team`)
  - [x] Account claiming support

---

### Phase 3.5: Scheduling System ✅ (COMPLETED)

- [x] **Database Schema**
  - [x] Venue operating hours, shifts, closed days tables
  - [x] Team member venues junction table
  - [x] Database functions and triggers
- [x] **Timezone-Safe Date Utilities**
  - [x] UTC-safe date parsing (Melbourne UTC+10/+11)
  - [x] Week calculation (Mon-Sun format)
  - [x] Handles daylight saving time
- [x] **Server Actions**
  - [x] Shift CRUD + repeating shifts pattern
  - [x] Conflict detection and resolution
  - [x] Venue hours management
  - [x] Team-venue assignments
  - [x] Bulk operations
- [x] **UI Components**
  - [x] Venue selector, week navigator
  - [x] Calendar grid view (Mon-Sun)
  - [x] Shift modals (single, repeating, assign venue)
  - [x] Context menu for shift actions

---

### Phase 4: Client Management ✅ (COMPLETED)

- [x] **Client List Page**
  - [x] Table-based layout (Fresha-inspired)
  - [x] Search by name, email, phone
  - [x] Filter by status (All, Registered, Unregistered)
  - [x] Stats dashboard with alert indicators
  - [x] Profile photos with gradient fallback
- [x] **Client CRUD**
  - [x] Add/Edit/Delete client modals
  - [x] Email uniqueness check
  - [x] Photo upload with preview
  - [x] Alert note field
  - [x] Account claiming support
- [x] **Client Filtering**
  - [x] Show only pure clients (exclude team members/admins)
  - [x] JavaScript-based filtering for reliability

---

### Phase 4.5: Service Management ✅ (COMPLETED)

- [x] **Service Categories**
  - [x] Create, edit, delete categories
  - [x] Color picker with 12 preset colors
  - [x] Display order management
- [x] **Services Management**
  - [x] Two service types: `service` and `bundle`
  - [x] 2-step modal (Basic Info → Locations & Team)
  - [x] Price types: Fixed or "From" pricing
  - [x] Duration selection (15min to 3h)
  - [x] Venue and team member assignments
- [x] **Custom Pricing per Team Member**
  - [x] Override price/duration per team member
  - [x] NULL = use default, value = override
  - [x] "Custom" badge indicators
  - [x] Reset to default functionality

---

### Phase 4.75: Staff Management ✅ (COMPLETED)

- [x] **Time Tracking System**
  - [x] Clock in/out with venue selection
  - [x] Break management (start/end, JSONB array storage)
  - [x] Live duration timer during active shifts
  - [x] Status tracking (clocked_in, on_break, completed)
- [x] **Kiosk Mode (Admin Feature)**
  - [x] Admin can clock in/out for any team member
  - [x] Staff selector dropdown with photos
  - [x] Security enforced in server actions
- [x] **Pay Rates Management**
  - [x] System-wide default rates (weekday/Saturday/Sunday/holiday)
  - [x] Per-member custom rate overrides
  - [x] Paid break duration threshold
  - [x] Automatic effective rate calculation
- [x] **Public Holidays Management**
  - [x] Add/delete holidays with recurring support
  - [x] Automatic holiday rate application
- [x] **Payroll Reports**
  - [x] Date range selection with quick presets
  - [x] Breakdown by rate type
  - [x] CSV export functionality
- [x] **Long-Running Shifts Alert**
  - [x] Automatic detection of shifts > 12 hours
  - [x] Visual alert banner

---

### Phase 4.8: Products Management (JWT + RLS) ✅ (COMPLETED)

> ⚠️ **Special Note:** This phase uses JWT + RLS for educational purposes. All other features use Service Role pattern.

- [x] **JWT + RLS Integration**
  - [x] Clerk JWT template configuration
  - [x] Supabase JWT client (`lib/supabase/jwt-client.ts`)
  - [x] RLS policies (Admin: full CRUD, Team: read-only)
- [x] **Products Management**
  - [x] Two-tab interface (Products | Categories)
  - [x] Image upload with 5MB limit
  - [x] Stock status badges
  - [x] Multi-venue support
- [x] **Categories Management**
  - [x] Color picker with 8 preset colors
  - [x] Venue-scoped categories

**Architecture Comparison:**

| Feature      | Products (Phase 4.8)        | All Other Features   |
| ------------ | --------------------------- | -------------------- |
| **Client**   | `createSupabaseJWTClient()` | `supabaseAdmin`      |
| **Auth**     | JWT from Clerk template     | Service Role key     |
| **Security** | RLS Policies (database)     | Server Actions (app) |
| **Purpose**  | Learning JWT + RLS          | Production pattern   |

---

### Phase 4.85: Service Groups Migration ✅ (COMPLETED)

- [x] **Database Architecture Change**
  - [x] Removed `parent_service_id` from services table
  - [x] Removed `variant_id` from appointments table
  - [x] Removed `variant_group` service type
  - [x] Created `service_groups` table (UI layer only)
  - [x] Created `service_group_items` junction table
- [x] **Frontend Migration**
  - [x] Removed variant-related components (AddVariantModal, VariantListModal)
  - [x] Updated service forms
  - [x] Simplified ServiceCard
- [x] **Service Groups Implementation**
  - [x] ServiceGroupList component
  - [x] Add/Edit ServiceGroup modals
  - [x] Display modes: Modal and List
  - [x] Services can belong to multiple groups

---

### Phase 5: Booking System & Admin Calendar ✅ (COMPLETED)

- [x] **Public Booking Flow**

  - [x] 6-step wizard (Service → Team → Date/Time → Guest Info → Summary → Confirmation)
  - [x] Service selection with category grouping
  - [x] Team member selection with "Any Professional" option
  - [x] Calendar with timezone-safe date handling
  - [x] Time slot selection (30-min intervals)
  - [x] Guest information form
  - [x] Booking summary and confirmation

- [x] **Availability System**

  - [x] API endpoint: `/api/public/bookings/availability`
  - [x] Venue closed days check
  - [x] Team member shift check (venue-specific)
  - [x] Existing appointments conflict detection
  - [x] Available time slot generation
  - [x] Real-time availability updates

- [x] **Booking Creation**

  - [x] API endpoint: `/api/public/bookings/create`
  - [x] Request validation
  - [x] Double-booking prevention (RPC: `is_time_slot_available`)
  - [x] Transaction rollback on failure
  - [x] Client ID association for authenticated users

- [x] **Admin Calendar - Day View**

  - [x] Fresha-style column layout (team members side-by-side)
  - [x] Profile photos at top of each column
  - [x] Dynamic column widths (1-5 optimized, 6+ scrollable)
  - [x] Clickable unavailable slots
  - [x] Shift availability visualization (4 states)
  - [x] Hover tooltips for appointment details
  - [x] 20px time slot grid (15-min intervals)

- [x] **Admin Calendar - Week View**

  - [x] Team members as rows, days as columns
  - [x] Clickable unavailable slots
  - [x] Same availability logic as day view

- [x] **Appointment Creation (Admin)**

  - [x] Fresha-style right-side modal
  - [x] 3-step wizard (Service → Client → Details)
  - [x] Service search and category filtering
  - [x] Client search with recent clients list
  - [x] Walk-in quick selection
  - [x] Manual price/duration overrides
  - [x] Reuses AddClientModal (zero code duplication)

- [x] **Appointment Editing (Admin)**
  - [x] Fresha-style edit modal (right-side slide-in)
  - [x] Service picker with full-screen overlay
  - [x] Team member dropdown with photos
  - [x] Smart value preservation (initial → new rates on team change)
  - [x] Discount system with visual indicators
  - [x] Manual price/duration override
  - [x] Service assignment enforcement
  - [x] Delete with confirmation dialog

---

### Phase 5.5: Booking Holds ✅ (COMPLETED)

- [x] **Hold System**

  - [x] 15-minute temporary holds on time slots
  - [x] DELETE-based cleanup (holds deleted when expired)
  - [x] `booking_holds` table with session tokens
  - [x] `cleanup_expired_booking_holds()` database function

- [x] **"Any Professional" Handling**

  - [x] Silent auto-assignment at time selection
  - [x] Customer doesn't see stylist name until summary step
  - [x] `slotToTeamMember` mapping from availability API

- [x] **Admin Calendar Integration**

  - [x] Active holds displayed as light blue blocks
  - [x] "Online booking in progress" label with cloud icon
  - [x] Auto-refresh every 30 seconds
  - [x] "Expires in X min" countdown

- [x] **Cleanup Mechanisms**
  - [x] On-demand: `safeCleanupExpiredHolds()`
  - [x] Scheduled: Cron job endpoint
  - [x] Availability API always filters expired holds

---

### Phase 6: Stripe Payment Integration ✅ (COMPLETED)

- [x] **Database Schema (10 tables + triggers)**

  - [x] stripe_customers, payment_methods, stripe_terminals
  - [x] cancellation_policies, transactions, transaction_items
  - [x] refunds, refund_items, stripe_webhook_events
  - [x] Added: total_paid, payment_status to booking_groups

- [x] **Stripe Action Files**

  - [x] customers.ts - Create/get Stripe customers
  - [x] setup-intents.ts - Save cards without charging
  - [x] payment-intents.ts - Charge cards, record payments
  - [x] refunds.ts - Process refunds

- [x] **Checkout UI Components**

  - [x] Payment method picker (5 types)
  - [x] Order summary with split payment support
  - [x] Saved card form
  - [x] Manual card entry (Stripe Elements)
  - [x] Terminal form (simulated in dev)
  - [x] Cash form with change calculation
  - [x] Test payment form (dev only)

- [x] **Payment Flows**

  - [x] Card collection at booking (no charge)
  - [x] Checkout with split payments
  - [x] Late cancel / no-show auto-charge (48hr policy, 50% fee)
  - [x] Item-level refunds

- [x] **Completed Booking Indicators**

  - [x] Gray appointment cards for completed bookings
  - [x] "View Sale" modal for transaction history
  - [x] 70% opacity + checkmark badge

- [x] **Dual-Mode Handling**

  - [x] Development: Simulated terminal/test payments
  - [x] Production: Real Stripe payments only

- [x] **Webhook Handler**
  - [x] payment_intent.succeeded/failed
  - [x] setup_intent.succeeded
  - [x] charge.refunded
  - [x] terminal.reader.action_succeeded/failed
  - [x] Idempotency via stripe_webhook_events table

---

### Phase 6.5: Client Dashboard & Reviews ✅ (COMPLETED)

- [x] **Client Dashboard**

  - [x] Fresha-style two-panel layout (list + detail)
  - [x] Booking list with venue photos and quick stats
  - [x] Booking detail panel with services, pricing, venue info
  - [x] Mobile-responsive slide-over for booking details
  - [x] Upcoming vs Past booking separation
  - [x] Cancel booking (48hr policy enforcement)

- [x] **Review System**

  - [x] Per-stylist reviews (not per-venue like Fresha)
  - [x] Star rating (1-5) with labels: Terrible, Bad, Okay, Good, Great
  - [x] Review text with 600 character limit
  - [x] Fresha-style modal popup on star click
  - [x] Shows only for completed bookings
  - [x] Hides review prompt after stylist reviewed
  - [x] Displays submitted reviews with read-only stars

- [x] **Review Admin Features**

  - [x] Hide/unhide reviews (staff)
  - [x] View all reviews with filters (venue, team member, status)
  - [x] Team member review statistics
  - [x] Venue review statistics

- [x] **Technical Implementation**
  - [x] `reviews` table with proper foreign keys
  - [x] RLS consideration: Use `supabaseAdmin` for fetching team member details
  - [x] Optimistic UI updates for submitted reviews
  - [x] Local review tracking before page refresh

---

### Phase 7: Email Notifications 🚧 (TODO)

- [ ] **Booking Notifications**

  - [ ] Booking confirmation email
  - [ ] Reminder email (24h before)
  - [ ] Cancellation notification
  - [ ] Rescheduling notification

- [ ] **Payment Notifications**

  - [ ] Payment receipt email
  - [ ] Refund confirmation
  - [ ] Late cancel/no-show charge notification

- [ ] **Email Service Integration**
  - [ ] Resend or SendGrid setup
  - [ ] Email templates (branded)
  - [ ] Unsubscribe handling

---

### Phase 8: Future Enhancements 🚧 (TODO)

- [ ] **EFTPOS Terminal Integration**

  - [ ] Real Stripe Terminal SDK integration
  - [ ] Multi-venue terminal assignment
  - [ ] Terminal status monitoring

- [ ] **Card Collection During Public Booking**

  - [ ] SetupIntent during online booking
  - [ ] Card on file for cancellation fees
  - [ ] Payment method selection UI

- [ ] **Enhanced Payment Features**

  - [ ] Tip entry UI in checkout
  - [ ] Split payments by amount (not just method)
  - [ ] Deposit/prepayment support

- [ ] **Product Sales Integration**

  - [ ] Add products to checkout
  - [ ] Mixed service + product transactions
  - [ ] Inventory management

- [ ] **Cancellation Policy UI**

  - [ ] Per-venue policy settings
  - [ ] Notice period configuration
  - [ ] Fee percentage adjustment

- [ ] **Reports & Analytics**

  - [ ] Transaction history page
  - [ ] Revenue reports (daily/weekly/monthly)
  - [ ] Team member performance metrics
  - [ ] Popular services analytics

- [ ] **Client Self-Service**

  - [ ] Token-based booking links (reschedule/cancel)
  - [ ] Client booking history
  - [ ] Saved payment methods management

- [ ] **Receipt System**

  - [ ] Print receipt functionality
  - [ ] Email receipt option
  - [ ] Receipt templates

- [ ] **SMS Notifications**
  - [ ] Twilio integration
  - [ ] Booking reminders
  - [ ] Confirmation messages

---

## 📚 Key Files Structure

```
project-root/
├── CLAUDE.md                          # This file
├── .env.local                         # Environment variables
├── next.config.ts                     # Next.js configuration
│
├── app/
│   ├── actions/
│   │   ├── onboarding.ts             # Onboarding server action
│   │   ├── profile.ts                # Profile update server action
│   │   ├── admin.ts                  # Admin operations (users, roles)
│   │   ├── team-members.ts           # Team member management
│   │   ├── clients.ts                # Client CRUD operations
│   │   ├── venues.ts                 # Venue CRUD operations
│   │   ├── shifts.ts                 # Shift CRUD + repeating shifts
│   │   ├── venue-hours.ts            # Venue hours management
│   │   ├── team-venue-assignments.ts # Assign/unassign team to venues
│   │   ├── venue-closed-days.ts      # Closed days management
│   │   ├── services.ts               # Services, categories, groups, custom pricing
│   │   ├── staff-management.ts       # Time tracking, clock in/out, breaks
│   │   ├── staff-pay-rates.ts        # Pay rates, holidays, payroll
│   │   ├── products.ts               # Products CRUD (JWT + RLS)
│   │   ├── bookings.ts               # Booking creation + client dashboard
│   │   ├── reviews.ts                # Review CRUD operations
│   │   ├── calendar-appointments.ts  # Admin appointment CRUD
│   │   ├── booking-holds.ts          # Booking holds management
│   │   └── stripe/
│   │       ├── customers.ts          # Stripe customer management
│   │       ├── setup-intents.ts      # Save cards without charging
│   │       ├── payment-intents.ts    # Charge cards, record payments
│   │       ├── refunds.ts            # Process refunds
│   │       └── index.ts              # Re-exports
│   │
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── clerk/route.ts        # Clerk webhook
│   │   │   └── stripe/route.ts       # Stripe webhook
│   │   ├── admin/
│   │   │   └── team/all-members/route.ts
│   │   └── public/
│   │       ├── team/route.ts
│   │       └── bookings/
│   │           ├── availability/route.ts
│   │           ├── availability/combined/route.ts
│   │           └── create/route.ts
│   │
│   ├── admin/
│   │   ├── layout.tsx                # Admin layout wrapper
│   │   ├── page.tsx                  # Admin dashboard
│   │   ├── marketplace/page.tsx      # Venues management
│   │   ├── team/page.tsx             # Team + Scheduling tabs
│   │   ├── clients/page.tsx          # Client list page
│   │   ├── services/page.tsx         # Services management
│   │   ├── staff-management/page.tsx # Staff time tracking
│   │   ├── products/page.tsx         # Products management
│   │   └── calendar/page.tsx         # Admin calendar view
│   │
│   ├── dashboard/
│   │   └── page.tsx                  # Client dashboard page
│   │
│   └── [venue-slug]/                  # Public booking pages
│       └── page.tsx
│
├── components/
│   ├── admin/
│   │   ├── sidebar.tsx
│   │   ├── navbar.tsx
│   │   ├── admin-layout.tsx
│   │   │
│   │   ├── marketplace/              # Venue components
│   │   │
│   │   ├── team/
│   │   │   ├── team-list-client.tsx
│   │   │   ├── team-member-modal.tsx
│   │   │   ├── team-tabs.tsx
│   │   │   ├── scheduled-shifts-client.tsx
│   │   │   ├── venue-selector.tsx
│   │   │   ├── week-navigator.tsx
│   │   │   ├── assign-venue-modal.tsx
│   │   │   ├── repeating-shifts-modal.tsx
│   │   │   └── single-shift-modal.tsx
│   │   │
│   │   ├── clients/
│   │   │   ├── client-list-client.tsx
│   │   │   ├── add-client-modal.tsx
│   │   │   └── edit-client-modal.tsx
│   │   │
│   │   ├── services/
│   │   │   ├── service-list-client.tsx
│   │   │   ├── service-card.tsx
│   │   │   ├── add-category-modal.tsx
│   │   │   ├── edit-category-modal.tsx
│   │   │   ├── add-service-modal.tsx
│   │   │   ├── edit-service-modal.tsx
│   │   │   ├── custom-pricing-modal.tsx
│   │   │   ├── service-group-list.tsx
│   │   │   ├── add-service-group-modal.tsx
│   │   │   └── edit-service-group-modal.tsx
│   │   │
│   │   ├── staff-management/
│   │   │   ├── staff-management-client.tsx
│   │   │   ├── time-clock-panel.tsx
│   │   │   ├── active-shift-display.tsx
│   │   │   ├── time-entries-table.tsx
│   │   │   ├── long-running-alert.tsx
│   │   │   ├── pay-rates-tab.tsx
│   │   │   ├── default-pay-rates-card.tsx
│   │   │   ├── custom-pay-rates-list.tsx
│   │   │   ├── public-holidays-manager.tsx
│   │   │   └── payroll-reports-tab.tsx
│   │   │
│   │   ├── products/
│   │   │   ├── products-content.tsx
│   │   │   ├── products-tab.tsx
│   │   │   ├── categories-tab.tsx
│   │   │   └── modals/
│   │   │
│   │   ├── calendar/
│   │   │   ├── calendar-client.tsx       # Main container
│   │   │   ├── calendar-filters.tsx      # Navigation
│   │   │   ├── day-view.tsx              # Timeline (20px positioning)
│   │   │   ├── week-view.tsx             # Week grid
│   │   │   ├── appointment-card.tsx      # Hover tooltip
│   │   │   ├── blocked-time-modal.tsx
│   │   │   ├── time-slot-actions-modal.tsx
│   │   │   └── appointment/
│   │   │       ├── create-appointment-modal.tsx
│   │   │       ├── edit-appointment-modal.tsx
│   │   │       ├── edit-appointment-payment-mode.tsx
│   │   │       ├── sale-details-modal.tsx
│   │   │       └── types.ts
│   │   │
│   │   └── checkout/
│   │       ├── checkout-types.ts
│   │       ├── payment-method-picker.tsx
│   │       ├── order-summary.tsx
│   │       └── payment-forms/
│   │           ├── saved-card-form.tsx
│   │           ├── terminal-form.tsx
│   │           ├── manual-card-form.tsx
│   │           ├── cash-form.tsx
│   │           └── test-payment-form.tsx
│   │
│   ├── public/
│   │   └── dashboard/
│   │       ├── index.ts                  # Exports
│   │       ├── dashboard-client.tsx      # Main container with state
│   │       ├── booking-list.tsx          # Left panel booking list
│   │       ├── booking-detail.tsx        # Right panel details
│   │       ├── review-section.tsx        # Review prompts + submitted reviews
│   │       └── review-modal.tsx          # Fresha-style review modal
│   │
│   ├── booking/                       # Public booking flow components
│   │   ├── service-selection.tsx
│   │   ├── team-selection.tsx
│   │   ├── date-time-selection.tsx
│   │   ├── guest-info.tsx
│   │   ├── booking-summary.tsx
│   │   └── booking-confirmation.tsx
│   │
│   └── profile-form.tsx
│
├── lib/
│   ├── auth.ts                        # Auth helpers
│   ├── role-management.ts             # Role management
│   ├── shift-helpers.ts               # UTC-safe date utilities
│   ├── supabase/
│   │   ├── client.ts                  # Server-side Supabase (Service Role)
│   │   ├── server.ts                  # Server utilities
│   │   └── jwt-client.ts              # JWT client (Products only)
│   └── stripe/
│       └── server.ts                  # Stripe client + helpers
│
├── types/
│   ├── database.ts                    # Database types
│   ├── bookings.ts                    # Booking types
│   ├── calendar.ts                    # Calendar types
│   └── payments.ts                    # Payment types
│
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql     # Users, notes, team
        ├── 002_venues.sql             # Venues + slug generator
        ├── 003_scheduling_system.sql  # Shifts, hours, assignments
        ├── 004_services_system.sql    # Services, categories, pricing
        ├── 005_staff_management.sql   # Time tracking, pay rates
        ├── 006_products.sql           # Products (JWT + RLS)
        ├── 007_service_groups.sql     # Service groups migration
        ├── 008_bookings.sql           # Bookings + appointments
        ├── 009_booking_holds.sql      # Booking holds
        ├── 010_payments.sql           # Stripe payment tables
        └── 011_reviews.sql            # Reviews table
```

---

## 🔮 Lessons Learned

### Timezone Handling: Local vs UTC

**When to Use Each:**

| Context                    | Method         | Example                                                                     |
| -------------------------- | -------------- | --------------------------------------------------------------------------- |
| **User-Facing (Calendar)** | Local timezone | `formatLocalDate(date)` uses `getFullYear()`, `getMonth()`, `getDate()`     |
| **Database/Admin**         | UTC timezone   | `formatDate(date)` uses `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()` |

**Key Principle:**

> "Match timezone handling to context: Local for user-facing calendar selection, UTC for backend scheduling and database operations. Never mix the two in the same flow."

---

### Venue-Specific Data Filtering

**Problem:** Multi-location businesses need strict data isolation. Team members work at multiple venues on different days.

**Solution:**

```typescript
// ❌ WRONG: Shows ALL shifts for team member
.eq('team_member_id', teamMemberId)
.eq('shift_date', date)

// ✅ CORRECT: Shows only shifts for THIS venue
.eq('team_member_id', teamMemberId)
.eq('venue_id', venueId)  // Critical filter
.eq('shift_date', date)
```

**Key Principle:**

> "In multi-location systems, ALWAYS filter by venue_id in availability queries. Team member availability is venue-specific, not global."

---

### Appointment Price/Duration Snapshot

**Design Decision:** When appointments are created, price and duration are snapshots stored in the database, not live calculations.

**Why This Works:**

- **Price Stability** - Client quoted $40, they pay $40
- **Historical Accuracy** - Reports show actual charges
- **No Retroactive Changes** - Service price updates don't affect past bookings
- **Audit Trail** - Can see exactly what was charged

**Edit Modal Behavior:**

```typescript
// Initial load: Show stored values
if (selectedTeamMemberId === appointment.team_member_id) {
  setManualPrice(appointment.price); // Use stored snapshot
  setManualDuration(appointment.duration_minutes);
}

// Team member changed: Show new team member's rates
if (selectedTeamMemberId !== appointment.team_member_id) {
  setManualPrice(null); // Use new team member's current rate
  setManualDuration(null);
}
```

**Key Principle:**

> "Snapshot pricing at booking time for stability. Only update when explicitly changed (service selection, team member change, or manual override)."

---

### Service-Team Member Assignment Architecture

**Design:** Services must be explicitly assigned to team members in `service_team_members` table.

**Why This Matters:**

- **Custom Pricing** - Each team member can charge different rates
- **Service Availability** - Not all team members offer all services
- **Business Logic** - Senior stylists vs junior stylists pricing
- **Booking Validation** - Only show services the team member can perform

**Setup Required:**

1. Go to Admin → Services
2. Edit service → "Locations & Team" tab
3. Check team members who can perform service
4. Optionally set custom pricing per team member
5. Save changes

**Key Principle:**

> "Explicitly define service-team member relationships. Custom pricing per team member provides flexibility while maintaining service integrity."

---

### Calendar Appointment Positioning

**Problem:** Calendar grid uses 20px per 15-minute interval. Appointments calculated with different formula.

**Solution:**

```typescript
// ❌ WRONG: 30px per 15min
const top = startMinutes * 2; // 2px per minute = 30px per 15min

// ✅ CORRECT: 20px per 15min
const top = (startMinutes / 15) * 20; // 20px per 15min slot
```

**Key Principle:**

> "Always match positioning calculations to grid cell height. Even small misalignments compound and become obvious."

---

### Modal vs Hover Tooltip UX

**Problem with Click Modal:**

- Requires click to see appointment details
- Modal covers calendar view
- Extra interaction step

**Solution: Hover Tooltip:**

```typescript
<div className="group ...">
  {/* Compact card view */}
</div>
<div className="opacity-0 group-hover:opacity-100 transition-opacity">
  {/* Full appointment details */}
</div>
```

**Key Principle:**

> "Use hover tooltips for quick previews, modals for actions. Information should be easily accessible without clicks."

---

### Right-Side Modal Pattern (Fresha-Style)

**Problem with Center Modals:**

- Blocks entire screen view
- Context loss (can't see calendar behind it)
- Jarring full-screen transition

**Solution: Right-Side Slide-In:**

```typescript
<div className="fixed inset-y-0 right-0 w-full max-w-xl">
  {/* Calendar visible on left */}
  {/* Modal slides in from right */}
</div>
```

**Key Principle:**

> "For admin tools that reference other data (like calendars), use side panels instead of center modals. Preserving context improves UX and reduces cognitive load."

---

### Modal State Synchronization

**Problem:** Edit modals initialized state from props only on first render. When data updated after submission, modal state didn't sync.

**Solution:**

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

---

### Pay Rate Precedence Pattern

**NULL vs Set Value Overrides:**

- NULL in custom rate = use system default (auto-updates)
- Set value in custom rate = locked override (manual updates only)

**Key Principle:**

> "For override patterns, NULL = 'inherit default' (auto-updates), explicit value = 'locked override' (manual only). Makes intent clear and behavior predictable."

---

### Kiosk Mode Security Pattern

**Implementation:**

```typescript
// Admin functions receive optional teamMemberId parameter
// Server checks: isAdmin && teamMemberId ? teamMemberId : supabaseUserId
```

**Key Principle:**

> "For multi-user management, pass target user ID as optional parameter. Always verify admin status server-side before using provided ID."

---

### RLS vs Service Role for Related User Data

**Problem:** Client dashboard needs to display team member names/photos for appointments, but RLS on `users` table blocks access to other users.

**Context:**

- Clients can only read their own row in `users` table (RLS policy)
- Appointments reference `team_member_id` which points to `users` table
- JWT client respects RLS → team member queries return empty

**Solution:**

```typescript
// ❌ WRONG: JWT client blocked by RLS
const { data: teamMembers } = await supabase
  .from('users')
  .select('id, first_name, last_name, photo_url')
  .in('id', teamMemberIds);

// ✅ CORRECT: Service Role bypasses RLS
const { data: teamMembers } = await supabaseAdmin
  .from('users')
  .select('id, first_name, last_name, photo_url') // Only safe columns!
  .in('id', teamMemberIds);
```

**Security Note:** When using `supabaseAdmin` to fetch user data, explicitly select only public-safe columns. Never use `SELECT *`.

**Key Principle:**

> "Use JWT + RLS for data the user owns (their bookings, their reviews). Use Service Role for fetching related data from other tables (team member names, venue info). Always explicitly list safe columns."

---

### Review Section Conditional Rendering

**Problem:** Review section needs complex conditional logic based on multiple factors.

**Display Rules:**

1. Only show for `status === 'completed'` bookings
2. Only show if `teamMembers.length > 0` (need team member data)
3. Hide individual stylist after they're reviewed
4. Change header when all stylists reviewed

**Implementation:**

```typescript
// Check all conditions
const canReview = booking.status === 'completed';
const hasTeamMembers = uniqueTeamMembers.size > 0;
const unreviewedCount = teamMembers.filter((tm) => !hasReview(tm.id)).length;
const allReviewed = unreviewedCount === 0;

// Render nothing if can't review or no team members
if (!canReview || !hasTeamMembers) return null;
```

**Key Principle:**

> "For conditional UI sections, explicitly check all required data before rendering. Missing related data (like team members) should hide the section gracefully, not show broken UI."

---

## 🎯 Critical Decisions Summary

| Decision                  | Choice                            | Rationale                                       |
| ------------------------- | --------------------------------- | ----------------------------------------------- |
| **Data Access Pattern**   | Service Role (server-side)        | Simpler, more secure, easier to maintain        |
| **Authorization Pattern** | Supabase only (no Clerk metadata) | Single source of truth, instant updates         |
| **Role Storage**          | Supabase users.roles ONLY         | No JWT caching issues, instant changes          |
| **Client Data Access**    | Server-side with filtering        | Users access own data via filtered queries      |
| **RLS Policies**          | Disabled (except Products)        | Not needed with Service Role                    |
| **Timezone Handling**     | UTC-safe everywhere               | Prevents bugs in Melbourne (UTC+10/+11)         |
| **Date Storage**          | YYYY-MM-DD strings                | No timezone, consistent across systems          |
| **Service Types**         | Two-type system (service/bundle)  | Simplified from three types                     |
| **Service Groups**        | UI layer only                     | Clean separation from service data              |
| **Custom Pricing**        | NULL = default, value = override  | Flexible per-stylist rates                      |
| **Appointment Pricing**   | Snapshot at booking time          | Price stability, historical accuracy            |
| **Appointment Modal**     | Right-side slide-in               | Context preservation                            |
| **Appointment Details**   | Hover tooltip                     | Instant info, non-intrusive                     |
| **Calendar Positioning**  | 20px per 15-min slot              | Perfect grid alignment                          |
| **Time Tracking**         | JSONB breaks array                | Flexible, tracks multiple breaks                |
| **Pay Rates**             | Default + Custom (per member)     | System defaults with overrides                  |
| **Booking Holds**         | DELETE-based cleanup              | Simple, no status management                    |
| **Payment Recording**     | Transaction + line items          | Supports split payments & item refunds          |
| **Refund Tracking**       | Per-item with amounts             | Enables partial/product-only refunds            |
| **Review Granularity**    | Per-stylist (not per-venue)       | Better feedback for group bookings              |
| **Review Timing**         | After completion only             | Prevents fake reviews, ensures service received |
| **Team Member Fetching**  | supabaseAdmin (bypass RLS)        | Users table RLS blocks cross-user reads         |

---

## 📝 Database Migration Reference

### 011_reviews.sql

```sql
-- Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_group_id UUID NOT NULL REFERENCES booking_groups(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One review per stylist per booking
  UNIQUE (booking_group_id, team_member_id, client_id)
);

-- Indexes for common queries
CREATE INDEX idx_reviews_booking_group ON reviews(booking_group_id);
CREATE INDEX idx_reviews_client ON reviews(client_id);
CREATE INDEX idx_reviews_team_member ON reviews(team_member_id);
CREATE INDEX idx_reviews_venue ON reviews(venue_id);
CREATE INDEX idx_reviews_status ON reviews(status);
```

---

**Document Status:** Living document - update as architecture evolves  
**Next Review:** After Phase 7 (Email Notifications)  
**Architecture:** Clerk for Authentication, Supabase for Authorization (Finalized & Simplified)  
**Last Major Change:** Completed Phase 6.5 - Client Dashboard & Reviews (January 2025)
