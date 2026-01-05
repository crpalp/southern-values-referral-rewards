# Southern Values Referral Rewards (Turnkey MVP)

This is a deployable, mobile-first web app (PWA-ready) that supports **two programs in one platform**:

1) **Customers**: Earn **cash** or **account credit** for completed work referrals  
2) **Realtors/Partners**: Earn **points** (no cash language) with a redeemable catalog

You requested:
- App name: Southern Values Referral Rewards
- Standalone deployment for now
- Paid after completed work (no waiting period)
- Realtor points rules:
  - 50 points: repair referral
  - 150 points: system replacement referral
  - 25 points: VIP membership referral
  - 25 points: every year they renew

This MVP is designed so you can run it without a developer.

---

## 1) Create Supabase project

1. Create a Supabase project
2. In Supabase, open **SQL Editor** and run:
   - `supabase/schema.sql`
   - then `supabase/rls.sql`
3. In Supabase:
   - **Authentication → Providers**
     - Enable **Email**
     - Enable **Phone** (requires configuring an SMS provider inside Supabase; typically Twilio)
   - **Authentication → URL Configuration**
     - Set Site URL to your local dev URL during testing: `http://localhost:3000`
     - Add Redirect URLs: `http://localhost:3000/**` and your future production domain

---

## 2) Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

You can find these in Supabase:
**Project Settings → API**

---

## 3) Run locally

```bash
npm install
npm run dev
```

Open: http://localhost:3000

---

## 4) Create your first admin user

1. Sign up in the app with your email/phone.
2. In Supabase, go to **Table Editor → profiles**
3. Find your user and set:
   - `is_admin = true`
4. Refresh the app; you will see the Admin menu.

---

## 5) Deploy (Vercel)

1. Create a Vercel account
2. Import this project (upload zip to GitHub, or use Vercel import)
3. Set Environment Variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

Then update Supabase Redirect URLs to include your Vercel domain.

---

## Program setup

### Customer program (USD)
Default rules in `reward_rules`:
- Repair: $50
- Replacement: $150

Customers choose payout preference:
- Cash
- Account Credit

### Realtor/Partner program (Points)
Default rules:
- Repair referral: 50 points
- Replacement referral: 150 points
- VIP membership referral: 25 points
- VIP renewal: 25 points per year

Realtors can redeem points via the Catalog.

---

## Notes on compliance (practical)
This app is built to separate:
- Customer rewards (cash/credit)
- Realtor rewards (points and redemption catalog; no cash language)

You should have your CPA/attorney approve final program terms and redemption categories.

---

## Files
- `supabase/schema.sql` – tables
- `supabase/rls.sql` – row-level security policies
- `app/*` – Next.js app router pages
- `lib/*` – Supabase client helpers
