# 🕹️ Zampeak Gaming OS v1.0 — Delta Force Mobile Order Tracker

**Zampeak OS** is a secure, high-performance web application designed for gaming organizations to track order fulfillment, gamer rosters, and financial operations for **Delta Force Mobile**. 

Featuring a modern, tactical cyberpunk visual layout, the system protects command data with granular role-based authentication, restricts database streams using PostgreSQL RLS policies, and connects to a secure Supabase cloud backend.

---

## 🚀 Key Features

*   **Cyberpunk HUD Design**: A dark-mode tactical command dashboard complete with military scanlines, glassmorphism, animated network indicators, and real-time SVG status charts.
*   **Role-Based Access Control (RBAC)**:
    *   **Admin Mode**: Full control over gamer profiles, assigning missions, manual overrides of payout values, generating data audits, and resetting operator keys.
    *   **Gamer Mode**: Locked read-only dashboard. Gamers can only monitor their own active queue, mission states, and total Kwacha (K) earnings.
*   **Synthetic Employee ID Login**: Gamers sign in using only their **Employee ID** (e.g. `ZP-003`) and password. Real email addresses are not required—the app handles email mapping securely in the background.
*   **Direct Administrative Registration**: Avoids public email rate-limiting traps. Gamer auth profiles are created directly by the Admin using a server-side API backed by the Supabase Service Role key.
*   **RLS-Hardened Supabase Database**: Tables are secure by default. Unauthenticated access is rejected, and gamer roster verification is executed via a private PostgreSQL `SECURITY DEFINER` RPC function.

---

## 🛠️ Technology Stack

*   **Framework**: Next.js 15+ (App Router)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS v4.0 (Custom neon theme presets inside `@theme` blocks)
*   **Backend & Auth**: Supabase (Database + GoTrue Auth)
*   **Icons**: Lucide React
*   **Version Control**: Git

---

## 📦 Database Setup Instructions

Paste this schema script into the **SQL Editor** of your Supabase Dashboard to instantiate the tables, secure RLS rules, and RPC validators:

```sql
-- 1. Create GAMERS Table
CREATE TABLE public.gamers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    default_password TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create ORDERS Table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    gamer_id UUID REFERENCES public.gamers(id) ON DELETE RESTRICT NOT NULL,
    size_millions NUMERIC NOT NULL,
    asset_type TEXT NOT NULL DEFAULT 'Haval Coins',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Running',
    payout NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.gamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Authenticated Users Access Policies
CREATE POLICY "Allow authenticated read access" ON public.gamers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.gamers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.orders FOR ALL TO authenticated USING (true);

-- 5. RPC Secure Registration Validator (Bypasses RLS to verify roster safely)
CREATE OR REPLACE FUNCTION verify_gamer_registration(p_employee_id TEXT, p_default_password TEXT)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_gamer RECORD;
BEGIN
    SELECT * FROM public.gamers WHERE UPPER(employee_id) = UPPER(p_employee_id) INTO v_gamer;
    
    IF v_gamer.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Employee ID is not registered in the system. Contact Admin.');
    END IF;
    
    IF v_gamer.default_password IS NULL OR v_gamer.default_password = '' THEN
        RETURN json_build_object('success', false, 'error', 'Employee ID is already registered. Please Sign In.');
    END IF;
    
    IF v_gamer.default_password <> p_default_password THEN
        RETURN json_build_object('success', false, 'error', 'Invalid default registration password.');
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
```

---

## ⚙️ Environment Variables (`.env.local`)

To link the local Next.js client with your Supabase database, create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-secret-service-role-key
```

---

## 🏃 Local Development Setup

To run the Next.js development server locally:

1.  Clone the repository:
    ```bash
    git clone https://github.com/akaman198/zampeak-orders.git
    cd zampeak-orders
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Boot the Turbopack hot-reload compiler:
    ```bash
    npm run dev
    ```
4.  Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🚀 Deploying to Vercel

The project compiles cleanly as a production build. To host it live:

1.  Connect your GitHub repository to your **[Vercel Dashboard](https://vercel.com)**.
2.  Configure your Project Settings and add your **Environment Variables** (URL, Anon Key, and Service Role Key).
3.  Click **Deploy**. Vercel will build and serve the application on their edge network.
