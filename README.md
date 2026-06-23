# Apartment Radar

**Naryne's AI-Powered Apartment Finder**

A full-stack apartment aggregation and tracking platform that pulls live listings from Zillow, StreetEasy, and RentHop into a single searchable, filterable interface — with AI-assisted data extraction, automated ingestion pipelines, and a Zillow-style map-and-listings UI.

---

## Problem Statement

Apartment hunting in New York City is fragmented. Listings live across Zillow, StreetEasy, RentHop, and dozens of broker email chains — each with different formats, different data quality, and no unified view. A serious apartment hunter has to manually check 3–5 platforms every day, manually track which apartments they've favorited, toured, or rejected, and keep notes in a separate spreadsheet.

There is no single product that:
- Aggregates listings from all sources automatically
- Lets you track your personal decision status on each listing
- Shows you which listings are brand new today
- Gives you a map-first browsing experience

**Apartment Radar solves all of this.**

---

## Solution

Apartment Radar is a personal apartment intelligence platform. It:

1. **Ingests listings automatically** from Zillow, StreetEasy, and RentHop using n8n automation workflows
2. **Extracts structured data** from unstructured listing emails using OpenAI
3. **Stores everything in Supabase** with deduplication, timestamps, and user annotations
4. **Displays listings in a Zillow-style interface** with a sticky map, date grouping, filters, and a full detail modal
5. **Tracks your decisions** — favorite, notes, and decision status (Interested / Tour / Applied / Rejected) all persist to the database

---

## Key Features

### Listing Discovery
- Listings automatically sorted **newest first**, grouped by the date added ("New Today", "Yesterday", specific dates)
- **"New" badge** on any listing added on today's UTC date
- Animated pulsing dot on "New Today" section headers
- Live listing count in the nav bar

### Filtering & Search
- Full-text search across address, neighborhood, agent name, and source
- Filter by source: **Zillow** (blue), **StreetEasy** (orange), **RentHop** (cyan)
- Multi-select **neighborhood chips**
- Max rent and minimum bedrooms filters
- Toggle to show only **saved/favorited** listings
- Sort by: Newest First, Rent Low → High, Rent High → Low

### Map Experience
- **Zillow-style sticky map** on desktop (left column, fills viewport height)
- Click any listing card to pin it on the map
- Map overlay shows source badge, address, neighborhood, and monthly rent
- Stacks above listings on mobile

### Detail Modal
- Full listing detail view with embedded Google Maps
- **Editable notes** with debounced auto-save (saves 1 second after you stop typing)
- **Decision status** dropdown (Interested / Tour / Applied / Rejected) that saves immediately
- Save status indicator (Saving… / Saved ✓ / Error)
- Favorite toggle synced with the card grid

### Data Persistence
- Favorites, notes, and decision status all write directly to Supabase
- Optimistic UI updates with automatic rollback on failure
- State persists across page refreshes and browser sessions

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA INGESTION                           │
│                                                                 │
│  Zillow / StreetEasy / RentHop                                  │
│        │                                                        │
│        ▼                                                        │
│   Gmail (listing emails) ──► n8n Workflow ──► OpenAI Extract   │
│                                    │                            │
│                                    ▼                            │
│                             Supabase (apartments table)         │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                                                                 │
│   Next.js 16 (App Router)                                       │
│        │                                                        │
│        ├── page.tsx (Server Component)                          │
│        │      └── Fetches all apartments from Supabase          │
│        │                                                        │
│        └── ApartmentGrid.tsx (Client Component)                 │
│               ├── Filtering, sorting, date grouping             │
│               ├── Sticky map (Google Maps embed)                │
│               ├── Detail modal                                  │
│               └── Live writes → Supabase (favorite, notes, status)
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16 (App Router) |
| UI language | TypeScript 5, React 19 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth / RLS | Supabase Row Level Security |
| Automation | n8n |
| AI extraction | OpenAI API |
| Email ingestion | Gmail → n8n |
| Map embeds | Google Maps Embed API |
| Fonts | Geist, Geist Mono (Google Fonts) |

---

## Data Flow

```
1. Listing email arrives in Gmail
        │
        ▼
2. n8n workflow triggers on new email
        │
        ▼
3. OpenAI extracts structured fields:
   address, neighborhood, rent, bedrooms,
   bathrooms, sqft, pets_allowed, source,
   listing_agent, listing_url
        │
        ▼
4. n8n upserts row into Supabase `apartments` table
   (with created_at timestamp for "New Today" detection)
        │
        ▼
5. Next.js Server Component fetches all rows
   ordered by created_at DESC
        │
        ▼
6. ApartmentGrid renders listings grouped by date,
   filtered by user preferences
        │
        ▼
7. User interactions (favorite, notes, decision_status)
   write directly back to Supabase via the client SDK
```

---

## Installation Instructions

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A Supabase `apartments` table (see schema below)
- n8n instance (for automated ingestion — optional for local dev with manual data)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/apartment-finder.git
cd apartment-finder
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values (see Environment Variables section).

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Both variables are prefixed with `NEXT_PUBLIC_` because they are used on both the server (data fetching) and the client (live writes for favorites, notes, and decision status).

> **Security note:** The anon key is safe to expose publicly as long as your Supabase Row Level Security (RLS) policies are correctly configured. Ensure UPDATE and SELECT policies are set appropriately for your use case.

---

## Supabase Schema

```sql
create table apartments (
  id              uuid primary key default gen_random_uuid(),
  listing_url     text,
  source          text,                    -- 'Zillow' | 'StreetEasy' | 'RentHop'
  address         text not null,
  neighborhood    text,
  rent            integer not null,
  bedrooms        integer not null default 0,
  bathrooms       numeric,
  sqft            integer,
  pets_allowed    text,
  listing_agent   text,
  status          text,
  favorite        boolean not null default false,
  notes           text,
  decision_status text,                    -- 'Interested' | 'Tour' | 'Applied' | 'Rejected'
  created_at      timestamptz default now()
);

-- Required RLS policies (enable RLS on the table first)
create policy "Allow anon select"
  on apartments for select to anon using (true);

create policy "Allow anon update"
  on apartments for update to anon using (true);
```

---

## Local Development Setup

```bash
# Install dependencies
npm install

# Start dev server (hot reload enabled)
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Production build
npm run build
npm run start
```

---

## Deployment Process

Apartment Radar is designed to deploy on [Vercel](https://vercel.com) with zero configuration.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

**Environment variables** must be added to your Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The app uses `export const dynamic = "force-dynamic"` on the root page to ensure listings are always fetched fresh from Supabase on every request (no stale cache).

---

## Future Roadmap — Apartment Radar V2

### Ingestion
- [ ] Direct API integrations with Zillow, StreetEasy, and RentHop (replace email-based ingestion)
- [ ] Real-time webhook triggers when new listings go live
- [ ] Automatic deduplication across sources (same unit listed on multiple platforms)
- [ ] Price change detection and alerting

### AI
- [ ] AI-generated listing summaries ("This 2BR in Bushwick has large windows, updated kitchen, and is pet-friendly")
- [ ] Personalized listing scoring based on saved preferences
- [ ] Natural language search ("find me a 2BR under $3,000 with laundry in Williamsburg")
- [ ] Lease red flag detection from listing text

### User Experience
- [ ] User authentication (multi-user support)
- [ ] Email or SMS alerts for new listings matching saved criteria
- [ ] Tour scheduling integration
- [ ] Comparison view (compare 2–3 listings side by side)
- [ ] Shareable listing links

### Data
- [ ] Historical rent tracking per neighborhood
- [ ] Days-on-market tracking
- [ ] Commute time calculator (from listing to workplace)

---

## Project Status

Active — built and maintained as a personal tool that is evolving toward a generalizable product.
