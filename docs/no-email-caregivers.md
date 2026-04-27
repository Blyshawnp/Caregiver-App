# No-email caregivers — how it works

## The setup

On the **Invite** screen, admins can toggle between "Has email" and "No email."
The "No email" path:

1. Admin types a username (letters/numbers only), e.g. `jane`
2. The system creates a placeholder login: `jane@noemail.local`
3. Admin sets a password (auto-generated as memorable like `BraveOtter47`)
4. Submitting creates the user account immediately and prepares an SMS with the
   credentials, ready to send to the caregiver
5. Caregiver opens the app, types the username and password from the SMS, signs in
6. On first login, their phone offers to save the credentials so they auto-fill
   from then on

## Required Supabase setting

For the no-email flow to work without snags, **email confirmation must be off**:

- Supabase Dashboard → **Authentication → Providers → Email**
- Turn **"Confirm email"** off
- Save

Without this, the placeholder email would need to be "confirmed" and there's no
real inbox to confirm from. With confirmation off, accounts are usable
immediately.

## Password resets

When a caregiver forgets their password:

1. Open the team member's profile in the app
2. Tap **Reset password**
3. The app generates a new password and pre-fills an SMS to send them
4. (One manual step for now: copy the new password into Supabase Dashboard →
   Authentication → Users → find the user → Edit → set the new password)

This will be automated later via a Supabase Edge Function. For a family-sized
team it's a 30-second extra step every few months.

## Upgrading to SMS-based login (optional, future)

If you want caregivers to log in by phone number + a 6-digit text code instead
of username/password, here's the path. Cost: roughly $0.01 per login text.

### Step 1: Get an SMS provider account

Twilio is the standard option. Sign up at twilio.com, buy a phone number
(~$1/month), and grab three values from the dashboard:

- Account SID
- Auth Token
- Twilio phone number (in +15555555555 format)

### Step 2: Configure Supabase

In Supabase Dashboard → **Authentication → Providers → Phone**:

1. Enable Phone provider
2. Pick **Twilio** as the SMS provider
3. Paste your Account SID, Auth Token, and Phone Number
4. Save

### Step 3: Add a phone-login screen to the app

A new `/login-phone` screen with two steps:
- Step 1: Caregiver types phone number, taps "Send code." Calls
  `supabase.auth.signInWithOtp({ phone })`
- Step 2: Caregiver types the 6-digit code from the SMS, taps "Verify." Calls
  `supabase.auth.verifyOtp({ phone, token, type: "sms" })`

On first login, the same invitation/profile mechanism runs as the email flow,
just keyed by phone number instead of email.

### Step 4: Update the invite form

A third option alongside "Has email" and "No email": "Phone number." Admin
types the caregiver's phone number, system creates a phone-based invitation,
caregiver opens the app, taps "Sign in with phone," and goes through the OTP
flow.

The two systems coexist — some caregivers use email/password, others use
phone/SMS.

### Step 5: Cost monitoring

Twilio sends weekly usage emails. For a team of 5 caregivers each logging in
once or twice a week, expect to spend less than $1/month. You can set spending
limits inside Twilio so it never surprises you.

## Why we didn't start with SMS

It costs money (small but nonzero), it requires a third-party Twilio account,
and it adds another moving part that can fail (Twilio outage, phone delivery
delays, wrong country format). For a family-trust app, username+password works
fine and is free. SMS is the right choice once you're sharing the app with
people you don't have direct access to help.
