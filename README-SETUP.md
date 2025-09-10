# DisasterShield Setup Guide

## Quick Start

1. **Clone this repository**
   ```bash
   git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   cd YOUR-REPO-NAME
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.template .env
   # Edit .env with your actual credentials
   ```

4. **Connect to Supabase**
   - Click "Connect to Supabase" in the top right of the Bolt interface
   - Or manually set up your Supabase project and run the migrations

5. **Start development server**
   ```bash
   npm run dev
   ```

## Environment Setup

### Supabase
1. Create a new Supabase project
2. Copy your project URL and anon key to `.env`
3. Run the SQL migrations in `/supabase/migrations/`

### Stripe (Test Mode Only)
1. Get your test mode keys from Stripe Dashboard
2. Create products for: Security Deposit, Service Fee, Emergency Fee
3. Copy the test mode price IDs to `src/stripe-config.ts`
4. Set up webhook endpoint pointing to your Supabase Edge Function

### Email (Resend)
1. Create Resend account and verify domain
2. Get API key and set in `.env`
3. Deploy the send-email Edge Function

## Testing

1. **Create an account** at `/auth/signup`
2. **File a claim** at `/intake`
3. **Test payments** at `/payment/[project-id]`
4. **Test contractor matching** workflow

## Deployment

Deploy to Vercel with environment variables configured in project settings.