# Foster Performance - Comprehensive Testing Plan & Known Issues

## 🧪 Testing Checklist

### 1. **Authentication Flow**
- [ ] Register new member account
- [ ] Register new coach applicant
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should show error)
- [ ] Forgot password flow
- [ ] Email verification
- [ ] Password reset

**Potential Issues:**
- ⚠️ Email verification not fully implemented in contexts
- ⚠️ Password reset flow may need Supabase email service setup

---

### 2. **Member Onboarding**
- [ ] Complete onboarding flow
- [ ] Skip optional steps
- [ ] Save onboarding preferences

**Potential Issues:**
- ⚠️ Onboarding screen not verified for Supabase integration

---

### 3. **Workout Management**
- [ ] Browse workout programs
- [ ] Enroll in a program
- [ ] Start a workout session
- [ ] Log exercises and sets
- [ ] Complete workout
- [ ] View progress history

**Potential Issues:**
- ✅ Verified: All using Supabase

---

### 4. **Nutrition Tracking**
- [ ] View nutrition dashboard
- [ ] Log food items
- [ ] Log water intake
- [ ] Browse recipes
- [ ] Save recipes
- [ ] Create grocery list from recipe
- [ ] Check off grocery items

**Potential Issues:**
- ✅ Verified: All using Supabase

---

### 5. **Coach Browsing & Booking**
- [ ] View list of coaches
- [ ] Filter coaches by specialty
- [ ] View coach profile details
- [ ] View coach reviews
- [ ] Book a session with coach
- [ ] Receive booking confirmation
- [ ] View upcoming sessions

**Potential Issues:**
- ✅ Fixed: Now using Supabase coachRepository

---

### 6. **Messaging System**
- [ ] Start conversation with coach
- [ ] Send message in conversation
- [ ] Receive messages in real-time
- [ ] Mark messages as read
- [ ] See unread count
- [ ] View message history

**Potential Issues:**
- ⚠️ Real-time subscriptions need Supabase Realtime enabled
- ⚠️ Message delivery confirmation not implemented

---

### 7. **Leaderboard & Gamification**
- [ ] View global leaderboard
- [ ] View league leaderboard
- [ ] View friends leaderboard
- [ ] Record activity (workout, nutrition, etc)
- [ ] Earn points
- [ ] Build streak
- [ ] Unlock achievements
- [ ] View challenges
- [ ] Join challenge
- [ ] Add friend

**Potential Issues:**
- ✅ Fixed: Using LeaderboardContext with Supabase RPC functions

---

### 8. **FP Score Tracking**
- [ ] View current FP Score
- [ ] View score history
- [ ] Log health metrics
- [ ] See score breakdown
- [ ] Track metric trends

**Potential Issues:**
- ✅ Fixed: Now properly using health_checkins table

---

### 9. **Notifications**
- [ ] Receive notifications
- [ ] View notification center
- [ ] Mark notification as read
- [ ] Mark all as read
- [ ] Search notifications

**Potential Issues:**
- ✅ Fixed: Now fetching from Supabase notifications table
- ⚠️ Push notifications not yet implemented

---

### 10. **Profile Management**
- [ ] View profile
- [ ] Edit profile details
- [ ] Update avatar
- [ ] Change password
- [ ] Change email
- [ ] Manage privacy settings
- [ ] View subscription status

**Potential Issues:**
- ⚠️ Avatar upload functionality needs image storage setup
- ⚠️ Privacy controls validation needed

---

### 11. **Coach Features**
- [ ] View coach dashboard
- [ ] See upcoming sessions
- [ ] View earnings
- [ ] Manage availability
- [ ] Edit coach profile
- [ ] View client list
- [ ] Message with clients

**Potential Issues:**
- ✅ Fixed: Dashboard now uses Supabase bookings

---

### 12. **Admin Features**
- [ ] View admin dashboard
- [ ] See platform stats
- [ ] Review coach applications
- [ ] Manage members
- [ ] View all bookings
- [ ] Check audit logs
- [ ] Handle support tickets

**Potential Issues:**
- ✅ Fixed: Admin stats now from Supabase

---

### 13. **Billing & Subscription**
- [ ] View subscription plans
- [ ] Start checkout
- [ ] Process payment (requires Stripe setup)
- [ ] Manage payment methods
- [ ] View billing history
- [ ] Cancel subscription

**Potential Issues:**
- ⚠️ Stripe Edge Functions not fully configured
- ⚠️ Payment webhooks not tested

---

### 14. **Error Handling**
- [ ] Network error handling
- [ ] Timeout handling
- [ ] Malformed data handling
- [ ] Auth token expiration
- [ ] Permission denied errors

**Potential Issues:**
- ⚠️ Some screens missing error boundaries
- ⚠️ Generic error messages (should be user-friendly)

---

### 15. **Performance**
- [ ] App loads within 2 seconds
- [ ] Smooth scrolling on lists
- [ ] Pagination working for large lists
- [ ] Image loading doesn't block UI
- [ ] No memory leaks on long sessions

**Potential Issues:**
- ⚠️ Not profiled yet
- ⚠️ Pagination not implemented on some lists

---

## 🐛 Known Issues & Fixes Applied

### ✅ FIXED Issues
1. **Booking Creation** - Was not persisting to Supabase
   - Fixed: Now calls `createBooking()` from coachRepository

2. **Notification Center** - Using hardcoded local data
   - Fixed: Now fetches from Supabase `notifications` table

3. **Coach Dashboard** - Using old API
   - Fixed: Now uses `fetchBookings()` from Supabase

4. **Admin Dashboard** - Using old API for stats
   - Fixed: Now counts from Supabase tables directly

### ⚠️ KNOWN REMAINING ISSUES

1. **Push Notifications**
   - Status: Not implemented
   - Impact: Users won't receive push notifications
   - Solution: Configure FCM/APNs and Supabase Edge Functions

2. **Image/File Storage**
   - Status: Not implemented
   - Impact: Avatar uploads won't work
   - Solution: Configure Supabase Storage buckets

3. **Email Service**
   - Status: Not fully configured
   - Impact: Email verifications and password resets may not work
   - Solution: Configure SendGrid or similar via Supabase Edge Functions

4. **Stripe Integration**
   - Status: Partially implemented (Edge Functions exist but not configured)
   - Impact: Subscription/payment flows won't work
   - Solution: Configure Stripe keys in Edge Functions and webhooks

5. **Real-time Messaging**
   - Status: Code ready, not tested
   - Impact: Messages may not update in real-time
   - Solution: Verify Supabase Realtime is enabled on project

6. **Some Screens Not Connected**
   - Status: Minor screens may still use placeholder data
   - Impact: Some features incomplete
   - Solution: Verify all detail screens (video-call, payouts, etc)

---

## 📋 Critical Tests Before Production

1. **Authentication**
   - [ ] Can register
   - [ ] Can login
   - [ ] Session persists after app restart
   - [ ] Can logout

2. **Data Persistence**
   - [ ] Create data in app
   - [ ] Close and reopen app
   - [ ] Data still exists

3. **Offline Handling**
   - [ ] App doesn't crash when offline
   - [ ] Graceful error messages shown
   - [ ] Recovers when online again

4. **Security**
   - [ ] JWT tokens properly set
   - [ ] Can't access other user's data (RLS works)
   - [ ] Admin can access all data
   - [ ] Coach sees only own bookings

5. **Performance**
   - [ ] App starts in < 3 seconds
   - [ ] Lists scroll smoothly
   - [ ] No visible lag on interactions

---

## 🎯 Next Steps After Testing

See NEXT_STEPS.md for detailed roadmap.
