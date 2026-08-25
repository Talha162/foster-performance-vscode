---
title: "Foster Performance"
subtitle: "Complete Application Analysis & Phase 2 Decision Document"
author: "Repository and emulator audit prepared for Foster Performance"
date: "25 August 2026"
lang: en-US
toc: true
toc-depth: 3
---

\newpage

# Document purpose

This document is the decision-grade baseline for the next phase of Foster Performance. It describes what is actually present in the current repository and running application: product scope, roles, navigation, screens, widgets, design system, state ownership, API surface, persistence, payment behavior, security controls, incomplete integrations, risks, and recommended Phase 2 sequencing.

The report deliberately separates four implementation states:

| Label | Meaning |
|---|---|
| **Implemented** | UI and supporting behavior exist and are connected to a durable server or deliberate local store. |
| **Frontend-complete** | The user experience exists, but production backend/infrastructure is intentionally pending. |
| **Test/local** | The flow works with mock data, test-mode payment behavior, static catalog data, or AsyncStorage. |
| **Gap/risk** | A dependency, inconsistency, or production-readiness problem must be addressed in Phase 2. |

This is not a marketing description. Claims are based on direct inspection of the current working tree, the Milestone 1 master prompt, a successful Android emulator run, TypeScript compilation, Android production export, and runtime-log review.

## Audit basis and measured scope

| Measure | Current result |
|---|---:|
| Repository files excluding dependencies and Git internals | 218 |
| Expo app TSX modules under `app/` | 62 |
| Navigation layout modules | 5 |
| Page/route modules | 57 |
| Shared component modules | 13 |
| Global context providers | 6 |
| App/component/context TS/TSX lines | approximately 22,618 |
| Express route files | 14 |
| Express API handlers | 84 |
| Database tables created/used by the server | 29 |
| Built-in workout programs | 25 |
| Built-in coaches | 8 |
| Built-in nutrition plans | 4 |
| Built-in rehabilitation programs | 4 |
| `Pressable` usages | 241 |
| `TextInput` usages | 46 |
| `ScrollView` usages | 67 |
| `FlatList` usages | 1 |
| Direct frontend `fetch` calls/context calls counted | 53 |

## Validation performed

- Ran the Expo SDK 54 app in Expo Go on the Android API 34 emulator `Karwan_QA_API34`.
- Visually reviewed authentication/onboarding, all five athlete tabs, workout library/detail, nutrition, progress, profile, subscription, coach marketplace, booking, messaging, coach representative states, admin representative states, and deliberate error/empty screens.
- Corrected Android clipping/overlap and missing error-state defects found during the pass.
- TypeScript strict compilation passed.
- Android production export passed (1,753 bundled modules, 49 assets, Hermes bundle generated).
- Runtime log scan found no React Native, Expo, or Android fatal errors during the reviewed flows.

# Executive product summary

Foster Performance is a dark-first, premium athletic performance application built around four connected product pillars:

1. **Training:** a catalog of structured fitness, strength, running, recovery, walking, and cross-training programs with workout detail, schedules, equipment, coach guidance, progress activation, workout completion logging, and muscle-target visualization.
2. **Nutrition and health:** nutrition onboarding, macro targets, food/water logs, recipes, grocery lists, progress tracking, and a locally calculated composite “FP Score.”
3. **Coaching marketplace:** coach discovery, profiles, prices, availability, in-app conversations, session booking, payment/test payment, confirmation, and a video-call preview.
4. **Two-sided operations:** coach application and coach dashboard tools plus an owner-admin portal for applications, members, coaches, bookings, revenue, and settings.

The visible product is significantly broader than a simple workout app. It is already shaped as a three-role marketplace platform:

- **Member/athlete** consumes programs, nutrition, progress, leaderboard, and coaching.
- **Coach applicant/coach** applies, manages availability/programs, sees clients/bookings/earnings, and messages members.
- **Owner admin** reviews applications and operates platform users, bookings, payments, and configuration.

The key Phase 2 challenge is not inventing product scope. It is converting the existing mixed prototype architecture into one coherent production data platform while preserving the polished frontend.

## Current maturity assessment

| Area | Maturity | Decision implication |
|---|---|---|
| Visual system and core navigation | Strong Milestone 1 frontend | Preserve; consolidate remaining duplicated styles gradually. |
| Workout catalog and visualization | Strong local/static product experience | Move catalog and user activity to versioned server models without degrading offline/perceived speed. |
| Authentication and roles | Substantial server implementation | Harden secrets, session storage, deployment configuration, email delivery, and route guards. |
| Nutrition | Broad server-backed implementation | Fix API-base inconsistency first; add robust client error contracts and tests. |
| Messaging | Durable polling/manual-refresh implementation | Add real-time delivery, pagination, notifications, moderation, and media policy. |
| Booking/payments | Test-mode capable; production intentionally blocked | Replace raw-card UI/server handling with Stripe PaymentSheet and webhook-led state. |
| Video sessions | Frontend preview only | Select RTC provider and build secure room/token lifecycle. |
| Coach operations | CRUD foundations exist | Add content/media publishing, payout onboarding, booking lifecycle, and permissions. |
| Admin operations | Useful operational shell | Add audit log, pagination, stronger error states, observability, and complete configuration ownership. |
| Database management | Functional but structurally risky | Replace runtime DDL with formal migrations and align Drizzle schema with all 29 tables. |
| Accessibility/test automation | Partial | Make a dedicated Phase 2 quality workstream. |

# System architecture

## Repository structure

```text
foster-performance-vscode/
├── artifacts/
│   ├── foster-performance/       Expo / React Native client
│   │   ├── app/                  Expo Router route tree (57 pages + 5 layouts)
│   │   ├── components/           13 shared visual/behavioral components
│   │   ├── context/              Auth, app catalog, nutrition, score, messaging, leaderboard
│   │   ├── constants/            Theme and shared design tokens
│   │   ├── assets/images/        App icon and hero banner
│   │   ├── hooks/                Dark palette accessor
│   │   ├── scripts/              Web/static build helper
│   │   └── server/               Static web serving/landing support
│   ├── api-server/               Express 5 API, Stripe integration, runtime schema setup
│   └── mockup-sandbox/           Separate Vite artifact; not part of the mobile runtime
├── lib/
│   ├── db/                       PostgreSQL pool + small Drizzle booking schema
│   ├── api-spec/                 OpenAPI document (currently health endpoint only)
│   ├── api-client-react/         Generated client (currently unused by app features)
│   └── api-zod/                  Generated validation/types (minimal coverage)
├── package.json                  pnpm monorepo scripts
└── pnpm-workspace.yaml           Workspace definition/catalog versions
```

## Runtime topology

```text
Expo mobile client
  ├─ Expo Router navigation
  ├─ React contexts
  │   ├─ AuthContext ───────────────┐
  │   ├─ NutritionContext ──────────┤
  │   ├─ MessagingContext ──────────┤ HTTPS/JSON + JWT
  │   ├─ LeaderboardContext ────────┤
  │   ├─ AppContext (mixed local/API)│
  │   └─ FPScoreContext (local)      │
  ├─ AsyncStorage                    │
  └─ Static workout/coach catalogs   │
                                      ▼
Express 5 API under /api
  ├─ JWT authentication and role middleware
  ├─ PostgreSQL via node-postgres/Drizzle
  ├─ Stripe/test-mode booking and subscriptions
  ├─ Resend-compatible email delivery
  └─ Runtime table creation and seed logic
                                      ▼
PostgreSQL (29 logical tables) + Stripe/Resend external services
```

## Client technology stack

- Expo SDK 54, React Native 0.81.5, React 19, Expo Router 6.
- TypeScript in strict mode; typed Expo routes and React Compiler experiment enabled.
- New React Native architecture enabled; application orientation locked to portrait; iPad/tablet support disabled.
- Inter 400/500/600/700 fonts loaded before hiding the splash screen.
- Expo vector icons, Expo Symbols, SVG, blur, linear gradients, haptics, image/image-picker, linking, location, and web browser modules.
- Safe-area, gesture-handler, keyboard-controller, screens, reanimated/worklets.
- TanStack Query provider exists, but current business features use custom contexts/direct `fetch`; generated API client is not used.
- AsyncStorage is the local persistence mechanism. JWT is also stored there.

## Server technology stack

- Express 5 API with CORS and Pino HTTP logging.
- PostgreSQL connection pool with Drizzle SQL/query utilities.
- bcrypt cost 12 password hashing; JWT with 30-day expiry and per-user token version.
- Stripe integration for booking/member subscription test flows and webhooks; live mode blocks raw card collection.
- Resend HTTP API for verification/reset email when configured.
- Database structures are mostly created idempotently at API startup rather than through a complete migration history.

# Navigation and role model

## Root routing decision

The root `app/index.tsx` validates the stored JWT through `AuthContext`, then redirects by `accountType`:

| Account state | Destination |
|---|---|
| No authenticated user | Welcome/auth stack |
| `owner_admin` | Admin portal |
| `coach` | Coach dashboard tabs |
| `coach_applicant` | Application status |
| Member, onboarding incomplete | Member onboarding |
| Member, onboarding complete | Athlete home tabs |

This is a client convenience, not the only authorization boundary. Server admin routes use `requireAdmin`; authenticated domain routes use `requireAuth`. However, Phase 2 should also add explicit client route-group guards to prevent authenticated users from deep-linking into inappropriate role screens and seeing partial/fallback data.

## Navigation groups

### Athlete tab group

Five visible tabs: Home, Workouts, Nutrition, Progress, Profile. A coaches route also exists inside the group but is hidden from the tab bar and reached through cards/deep links. iOS can use experimental native tabs when Liquid Glass is available; other platforms use classic tabs with Android/web dark surfaces and iOS blur.

### Coach tab group

Six visible tabs: Dashboard, Clients, Calendar, Programs, Earnings, Profile. Accent/gold is used for the coach-role visual identity.

### Admin group

Stack-based rather than tab-based because it contains seven operational sections. The dashboard presents navigation cards to Applications, Members, Coaches, Bookings, Payments, and Settings.

### Modal/card presentations

Subscription is presented as a modal; log-food is a modal; video-call is a non-dismissible full-screen modal; workout, nutrition plan, coach, booking, confirmations, security/settings, leaderboard, and application screens use card/stack presentation. Onboarding, coach application/status, confirmation, and video call selectively disable gestures to enforce flow completion.

# Visual system and interaction language

## Brand system

Foster Performance is intentionally dark-first. Although a light palette is defined, `useColors()` always returns the dark palette.

| Token | Current value/use |
|---|---|
| Background | `#05070B` deep black-blue |
| Card/surface | `#0D1117` |
| Secondary/muted | `#12151C` |
| Primary | `#2F80FF` electric blue |
| Accent | `#D6A84B` performance gold |
| Success | `#35C98A` green |
| Destructive | `#EF4444` red |
| Foreground | white |
| Muted foreground | `#9AA3B5` |
| Border/input | `#141720` |

Brand assets are limited and focused: a 374 KB app icon and a 114 KB welcome hero banner. The UI builds most visuals with gradients, icons, cards, and lightweight SVG rather than a large image library.

## Shared tokens

- Spacing rhythm: 4, 8, 12, 16, 20, 24, 32.
- Radii: 6, 8, 12, 16, 20, and pill.
- Typography: caption 11/15, body-small 13/18, body 15/21, label 14/18, title 20/26, hero 28/34.
- Controls: standard button/input height 52, compact button 44, touch target 44, icon sizes 16/20/24.
- Motion: 120 ms fast, 200 ms standard, 280 ms deliberate.

Token adoption is partial. New shared components use the system, but many screens retain local numeric styles. There are 164 numeric width declarations and 234 numeric height declarations across TSX. Many are legitimate icons/controls, but the quantity makes responsive/font-scale regression testing necessary.

## Interaction conventions

- Press feedback generally uses opacity/background state and Expo haptics.
- Selection is reinforced by border, fill, icon, and text changes rather than color alone in the strongest flows.
- Safe-area padding is applied explicitly on most top-level screens.
- Forms use keyboard-aware or keyboard-avoiding structures, suitable keyboard types, password visibility toggles, inline validation, and disabled/loading CTAs.
- Empty and error states use centered cards with icons, explanatory text, and retry/navigation actions.
- Only one long screen currently uses `FlatList` (messages); most catalog/admin screens use `ScrollView` maps.

# Shared widgets and reusable components

| Component | Responsibility | Important behavior / next-phase note |
|---|---|---|
| `AppButton` | Standard button primitive | Primary, secondary, accent, danger, and ghost variants; icon, loading, disabled, accessibility state. Newer than much of the screen code, so adoption is incomplete. |
| `BackgroundLayer` | Global branded backdrop | Combines the deep base background with `BackgroundTexture`. |
| `BackgroundTexture` | Lightweight visual texture | Full-screen SVG pattern; avoids raster scaling cost. |
| `CoachCard` | Coach marketplace card | Compact and expanded variants with avatar, type, rating, experience, pricing, premium marker, and press action. A separate standalone coach list card still exists, so consolidation remains possible. |
| `ErrorBoundary` | Root React error capture | Replaces crashed subtree with `ErrorFallback`; accepts optional error callback and reset. |
| `ErrorFallback` | Friendly crash UI | Shows branded error page, retry, optional expandable technical details, and a development-oriented diagnostic view. Production should suppress sensitive details. |
| `KeyboardAwareScrollViewCompat` | Cross-platform form scrolling | Uses keyboard-controller on native and a regular scroll view on web. |
| `NutritionCard` | Static nutrition-plan card | Premium/active status, macro bars, calories, goal and press behavior. This belongs to the older static plan system, separate from server nutrition. |
| `PremiumBanner` | Reusable upgrade CTA | Routes to subscription and explains premium value. |
| `ScreenState` | Loading/error/missing screen | Optional back action, icon, spinner, title/message, action label; used by dynamic detail screens. |
| `StatCard` | Metric summary tile | Icon, value, unit, label, configurable accent. |
| `TargetMuscleAvatar` / `TargetMuscleMap` | Workout body visualization | Memoized SVG front/back silhouettes, text-to-region mapping, highlighted muscles, accessible labels, compact per-exercise avatar and program map. |
| `WorkoutCard` | Workout catalog card | Program color identity, premium/active state, metadata and press behavior. The workouts tab also has a local `ProgramCard`, another consolidation candidate. |

## Target-muscle visualization in detail

The feature is code-native and lightweight. `resolveMuscleRegions()` normalizes the exercise `muscleGroup` string and maps synonyms to these semantic regions: chest, shoulders, arms, back, core, glutes, quadriceps, hamstrings, and calves. It handles combined strings such as “Quads / Glutes” and falls back to a sensible full-body set for cardio/full-body labels. `getPreferredBodyView()` chooses back view for posterior terms such as back, hamstring, glute, rear-delt and calf; program maps can show front and back views. The active region receives the program accent while inactive anatomy remains muted. This mapping is frontend-owned and should become stable catalog metadata in Phase 2 instead of relying solely on text parsing.

# Frontend state and data ownership

## Provider composition

The root provider order is:

`SafeAreaProvider → ErrorBoundary → QueryClientProvider → GestureHandlerRootView → KeyboardProvider → AuthProvider → AppProvider → NutritionProvider → LeaderboardProvider → MessagingProvider → FPScoreProvider → Router`

This makes authentication available to all domain contexts. The nesting is understandable but broad: updates in large contexts can affect many descendants. `AppContext` now memoizes its value and callbacks, but Phase 2 should profile context fan-out before adding more live data.

## AuthContext — server-backed identity

**Owned state:** user, JWT token, startup-loading flag.

**User model:** id, name, email, account type, member onboarding fields, application/email status, premium/subscription fields, Stripe identifiers, streak, workout count, and join date.

**Actions:** login, register, logout, fetch/update current user, upgrade/cancel local subscription state, transition member to coach applicant, forgot/reset password, send/verify email, sign out all devices, change password, and change email.

**Persistence:** JWT stored as `@foster_jwt` in AsyncStorage. Startup calls `/auth/me`; invalid/unreachable validation removes the token. This behavior is secure against stale tokens but treats temporary API failure as a sign-out.

**Phase 2 decision:** migrate token material to platform secure storage, centralize auth-aware HTTP behavior, distinguish offline/503 from invalid credentials, and add refresh/session policy if 30-day bearer tokens remain.

## AppContext — static catalog plus local activity

**Static data:** 25 workout programs, four legacy nutrition plans, four rehab programs, and eight Foster coaches.

**Local state:** weight/progress entries, workout completion logs, locally remembered bookings, active workout, and active legacy nutrition plan.

**AsyncStorage keys:** `@foster_progress`, `@foster_logs`, `@foster_active_workout`, `@foster_active_nutrition`, `@foster_bookings`.

**Defaults:** active workout `p7` (which does not correspond to the visible catalog IDs listed in the current array and therefore produces no active card until changed), active nutrition `np1`, and five demo weight entries dated June/July 2026. The unmatched default workout ID should be corrected or removed.

**Hybrid behavior:** booking creation is server-first from the booking screen then mirrored locally; cancellation calls the server only when `serverId` and cancellation token exist, otherwise cancels demo/offline bookings locally.

## NutritionContext — server nutrition domain

**Owned state:** nutrition profile, dashboard, recipes, saved-recipe IDs, grocery items/list ID, and three loading flags.

**Actions:** load dashboard/recipes/saved recipes/grocery list, save onboarding profile, log/delete food, log water, save/unsave recipe, create recipe grocery list, add/check/delete grocery item.

**Local persistence:** active grocery-list ID only, under `@fp_grocery_list_id`.

**Critical configuration inconsistency:** this context builds requests from `EXPO_PUBLIC_API_URL + /api`, while Auth/Messaging/direct screens primarily use `EXPO_PUBLIC_API_BASE` or `EXPO_PUBLIC_DOMAIN`. With no `EXPO_PUBLIC_API_URL`, native requests can resolve incorrectly. This caused the blank nutrition state during emulator testing and is a Phase 2 P0 configuration fix.

## FPScoreContext — local composite health score

Stores metric history, calculated score history, and weight configuration in `FP_HEALTH_METRICS`, `FP_SCORE_HISTORY`, and `FP_SCORE_CONFIG`. Default weights total 100:

| Metric | Weight |
|---|---:|
| Workout consistency | 30 |
| Sleep duration | 20 |
| Recovery score | 15 |
| Water intake | 10 |
| Cardio endurance | 10 |
| Strength progress | 5 |
| Mobility | 5 |
| Body-fat progress | 5 |

The score normalizes workout/recovery/fitness inputs, models ideal sleep as 7–9 hours, hydration up to 100 fl oz, and body-fat improvement relative to the oldest measurement. It is a client-side wellness estimate, not a clinical score. Phase 2 must define consent, units/localization, server ownership, formula versioning, explainability, and health-data privacy before cross-device sync.

## MessagingContext — server-backed conversations

Maintains conversation summaries and exposes create/open, list, message fetch/send, mark-read, refresh, and unread aggregation. Messages are durable in PostgreSQL. Refresh occurs on authentication/context mount and after mutations; there is no websocket, background polling, pagination, attachment upload, push notification, block/report, or moderation workflow.

Static coaches `c1`–`c8` deliberately cannot become message recipients because they have no authenticated coach account. Only API coaches linked to approved applications can participate. The UI must communicate that distinction consistently.

## LeaderboardContext — server-backed engagement

Owns profile/loading state and provides activity recording, global/league/friends rankings, friend requests, challenges, achievements, streak details/freeze, and privacy update. Server point types are workout, run/walk, nutrition goal, water goal, recovery, and check-in. The backend also supports admin point configuration/challenge creation/freeze grants, but there are no matching admin screens yet.

# Built-in content catalogs

## Workout programs

The local workout catalog contains program metadata, premium status, equipment, five-or-more exercises, coach tip, optional weekly schedule, and optional sport modules/drills.

| Category | Programs |
|---|---|
| Fitness (8) | Fat Loss Accelerator; Muscle Building Hypertrophy; Beginner Fitness Foundation; Home Workout Builder; Gym Strength & Conditioning; CrossFit Style Training; HIIT Shred Program; Functional Fitness |
| Strength (4) | Beginner Weightlifting; Powerlifting Peak Program; Olympic Weightlifting; Strength & Conditioning |
| Running/cardio (6) | Couch to 5K; 5K Race Ready; 10K Training Plan; Half Marathon Program; Marathon Training Plan; Sprint Speed Development |
| Recovery (5) | Daily Mobility Flow; Flexibility & Stretching; Foam Rolling & Myofascial Release; Injury Prevention Protocol; Active Recovery Program |
| Walking (1) | Power Walking for Fitness |
| Cross-training (1) | Cross-Training Challenge |

Programs are filterable by top-level training tab and subcategory. Premium programs route non-premium users to subscription. Starting a program sets the active ID locally; tapping completion logs a timestamp locally. There is no server-side program enrollment, day/week advancement, set-level tracking, exercise substitution, timer, or synchronized workout history yet.

## Static nutrition plans

The legacy `AppContext` system contains Endurance Performance Plan, Muscle Building Plan, Active Training Fuel, and Weight Loss Protocol, each with calorie/macronutrient targets and timed meals. These are displayed through `nutrition-plan/[id]` and `NutritionCard`, but the main nutrition tab now uses the newer server-backed NutritionContext. Phase 2 should either migrate these plans into the server nutrition model or retire the duplicate system.

## Rehabilitation programs

Lower Back Recovery, Shoulder Rehabilitation, Knee & ACL Recovery, and Hamstring & Hip Recovery are static, evidence-oriented cards with body part, duration, phases, and exercise previews. There is no progression tracking, clinician approval, contraindication screening, injury intake, or medical disclaimer workflow beyond a general banner. Production positioning requires legal/clinical review.

## Foster coaches

Eight local showcase coaches provide names, bios, credentials, specialties, ratings/reviews, experience, availability and fixed prices:

| Coach | Specialty/title | 30 / 60 min |
|---|---|---:|
| Marcus Reid | Head Strength & Conditioning | $75 / $140 |
| Sarah Chen | Sports Nutrition | $65 / $120 |
| Darius Coleman | Defensive Backs | $95 / $175 |
| Priya Sharma | Sports Rehabilitation | $70 / $130 |
| Jordan Blake | Speed & Explosiveness | $85 / $155 |
| DeShawn Williams | Linebacker & Edge Rush | $90 / $165 |
| Tony Hernandez | Quarterback Development | $100 / $185 |
| Kevin Park | Offensive Line | $80 / $145 |

The server duplicates these prices as an authoritative static price table, while approved application coaches use `api_N` IDs and JSON pricing from `coach_applications`. Phase 2 should converge both populations into one coach entity/source of truth.

# Complete screen and route inventory

The following tables cover every page/route module. Layout files are described in the navigation section; they are not user-facing screens.

## Entry, authentication, and onboarding

| Route | Screen and widgets | Data/behavior | Status and Phase 2 dependency |
|---|---|---|---|
| `/` | Startup loader/redirect | Validates JWT, routes by role/onboarding state. | Implemented. Add explicit route guards and offline session handling. |
| `+not-found` | Branded missing-page state | Icon, explanation, return-home action. | Frontend-complete. |
| `/(auth)/welcome` | Hero welcome | Hero banner, app icon, responsive two-line wordmark, feature pills, Create Account and Sign In CTAs. | Frontend-complete. |
| `/(auth)/login` | Sign-in form | Email/password, password visibility, forgot password, create account, coach entry, keyboard-aware scroll, inline API error/loading. | Server-backed. Add secure token storage, rate-limit telemetry, biometric/session options if desired. |
| `/(auth)/register` | Two-step registration | Choose member or coach applicant; name/email/password/confirmation; password strength and rules; terms/privacy acknowledgement; routes applicants into application flow. | Server-backed. Add formal consent versioning, anti-bot controls, analytics, legal links/version capture. |
| `/(auth)/forgot-password` | Email then reset-code flow | Neutral request response, six-character code entry, resend/retry, passes email/code to reset page. | Server-backed; email requires configured Resend. Add delivery monitoring and abuse controls. |
| `/(auth)/reset-password` | New-password flow | Strength meter, rule checklist, confirmation, success state and sign-in CTA. | Server-backed. |
| `/(auth)/verify-email` | Email verification | Sends/resends code, code entry, success state, “verify later.” | Server-backed; currently verification is not enforced as a universal feature gate. Decide policy in Phase 2. |
| `/onboarding` | Member training onboarding | Two animated steps: one of 14 goals, then Beginner/Intermediate/Advanced level; writes user profile and onboarding complete. | Server-backed profile update with optimistic local state. Goal should become stable enum/reference data. |
| `/nutrition-onboarding` | Nutrition setup wizard | Primary/secondary goals, dietary patterns, activity level, meal frequency, guided/detailed tracking, generated target summary. | Server-backed profile. Current calorie estimate uses a fixed 1,800 kcal BMR rather than age/sex/height/weight; replace with validated personalization and safety rules. |

## Athlete main tabs

| Route | Screen and widgets | Data/behavior | Status and Phase 2 dependency |
|---|---|---|---|
| `/(tabs)` | Athlete Home | Greeting/profile, premium CTA, branded hero, recommended and active program, workout stats, category navigation, nutrition card, become-coach CTA, leaderboard summary, coach discovery, recovery/feature cards. | Hybrid static/local/server. At ~1,308 lines it is the largest screen; break into domain sections and define one home-dashboard API. |
| `/(tabs)/workouts` | Training Library | Six category tabs, subcategory filter chips, program cards, premium/active badges, metadata, deliberate empty state. | Static catalog plus local active program. Move catalog/enrollment to API and virtualize if catalog grows. |
| `/(tabs)/nutrition` | Nutrition hub | Today/Recipes/Grocery tabs; calorie ring, macro bars, hydration, food groups, search/categories, saved recipes, grocery item management, onboarding and unavailable states. | Primarily server-backed. P0 API-base fix; add per-operation errors, optimistic rollback, pagination and offline policy. |
| `/(tabs)/progress` | Progress dashboard | FP Score entry card, three summary stats, six-entry weight chart, history, bottom-sheet weight/notes logger. | Progress is local AsyncStorage; FP Score is local. Define server health-data model, units and privacy. |
| `/(tabs)/profile` | Member profile/settings | Identity, PRO/coach badges, stats, subscription card, upcoming-session cancellation, become-coach, coach carousel, messages/edit/billing/subscription/notification/privacy/security actions, sign out. | Hybrid. Consolidate into profile/settings APIs; protect sensitive actions and add full booking-state refresh. |
| `/(tabs)/coaches` | Hidden-tab dynamic coach marketplace | Loads approved API coaches, merges them with eight local Foster coaches, filters by type, separates “verified” and “Foster” groups, loading/empty states. | Hybrid dual source. Consolidate coach model and clarify which coaches can be booked/messaged. |

## Training, recovery, health, and engagement detail screens

| Route | Screen and widgets | Data/behavior | Status and Phase 2 dependency |
|---|---|---|---|
| `/workout/[id]` | Program detail | Hero, premium/type badges, metadata, target-muscle map, modules/drills, exercises with per-exercise muscle avatar, weekly schedule, equipment, coach tip, level explanation, sticky start/complete/unlock CTA. | Strong local implementation. Add server enrollment/session/workout events, day progression, sets/reps logging, timers, substitutions and exercise media. |
| `/nutrition-plan/[id]` | Legacy plan detail | Macro targets, meal schedule, active/premium state and activation/unlock actions. | Static/local legacy system; merge into server nutrition or retire. |
| `/nutrition-recipe/[id]` | Recipe detail | Fetches recipe, save/add groceries/log meal, nutrition facts, ingredients, instructions, storage/reheat/equipment, loading/missing states. | Server-backed. Add image/media strategy, portion scaling, allergen validation and operation-level errors. |
| `/log-food` | Food logging modal | Meal category, food/brand, serving, calories, protein/carbs/fat/fiber, notes, validation and save. | Server-backed. No barcode/food database/search; define external nutrition data provider and data licensing. |
| `/rehab` | Injury Rehab | Safety banner and four expandable/static protocol cards with exercise preview. | Static informational UI. Requires clinical/legal review, screening, disclaimers and prescribed progression before production claims. |
| `/fp-score` | FP Score detail | Score arc, status/trend, explanation, weighted breakdown, history chart, latest metrics, comprehensive metric-entry bottom sheet. | Local calculation. Requires formula governance, medical disclaimer, data synchronization and privacy design. |
| `/leaderboard` | Social competition | Global/League/Friends/Challenges tabs, time filters, rank zones, self summary, friend invite/accept, featured challenge joining, empty/loading states. | Server-backed. Add moderation/privacy UI completion, pagination, anti-cheat/event integrity and notification integration. |

## Coaching marketplace, messaging, booking, and video

| Route | Screen and widgets | Data/behavior | Status and Phase 2 dependency |
|---|---|---|---|
| `/coaches` | Standalone coach marketplace | Type filters, coaching banner, detailed cards with rating/clients/experience/prices/availability. Uses local coaches only. | Static duplicate of hidden athlete coaches tab. Consolidate to one marketplace component/route. |
| `/coach/[id]` | Coach profile | Supports local or `api_N` coach, hero/avatar/stats/availability, bio, credentials, specialties, prices, reviews, sticky booking/message/unlock actions. | Hybrid. API profiles have normalized fallbacks; reviews/static content need canonical models. |
| `/messages` | Conversation inbox | Role-aware title, unread badges, last message/time, empty card and coach CTA, pull-to-refresh `FlatList`. | Server-backed. Add realtime updates, pagination, search/archive/block/report. Empty CTA currently calls back rather than guaranteeing coach marketplace navigation in every entry context; normalize it. |
| `/message-thread` | Conversation | Participant header, loading/error/retry, date separators, role-aware bubbles, read marking, composer/send state, keyboard handling. | Server-backed. Add pagination, realtime, delivery/read receipts, attachments, moderation and abuse controls. |
| `/book-session` | Booking and card form | Resolves local/API coach, session duration, next available dates, time slots, cardholder/PAN/expiry/CVV validation, order summary, secure note, fixed bottom pay CTA. | Test-mode booking works. Raw card collection is intentionally prohibited in live mode; replace entirely with Stripe PaymentSheet/SetupIntent and do not transmit PAN/CVC through app API. |
| `/session-confirmation` | Booking success | Booking/payment summary, reference, email status, join video, add-to-calendar, done, cancellation note. | Frontend-complete. “Add to Calendar” needs actual calendar permission/event integration. Join call needs secure room authorization and time window. |
| `/video-call` | Video session preview | Call timer/status, coach/self placeholders, notes, microphone/camera/speaker/end controls; chat and screen share show coming-soon alerts. | Frontend preview only—no RTC media. Select provider (for example Daily/Twilio/Agora/WebRTC), implement tokens, rooms, permissions, reconnect, safety and session lifecycle. |

## Subscription and billing

| Route | Screen and widgets | Data/behavior | Status and Phase 2 dependency |
|---|---|---|---|
| `/subscription` | Premium plans | Foster Pro vs Private Coaching tabs, annual/monthly choice, savings, benefit list, pricing guide, sticky CTA; active subscribers see Pro state. | Frontend-complete with test checkout. Product/price/legal copy needs final approval and remote configuration. |
| `/subscription-checkout` | Member checkout | Test-mode badge, order summary, cardholder/PAN/expiry/CVV form, validation, subscription API, local user update. | Test mode only. Replace with native Stripe SDK, App Store/Play billing decision where applicable, webhook truth and entitlement service. |
| `/billing-settings` | Member billing | Status card, plan/renewal details, included features, upgrade/reactivate and cancellation danger zone, test note. | Hybrid server/local user state. Add invoices, payment methods, proration, failed-payment recovery, store compliance and webhook-led refresh. |

## Coach application and activation

| Route | Screen and widgets | Data/behavior | Status and Phase 2 dependency |
|---|---|---|---|
| `/become-coach-intro` | Coach recruitment | Benefits, how it works, requirements, commission note, start application CTA. | Frontend-complete. Business/legal claims must align with final pricing and marketplace policy. |
| `/coach-application` | Multi-section application form | Identity/contact/photo URL, professional title/bio/experience/certifications, specialties/services, 30/60/90-minute prices, weekly availability, virtual/in-person/location, web/social links, terms, submit/update. | Server-backed. Add schema-based validation, draft autosave feedback, upload linkage, background checks/credential verification, policy consent version. |
| `/credential-upload` | Credential metadata manager | Credential type/name, local list, upload placeholder action, remove, tips; persisted under `@coach_credentials`. | Test/local metadata only. Implement secure object storage, malware scan, file limits, signed upload, admin review and retention policy. |
| `/coach-application-status` | Applicant status | Loads own application, status-specific icon/copy, submitted date, admin notes, edit/resubmit where allowed, logout; approved users redirect to coach tabs. | Server-backed. Add status notifications and complete resubmission/audit history. |
| `/coach-subscription` | Coach platform plan | Monthly $29.99 or annual $249.99, included features, $0 test total, explicit test activation. | Mock/test only. Decide whether coach SaaS fee is retained, then implement compliant billing and entitlement. |
| `/coach-billing-settings` | Coach subscription settings | Status, plan, included features, billing details, subscribe/cancel. | Server-backed status with mock subscription IDs; production billing pending. |
| `/payout-settings` | Coach payout onboarding shell | Stripe Connect explanation, test banner, connect action alert, payout schedule and support. | Frontend only. Implement Stripe Connect onboarding, capabilities/KYC, payout accounts, tax, country support, webhook state and support escalation. |

## Coach dashboard tabs

| Route | Screen and widgets | Data/behavior | Status and Phase 2 dependency |
|---|---|---|---|
| `/(coach-tabs)` | Coach dashboard | Greeting/role badge, booking-derived stats, quick actions, recent sessions. | Server-backed bookings. Add date-based KPIs, reliable refresh, error state and session actions. |
| `/(coach-tabs)/clients` | Client roster | Unique clients derived from bookings, avatar/name/email/status, loading/empty. | Server-derived but not a true coach-client relationship model. Add assignments, consent, notes, plans and access control. |
| `/(coach-tabs)/calendar` | Availability manager | Default 30/60-minute session, weekdays, time blocks, save feedback, empty-time state. | Server-backed JSON availability. Add timezone, exceptions, date overrides, conflicts, lead/buffer/cancellation windows and calendar sync. |
| `/(coach-tabs)/programs` | Program manager | Draft/published filtering, create modal, title/description/category/price, publish/unpublish, delete; content-upload coming-soon card. | Server CRUD exists. Add workouts/modules/media, versioning, preview, entitlement/access, purchases, moderation and analytics. |
| `/(coach-tabs)/earnings` | Earnings | Gross, fixed 10% fee, net, session/average stats, payout settings, recent transactions. | Derived from booking data, not a settlement ledger. Build immutable ledger, refunds/disputes/tax/payout reconciliation. |
| `/(coach-tabs)/profile` | Coach account settings | Avatar, name/email, save display name, application status, payout, billing, sign out. | Partly server-backed. Add public profile editing, media, specialties, prices and availability ownership in one model. |

## Owner-admin portal

| Route | Screen and widgets | Data/behavior | Status and Phase 2 dependency |
|---|---|---|---|
| `/(admin-tabs)` | Admin dashboard | Owner badge, member/coach/applicant/booking/revenue stats, six navigation cards, security note, sign out. | Server-backed. Add refresh/error state, permission/audit telemetry and operational alerts. |
| `/(admin-tabs)/applications` | Application review | Status filters, application list, review bottom sheet, professional summary, new status and admin notes. | Server-backed. Add full credentials/doc viewer, reviewer identity, audit history, reasons/templates and notification dispatch. |
| `/(admin-tabs)/members` | Member administration | Count/search, deliberate load error and retry, empty state, detail modal, subscription/account facts, suspend/restore confirmation. | Server-backed. Add pagination, advanced filters, audit reason, export/privacy requests and activity details. |
| `/(admin-tabs)/coaches` | Coach administration | Approved coach list, application entry, suspend/demote action, loading/empty. | Server-backed. Add profile quality, credential state, payouts, disputes, bookings and audit trail. |
| `/(admin-tabs)/bookings` | Booking operations | Status filters and booking cards with coach/client/date/duration/price/status. | Server-backed read-only. Add search, pagination, refund/cancel/dispute actions with permission and audit safeguards. |
| `/(admin-tabs)/payments` | Revenue overview | Gross platform revenue, fixed 10/90 split, paid/refunded/session stats, transactions. | Derived view only. Replace with ledger/payment provider reconciliation and currency-aware reporting. |
| `/(admin-tabs)/settings` | Platform configuration | Commission/fees/limits inputs, save state, owner-security and test-mode notes. | Server-backed key/value settings. Add validation, typed schema, authorization scopes, change audit and staged rollout. |

## Profile, security, preferences, and policy

| Route | Screen and widgets | Data/behavior | Status and Phase 2 dependency |
|---|---|---|---|
| `/profile-edit` | Edit member profile | Display name editor, read-only email, email-security hint, validation/save. | Server-backed. Extend to avatar, units, locale/timezone, accessibility and privacy settings as approved. |
| `/change-password` | Password security | Current/new/confirm, visibility, strength, requirements, mismatch/API error, success. | Server-backed. |
| `/notifications` | Notification preferences | Workout reminders, nutrition reminders, coach messages, session reminders/news toggles and infrastructure note. | Local component state only; not persisted. Requires user preference API and push infrastructure. |
| `/privacy-policy` | In-app policy | Structured sections for collected data, use, sharing, security, rights, retention, children and contact; last-updated line. | Draft UI/content. Must be lawyer-approved, versioned, linked to consent records and actual data practices. |

# API surface and backend behavior

The API is mounted at `/api`. Most domain routes use bearer JWT authorization. The table below groups all 84 Express handlers rather than repeating internal implementation code.

| Domain | Endpoints | Behavior and observations |
|---|---|---|
| Health | `GET /healthz` | Basic service status; this is the only endpoint described in the OpenAPI file/generated client. |
| Authentication (11) | register, login, get/patch me, become-coach, forgot/reset password, send/verify email, logout-all, change-password, change-email | bcrypt password storage, role-aware JWTs, password strength, login lockout, token version invalidation, verification/reset email. |
| Coach applications (3) | get own, create, patch own | Stores the multi-section form, status and submission lifecycle. |
| Public coaches (2) | list, detail | Returns approved, unsuspended application coaches normalized for marketplace use. |
| Coach availability (2) | get/patch own availability | JSON-backed days/time blocks/session duration. |
| Coach programs (4) | create/list/patch/delete | Authenticated coach-owned program metadata CRUD. |
| Coach subscriptions (3) | create/status/cancel | Explicit test-mode/mock activation with future Stripe path. |
| Bookings (3) | list, create, cancel | Role-sensitive list; authoritative server pricing; availability/suspension checks; Stripe/test payment; cancellation token and refund policy. |
| Member subscriptions (3) | create/cancel/status | Test/raw-card Stripe path or mock fallback; live-mode raw-card use rejected. |
| Messaging (5) | create/list conversations, get/post messages, mark read | Participant authorization and durable conversation/message tables. |
| Nutrition (17) | profile get/put; recipes list/detail/save/unsave/saved; food logs list/create/delete; water list/create; dashboard; grocery lists/items CRUD | Broad nutrition backend and seeded recipe library. |
| Leaderboard (18) | activity, profile, global/league/friends, friend create/accept, challenges/list/join, streak/freeze, privacy get/put, achievements, admin point config/challenge/freeze grant | Points, streaks, leagues, privacy, social graph and challenges. |
| Admin (10) | applications list/detail/update; users list/suspend/role; stats; bookings; settings get/update | All routes protected by `requireAdmin`; role cannot be set to owner-admin through API. |
| Stripe webhook | `POST /api/stripe/webhook` | Raw body and signature verification before JSON middleware. |

## Authentication and authorization controls already present

- Passwords use bcrypt with cost 12.
- Password policy requires at least eight characters, uppercase, lowercase, number, and special character.
- JWTs expire after 30 days and include user ID, role, email, and token version.
- Every authenticated request checks the current database account for suspension and token-version invalidation; database failure fails closed with 503.
- Failed logins are counted; repeated failure locks the account for 15 minutes. A process-level IP limiter is also present, but it will not coordinate across multiple server instances.
- Forgot-password responses are neutral to reduce account enumeration; reset codes are hashed, time-limited, and single-use.
- Owner-admin effective role is assigned only when the email matches `OWNER_ADMIN_EMAIL`; public role updates exclude owner-admin.
- Admin routes apply `requireAdmin` globally.
- Booking prices are derived on the server, not trusted from the client.
- Booking cancellation uses a high-entropy per-booking bearer token and applies refund rules server-side.
- Stripe webhook verification occurs before body parsing, and live mode blocks raw PAN/CVC booking requests before JSON parsing.

## Security and production gaps

1. **JWT secret fallback:** if neither `JWT_SECRET` nor `SESSION_SECRET` is set, the server uses a known development string. Production startup must fail when a strong secret is absent.
2. **JWT storage:** AsyncStorage is not secure credential storage. Move bearer tokens to Keychain/Keystore through Expo SecureStore or equivalent.
3. **CORS and HTTP hardening:** CORS is unrestricted and no Helmet/security-header layer is visible. Define environment-specific allowed origins, request limits, and proxy trust.
4. **Distributed rate limiting:** process-memory limiting/lockout is insufficient for horizontally scaled production. Use centralized rate limiting and abuse telemetry for auth, messaging, friends, booking and payment endpoints.
5. **Raw card fields:** test-only forms still normalize users to entering PAN/CVC into the app. Production must use Stripe’s native, PCI-scoped UI and tokenization. Remove server raw-card branches after migration.
6. **Error/log policy:** Pino request logging is useful, but implement redaction, correlation IDs, error aggregation, retention, and privacy review. Never log credentials, payment data, reset codes, message bodies, or health detail.
7. **Route guard consistency:** some public subscription endpoints are not authenticated and accept user identifiers in body. Make entitlement and cancellation identity server-derived from authenticated principal wherever possible.
8. **Validation:** many routes validate manually and accept `any`/JSON text. Introduce shared request/response schemas and database constraints.
9. **Privacy/security operations:** no visible account deletion, data export, consent-version ledger, audit log, moderation/reporting, or incident-response hooks.

# Database model

## Current logical tables

| Area | Tables |
|---|---|
| Identity/security | `users`, `password_reset_tokens` |
| Coaches/marketplace | `coach_applications`, `coach_programs`, `platform_settings` |
| Commerce | `bookings`, `member_subscriptions` |
| Messaging | `conversations`, `messages` |
| Nutrition | `nutrition_profiles`, `recipes`, `saved_recipes`, `food_logs`, `water_logs`, `grocery_lists`, `grocery_items` |
| Leaderboard/social | `streaks`, `streak_history`, `fp_points`, `point_transactions`, `leagues`, `league_memberships`, `friendships`, `leaderboard_privacy`, `challenges`, `challenge_members`, `achievements`, `user_achievements`, `streak_freezes` |

## Important model characteristics

- `users` carries identity, account type, onboarding, premium/subscription mirror, suspension, verification, login lock, token version, and basic stats.
- `coach_applications` doubles as application record and public coach marketplace profile/availability/pricing store. Many structured values are JSON serialized into text fields.
- `bookings` stores coach display snapshot, duration/price/date/time/status, athlete identity, Stripe payment state, room URL, cancellation token and timestamps.
- `member_subscriptions` stores Stripe customer/subscription, plan/status and current period end, while related fields are also mirrored onto `users`.
- Messaging identifies approved coaches by application-derived `api_N` IDs rather than a first-class coach profile ID.
- Nutrition uses more normalized domain tables, though ingredients/instructions/tags are JSON text.
- Leaderboard uses immutable-ish point transactions plus aggregates, streak history, league membership, friendships/privacy, challenges and achievements.

## Database architecture risk

Only `bookings` is represented in the checked-in Drizzle schema. The API startup file creates and alters the other tables with raw `CREATE TABLE IF NOT EXISTS`/`ALTER TABLE` statements and seeds data. This provides easy Replit bootstrapping but is not sufficient production migration governance:

- No authoritative versioned migration chain for all tables.
- Runtime startup can partially succeed and log many schema failures as non-fatal.
- Application code, database reality, and TypeScript models can drift.
- Rollback, review, staging promotion, backfill and zero-downtime evolution are difficult.

Phase 2 should establish a full schema definition, migrations, constraints/index review, seed separation, backups and recovery drills before expanding features.

# Payments, subscriptions, payouts, and bookings

## Member subscriptions

The UI offers $9.99 monthly or $79.99 annual Foster Pro with a seven-day trial claim. The server can create/reuse Stripe prices and subscriptions in test mode or return mock Stripe-like IDs when Stripe is unavailable. Billing state is then mirrored onto the user. Production must decide mobile-store compliance: digital content subscriptions in native apps may require Apple/Google in-app purchase rather than external card checkout, depending on distribution and entitlement design.

## Session booking

The UI supports 30/60-minute pricing, availability dates/times, test card entry, order summary and confirmation. The server validates authenticated member, coach state, server price, time availability, idempotency/payment intent and booking persistence. Cancellation distinguishes full/partial refund based on timing.

Production requirements include Stripe PaymentSheet, PaymentIntent created server-side, booking slot reservation/locking, timezone-safe timestamps, duplicate/concurrency prevention, webhook reconciliation, cancellation/no-show/reschedule policies, receipts, tax/currency, disputes, and support tooling.

## Coach payouts

Current earnings are computed as gross booking value minus a fixed 10% fee. No settlement ledger or payout account exists. The payout screen is explanatory test UI. Production needs Stripe Connect account onboarding, capability/KYC status, transfer strategy, application fees, refund/dispute allocation, payout timing, negative balances, tax reporting, currencies, country eligibility and an auditable ledger.

# Quality, maintainability, performance, and accessibility

## Strengths

- Strict TypeScript and successful Android production bundling.
- Clear file-based routes and understandable role separation.
- Consistent dark brand, typography and iconography.
- Safe areas, keyboard tooling, loading/empty/error patterns and press feedback are broadly present.
- Error boundary protects the root experience.
- Lightweight SVG muscle feature is memoized and accessible.
- Server applies several unusually good prototype security controls: price authority, suspension checks, token versioning, password lockout, neutral reset response and admin middleware.
- `AppContext` value/callbacks are memoized and message list uses `FlatList`.

## Maintainability risks

- `app/(tabs)/index.tsx` is ~1,308 lines; `AppContext` ~1,101; workout detail ~842; nutrition tab ~747; booking ~723. Split along domain/component boundaries before Phase 2 adds complexity.
- Static catalogs and presentation are tightly coupled to a 1,100-line context.
- Duplicate coach marketplace/card systems and duplicate static/server nutrition systems exist.
- API-base construction is repeated and inconsistent.
- Business models use many `any` values and manual response normalization.
- OpenAPI describes only health while 83 additional handlers exist; the generated client and TanStack Query provider are effectively unused.
- Subscription truth is duplicated across `users`, `member_subscriptions`, AuthContext local state and Stripe.
- Runtime schema creation is the largest backend maintainability risk.

## Performance risks

- 67 `ScrollView` usages and only one `FlatList` mean growing workout, recipe, member, coach, booking, transaction and leaderboard lists will render all rows at once.
- Context-level refreshes and direct fetches lack standardized request deduplication/caching despite TanStack Query being installed.
- Home is a large component tree with many inline sections and animations.
- Static catalogs ship in the JavaScript bundle. Current bundle size is acceptable, but adding content will not scale.
- Messages have no pagination; leaderboard lists and recipes can grow without explicit paging contracts.

## Accessibility status

The implementation includes accessible labels/roles on key shared/icon controls, text hierarchy, visible selected/disabled states, 44 px token targets, and non-color cues in several flows. However, only 12 explicit accessibility labels and 10 roles were found against 241 pressable elements. Text controls with visible labels may already be announced adequately, but icon-only buttons, complex cards, charts, modal focus and tab semantics need systematic testing.

Phase 2 accessibility acceptance should include TalkBack and VoiceOver, logical focus/order, modal focus trapping/return, dynamic type at 200%, contrast, reduced motion, keyboard/switch access where relevant, chart summaries, form error announcement, and a WCAG 2.2 AA-oriented checklist.

## Testing gap

No focused unit/component/end-to-end test suite is visible for the mobile product or API domains. Current confidence comes from typecheck, production bundle and manual emulator inspection. Phase 2 should add:

- Unit tests for score calculation, muscle mapping, date/price/refund logic, validators and normalizers.
- API integration tests for role authorization, auth lifecycle, bookings/idempotency/refunds, subscriptions/webhooks, messaging participants, nutrition ownership and admin operations.
- Component tests for loading/empty/error/forms.
- Maestro/Detox E2E journeys for each role.
- Visual regression at small/normal/large Android and iPhone dimensions and increased font scale.

# Confirmed current issues and inconsistencies

These are not speculative feature ideas; they are facts that should influence the next phase.

| Priority | Finding | Impact |
|---|---|---|
| P0 | Nutrition uses a different environment variable/API-base algorithm from the rest of the app. | Native nutrition can silently fail even while authentication works. |
| P0 | Production payment UX is not implemented; raw card flows are test-only and blocked in live mode. | Booking/subscription revenue cannot launch safely. |
| P0 | Most database schema is runtime DDL, not managed migrations/Drizzle definitions. | High drift/deployment/recovery risk. |
| P0 | JWT has a known development-secret fallback. | Misconfigured production deployment would be critically insecure. |
| P1 | JWT stored in AsyncStorage. | Credential extraction risk on compromised/rooted devices and backups. |
| P1 | Static and API coach populations use different identities/capabilities. | Some coaches are display/bookable test entities but cannot be messaged/authenticated. |
| P1 | Default active workout ID `p7` does not exist in the current program catalog. | Fresh installs do not show a matching active workout despite default state. |
| P1 | Legacy static nutrition plans coexist with the server nutrition platform. | Conflicting source of truth and UX/product maintenance duplication. |
| P1 | Subscription state is duplicated in several layers. | Entitlement drift and incorrect premium access are likely under webhook/payment failure. |
| P1 | Notifications toggles are not persisted and no push infrastructure exists. | Preferences appear functional but reset and cannot deliver. |
| P1 | Video call is a preview; calendar action is not a native event integration. | Booked-session fulfillment is incomplete. |
| P1 | FP Score/weight and workout history are local-only. | Data is lost on device change and cannot reliably drive server leaderboard/profile stats. |
| P1 | Admin and coach operational lists lack pagination and many lack explicit errors. | Scale and support reliability risk. |
| P2 | Only health is in OpenAPI; generated client and Query provider are unused. | Type drift and duplicated networking. |
| P2 | Large screens/contexts and duplicate cards/routes. | Slower feature delivery and regression risk. |
| P2 | Accessibility coverage is partial and not automated. | Usability/compliance risk. |
| P2 | Orientation is portrait and tablet disabled. | This is an intentional current product constraint, not full responsive platform coverage. |

# Phase 2 recommended architecture

## Guiding decisions

1. **One API client and one environment contract.** Create a single `apiConfig` and authenticated client; no screen constructs domains. Adopt generated types or a fully described OpenAPI/tRPC equivalent.
2. **Server is truth for identity, entitlements, catalog, bookings, health sync, messages, and money.** AsyncStorage remains cache/draft/offline support, never entitlement/payment authority.
3. **One first-class coach model.** Approved applicant becomes a coach profile with stable ID; showcase coaches must be seeded real profiles or clearly marked demos.
4. **One nutrition product.** Migrate static plans to server data or remove them. Do not maintain parallel engines.
5. **Webhook-led commerce.** Stripe/store events update subscription/payment/booking ledger idempotently; clients read status.
6. **Versioned migrations and schemas.** Every table, constraint and index lives in source-controlled migrations; runtime DDL is removed after migration.
7. **Domain queries rather than global fetch sprawl.** Use TanStack Query (already installed) for server cache/dedup/retry/invalidation; keep contexts for identity or truly cross-cutting UI state.
8. **Observable and testable operations.** Structured errors, correlation IDs, audit trails, metrics, tracing, crash reporting, E2E tests and deployment checks.

## Recommended target domains

| Domain | Primary entities |
|---|---|
| Identity | User, Session, Role, Verification, Consent, Device |
| Training | Program, ProgramVersion, Week/Day, Exercise, MuscleRegion, Enrollment, WorkoutSession, SetLog |
| Nutrition | NutritionProfile, TargetVersion, Plan, Recipe, FoodLog, WaterLog, GroceryList |
| Health/score | Measurement, UnitPreference, ScoreFormulaVersion, ScoreResult, Consent |
| Coach marketplace | CoachProfile, Credential, Specialty, Service, Price, AvailabilityRule, AvailabilityException, Review |
| Scheduling | Booking, SlotHold, Session, Cancellation, Reschedule, CalendarEvent |
| Commerce | Customer, Entitlement, Subscription, Payment, Refund, LedgerEntry, PayoutAccount, Transfer |
| Communication | Conversation, Participant, Message, Attachment, ReadReceipt, NotificationPreference, DeviceToken |
| Engagement | ActivityEvent, PointsTransaction, Streak, League, Friendship, Challenge, Achievement |
| Operations | AdminAction, AuditLog, PlatformSettingVersion, SupportCase, ModerationReport |

# Phase 2 delivery plan

## Phase 2A — foundation and production safety (must happen first)

1. Centralize API/environment configuration and remove the nutrition URL mismatch.
2. Define complete OpenAPI/shared schemas for all handlers; generate typed client and error model.
3. Move JWT to secure storage; fail production startup without secrets; configure restricted CORS, headers, payload limits and distributed rate limits.
4. Convert all 29 tables to formal schema/migrations; add indexes, foreign keys, status constraints, timestamps, backups and staging migration checks.
5. Add route-group guards, centralized 401/403/offline behavior, and server-health/degraded-state UX.
6. Establish CI: lint/typecheck/unit/integration/build, secret scan, dependency audit and migration validation.
7. Add crash/error monitoring and privacy-safe structured logging with correlation IDs.

**Exit criteria:** a clean environment can be provisioned only from migrations; mobile staging builds use one API URL; invalid secrets fail deployment; auth and role tests pass; no test card data reaches the app server in production mode.

## Phase 2B — canonical training, profile, and content data

1. Create canonical workout/exercise/muscle schema and import the 25 built-in programs.
2. Create enrollment/session/set logging and synchronize progress/workout counts.
3. Resolve invalid default active workout and support offline read cache/draft logs with sync conflict rules.
4. Consolidate coach entities/cards/routes; seed showcase profiles or remove demo-only booking/messaging ambiguity.
5. Consolidate static nutrition plans with server nutrition.
6. Split home, workout detail, AppContext and nutrition into maintainable components/domain hooks.

**Exit criteria:** all displayed catalog/profile data has stable server IDs; program activation/completion survives devices; static/API duplicate experiences are removed; muscle regions are explicit metadata.

## Phase 2C — production booking, payments, and subscriptions

1. Integrate Stripe PaymentSheet for coaching; use server PaymentIntents and slot holds.
2. Decide Apple/Google billing strategy for digital Pro subscriptions and implement compliant entitlements.
3. Make webhook events the authoritative status; implement idempotency, reconciliation and failure recovery.
4. Build timezone-safe availability/exceptions, reschedule/no-show/cancel workflows and calendar integration.
5. Add invoices/receipts, payment methods, refunds/disputes, currency/tax and admin support actions.
6. Implement Stripe Connect onboarding, ledger and payouts.

**Exit criteria:** production test matrix covers successful/failed/3DS payments, concurrency, duplicate events, refund windows, chargebacks and entitlement recovery; admin/coach/member see consistent status.

## Phase 2D — communication and live session fulfillment

1. Add websocket/realtime message delivery, pagination, read/delivery states and push notifications.
2. Persist notification preferences and device tokens with consent/platform permission state.
3. Add message block/report/moderation and attachment security if attachments are approved.
4. Select RTC provider and implement secure room tokens, time-window entry, permissions, reconnect, quality state and call lifecycle.
5. Link booking reminders, calendar events, room creation and completion.

**Exit criteria:** two devices can message in real time; notifications honor preferences; booked users join only their valid session; reconnect/end/report flows are tested.

## Phase 2E — nutrition, health, engagement, and operations hardening

1. Replace fixed-BMR nutrition estimate with approved user-input/formula workflow and units.
2. Sync food/water/progress/FP Score data with consent and formula versioning.
3. Define health/rehab claims and legal/clinical boundaries.
4. Add leaderboard event integrity, privacy UI, pagination, anti-abuse and admin controls.
5. Add admin audit log, operational filters/pagination/export, support/dispute tools and typed settings.
6. Complete accessibility, localization/timezone/units, performance and visual regression work.

# Definition of Phase 2 done

Phase 2 should not be considered complete merely because endpoints exist. A production-ready outcome should meet all of the following:

- One documented, typed, versioned API contract is used by the mobile client.
- Database provisioning and upgrades occur through reviewed migrations with backup/rollback procedures.
- Secrets, JWT storage, CORS, rate limiting, logging and admin authorization pass a security review.
- Static/demo/test behavior is impossible to confuse with live customer/payment behavior.
- Coach, workout, nutrition, entitlement and booking identities each have one source of truth.
- Stripe/store payments and payouts are tokenized, webhook-led, idempotent and reconciled.
- Timezones, concurrency, cancellation, refunds, rescheduling and no-shows are explicitly modeled.
- Messaging and session delivery work across devices with notifications and participant authorization.
- User-generated/health/payment data has consent, export, deletion and retention policies.
- Critical role journeys have automated API and E2E coverage.
- All major lists are paginated/virtualized and all async views have loading, empty and actionable error states.
- TalkBack/VoiceOver and 200% text-size tests pass for critical flows.
- Crash/error monitoring, audit events and production support runbooks exist.

# Final assessment

Milestone 1 has produced a credible, polished frontend with unusually broad product coverage. The application successfully communicates its training, nutrition, performance, marketplace, coach and admin vision, and it runs cleanly on the tested Android emulator. The body/muscle visualization, role-specific dashboards, empty/error states and branded visual system are strong foundations.

The next phase should be treated as **platform consolidation and productionization**, not a general feature expansion. The highest-value work is to unify configuration and data ownership, formalize the database/API, secure authentication, and finish commerce/session fulfillment. Adding more screens before those foundations would deepen duplication and raise migration cost.

The recommended first Phase 2 backlog is therefore: **API configuration → migrations/schema → security/session hardening → canonical coach/training/nutrition models → production payments/booking → realtime messaging/video → operational and quality hardening.**

---

## Appendix A — Milestone 1 emulator fixes confirmed during this audit

- Workout filter chips received explicit height, centering and line-height so Android labels no longer clip.
- Nutrition now renders a deliberate unavailable state with Sign In or Retry instead of a blank body when dashboard data cannot load.
- Admin Members distinguishes API failure (“Members unavailable” with Retry) from a genuine zero-result empty state.
- Standalone coach cards place availability on a separate row so 60-minute prices do not overlap on small phones.
- TypeScript, Android export, diff whitespace and runtime error checks passed after the fixes.

## Appendix B — Important environment variables and external dependencies

| Variable/service | Purpose | Required Phase 2 treatment |
|---|---|---|
| `EXPO_PUBLIC_API_BASE` / `EXPO_PUBLIC_DOMAIN` / `EXPO_PUBLIC_API_URL` | Client API location | Replace with one validated variable/config module per environment. |
| `DATABASE_URL` | PostgreSQL | Required; provision through secrets and migration pipeline. |
| `JWT_SECRET` or `SESSION_SECRET` | JWT signing | Mandatory high-entropy secret; remove fallback in production. |
| `OWNER_ADMIN_EMAIL` | Effective owner-admin identity | Consider immutable admin identity/role provisioning with emergency access policy and MFA. |
| `RESEND_API_KEY` | Verification/reset email | Configure domain/DKIM, templates, bounce/complaint handling and monitoring. |
| Stripe connector/secrets/webhook secret | Payments/subscriptions/refunds | Separate test/live accounts, webhook delivery monitoring, least-privilege secret management. |
| Future RTC provider | Video sessions | Server token issuance, room lifecycle, privacy/security and cost controls. |
| Future push provider (Expo/APNs/FCM) | Notifications | Device token lifecycle, consent, preferences, deep links and delivery observability. |

## Appendix C — Source-of-truth map

| Product data | Current owner | Recommended owner |
|---|---|---|
| Identity/roles | PostgreSQL + JWT | PostgreSQL/session service |
| Workout catalog | App bundle/AppContext | Versioned server catalog + client cache |
| Active workout/completions | AsyncStorage | Server enrollment/session events + offline queue |
| Legacy nutrition plans | App bundle/AppContext | Server nutrition plan/catalog or retirement |
| Nutrition profile/logs/recipes/grocery | PostgreSQL | PostgreSQL/domain API |
| FP Score inputs/history/formula | AsyncStorage | Consent-aware server records + versioned formula, with local calculation/cache |
| Progress weight history | AsyncStorage | Server health/progress domain + offline cache |
| Foster showcase coaches | App bundle + server price duplicate | Canonical coach profiles in PostgreSQL |
| Approved coaches | `coach_applications` rows | Dedicated coach profile/service entities linked to application/user |
| Conversations/messages | PostgreSQL | PostgreSQL + realtime transport |
| Bookings | PostgreSQL mirrored to AsyncStorage | PostgreSQL authoritative; local query cache |
| Subscription entitlement | Stripe + DB tables + user mirror + client state | Webhook-led entitlement service/model |
| Earnings/payouts | Calculated from bookings | Immutable commerce ledger + Stripe Connect reconciliation |
| Notification preferences | Component local state | PostgreSQL preference/device-token service |
| Admin settings | PostgreSQL string key/value | Typed, versioned settings with audit log |

