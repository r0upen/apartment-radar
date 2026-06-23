# Apartment Radar — Portfolio Case Study

**Role:** Solo Engineer (Product, Architecture, Frontend, AI Pipeline)
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase · n8n · OpenAI
**Timeline:** Active personal project

---

## Project Background

Apartment Radar started as a personal tool. The apartment hunter it was built for — searching for a rental in New York City — was spending hours every day manually checking Zillow, StreetEasy, and RentHop, bookmarking listings in different tabs, maintaining a spreadsheet of what she'd toured or rejected, and still missing new listings that appeared and disappeared within hours.

The core insight was simple: **this is an information aggregation problem, and aggregation problems are exactly what software is good at.**

What started as a quick productivity script evolved into a full-stack AI-assisted apartment intelligence platform.

---

## Problem Being Solved

NYC apartment hunting is uniquely painful because:

1. **Listings are fragmented.** The same unit may appear on Zillow, StreetEasy, and RentHop simultaneously, or exclusively on one. No single platform has complete coverage.

2. **New listings disappear fast.** A desirable 2BR in Williamsburg can be gone within hours of posting. Missing the first 24 hours is often the difference between getting a tour and seeing "no longer available."

3. **There is no unified tracking layer.** Every platform has its own favorites list. There is no way to track "I toured this one and it was too noisy" or "I applied here — waiting to hear back" across platforms in one place.

4. **Email alerts are unstructured.** Each platform sends listing emails in a completely different format — HTML, plain text, embedded images, different field orders. Humans can parse them; machines cannot, without help.

---

## Why I Built It

I wanted to build something that solved a real, immediate problem for a real person — not a tutorial project.

I also wanted to work across the full AI engineering stack: not just a chatbot, but a **data pipeline with an AI extraction layer** feeding a polished product interface. The constraint of getting something working and usable within a day or two forced prioritization decisions that mirror real product engineering work.

The question I asked at every decision point was: *what is the minimum that makes this meaningfully better than a spreadsheet?*

---

## Technical Challenges

### 1. Unstructured data extraction at ingestion time

Listing emails from Zillow, StreetEasy, and RentHop arrive in completely different formats. StreetEasy sends a compact HTML table. Zillow sends a verbose paragraph with embedded price and bedroom count. RentHop formats differently still.

**Challenge:** Extract a consistent set of structured fields (address, neighborhood, rent, bedrooms, bathrooms, sqft, pets, agent, URL) from three different unstructured text formats — reliably and at zero marginal engineering cost per new listing.

**Solution:** Route all emails through a single OpenAI prompt that uses function calling / JSON mode to guarantee structured output. The model handles format variation naturally. One prompt handles all three sources. Adding a fourth source in the future requires no code change.

This is not fine-tuning, and it is not RAG — it is **structured extraction**, the most underrated applied AI pattern in engineering.

---

### 2. Server/client timezone hydration mismatch

The "New Today" and "Yesterday" section groupings in the listing UI depend on comparing the listing's `created_at` timestamp against today's date.

**Challenge:** The Next.js server renders HTML using UTC system time. The user's browser is in UTC-7. A listing ingested at 11:00 PM UTC on June 21 is a June 21 listing on the server and a June 22 listing from the user's perspective — meaning the server and client generate different group structures, different listing counts per group, and React throws a hydration mismatch error in production.

**Solution:** Standardize all date math on UTC methods throughout — `getUTCDate()`, `getUTCMonth()`, `getUTCFullYear()` — in every helper function (`isNew`, `getDateGroupKey`, `formatGroupLabel`, `formatAddedDate`). Both environments now produce identical output regardless of where the code runs. The tradeoff is that "New Today" means today in UTC rather than the user's local day, which is an acceptable approximation for this use case.

This is a subtle but production-breaking class of bug that only surfaces in deployment, not local development (where server and browser run in the same timezone).

---

### 3. Supabase RLS silent update failures

After implementing favorites, notes, and decision status persistence, all three appeared to work in the UI but silently failed to persist. No JavaScript error was thrown. The Supabase client returned no error object. The data just disappeared on refresh.

**Challenge:** Diagnose a persistence failure with no visible error signal.

**Solution:** Bypassed the JavaScript client entirely and made direct `curl` requests against the Supabase REST API. The response was an empty array `[]` — the signature of a Row Level Security policy blocking the write without raising an error to the caller. Added an explicit UPDATE policy for the `anon` role and persistence immediately began working.

This experience reinforced a key lesson: **when debugging a persistence failure, go below the abstraction layer.** The client SDK was behaving correctly; the database configuration was wrong. No amount of reading JavaScript code would have revealed that.

---

### 4. FavoriteButton state synchronization

The initial implementation of `FavoriteButton` kept its own internal `useState` for the favorite value and made its own Supabase calls. This led to a subtle synchronization bug: clicking the favorite button on a listing card would correctly update the card, but if the detail modal was already open for that listing, the modal's favorite button would show the stale value — and vice versa.

**Challenge:** Two instances of the same UI element, representing the same piece of data, with separate state that could diverge.

**Solution:** Refactored `FavoriteButton` into a fully controlled, stateless component with zero internal state. It accepts `favorite: boolean` as a prop and calls `onFavoriteChange` on click. All logic — optimistic update, Supabase write, error rollback — lives in a single `handleFavoriteChange` function in `ApartmentGrid`. There is now exactly one source of truth for every listing's favorite state: the `apartments` array in `ApartmentGrid`.

This is the React controlled component pattern applied to a cross-component synchronization problem.

---

## Architecture Decisions

### n8n for orchestration, not custom code

The ingestion pipeline could have been a Python script running on a cron job. n8n was chosen instead because:
- Visual workflow editor makes the pipeline transparent and debuggable without opening code
- Gmail, OpenAI, and Supabase nodes are first-class integrations
- Workflow changes (adding a new source, changing the extraction prompt) don't require a deployment
- Retry logic, error logging, and run history come for free

**Rule of thumb:** Use code for logic that belongs in code. Use orchestration tools for workflow logic that benefits from visibility.

---

### Single-table schema, no normalization

Listings, user annotations (notes, favorites, decision status), and metadata all live in one `apartments` table. A more normalized design might split user annotations into a separate table, linked by a foreign key.

**Why the flat schema:** This is a single-user tool with no authentication. There is no concept of multiple users having different annotations on the same listing. A join would add complexity with zero benefit. The flat schema also makes the Supabase query trivially simple: `SELECT *` with no joins.

**The future cost:** If multi-user support is ever added, this schema needs to be decomposed. That is a known and acceptable tradeoff.

---

### Server Component for data fetching, Client Component for everything else

`page.tsx` is a Next.js Server Component. It runs only on the server, fetches all apartments from Supabase, and passes them down as props to `ApartmentGrid`. No client-side data fetching on mount, no loading spinners, no `useEffect` for initial data.

`ApartmentGrid` is a Client Component. It owns all interactivity: filtering, sorting, map selection, modal state, and live writes back to Supabase.

This architecture gives:
- Fast initial page load (data arrives with the HTML, not after)
- Simple mental model (data flows down, events flow up)
- No hydration issues from async data loading
- `force-dynamic` ensures the server always re-fetches on every request

---

## AI Components

| Component | Model | Pattern | Where |
|---|---|---|---|
| Listing field extraction | GPT-4o-mini | Structured extraction (JSON mode) | n8n, at ingestion time |

The AI layer is deliberately narrow. It does one thing — parse unstructured email text into structured database fields — and does it reliably. This is the difference between using AI as a feature and using AI as infrastructure.

The extraction prompt is designed to:
- Return a fixed schema regardless of input format
- Gracefully handle missing fields (return null, not an error)
- Be runnable cheaply at scale (GPT-4o-mini costs a fraction of a cent per listing)

Future AI components in the roadmap include listing summarization, personalized scoring, and natural language search — but each of these is additive, not foundational. The pipeline works without them.

---

## Results

- **Time saved:** The apartment hunter went from 45–60 minutes of daily manual platform checking to a 5-minute daily review of new listings grouped by date
- **Coverage:** All three major NYC rental platforms are represented in one view for the first time
- **Decision tracking:** Every listing now has a persistent record of its status (Interested → Tour → Applied / Rejected) and personal notes — no spreadsheet required
- **Discovery rate:** The "New Today" grouping and pulsing badge means genuinely new listings are immediately visible and cannot be buried under older ones
- **Zero missed listings:** Email-based ingestion runs continuously; the user is notified of new listings via the platform itself rather than having to remember to check

---

## Lessons Learned

**1. Real problems make better portfolios than fake ones.**
Building something for a real user — someone who would actually complain if it broke — forced decisions that tutorial projects never require. Debugging the Supabase RLS issue, fixing the hydration mismatch, and handling the FavoriteButton synchronization bug were all problems that only surface in production under real use.

**2. AI is most powerful at the boundaries of systems.**
The OpenAI integration in this project is not a chatbot. It is a translation layer between an unstructured external world (emails) and a structured internal world (a database schema). This is where AI provides the most leverage — not at the user interface, but at the data ingestion boundary.

**3. The abstraction layer is not always the right place to debug.**
When the Supabase writes were silently failing, the instinct was to read more JavaScript. The right move was to go below the abstraction entirely — to `curl` directly against the REST API — to see what was actually happening at the HTTP level. Knowing when to abandon the framework and look at the raw protocol is a senior engineering skill.

**4. Controlled components are not just a React pattern — they are a state architecture.**
The FavoriteButton bug was a state architecture problem dressed up as a React bug. The solution — make the component fully controlled — is a specific application of a general principle: **shared state must have exactly one owner, and that owner must be the highest common ancestor.**

**5. Small design choices compound.**
Using UTC-based date math instead of local time methods is a three-line change. Not making it causes a production hydration bug that is invisible in local development and only reproducible on a deployed server in a different timezone. Small correctness decisions compound into reliable systems.

---

## Future Vision

Apartment Radar is a personal tool that has the architecture of a startup product. The natural evolution is:

**Phase 1 — Multi-user**
Add Supabase Auth. Each user has their own saved preferences, favorites, notes, and decision history. The listings are shared; the annotations are private.

**Phase 2 — Alerts**
Push notifications or email digests when new listings matching saved criteria appear. The ingestion pipeline already captures `created_at` — triggering an alert on new rows is a small n8n workflow addition.

**Phase 3 — AI-native search**
Replace the text filter with natural language. "Find me a 2BR under $3,000 with laundry in Bushwick or Williamsburg" resolves to a structured query. The Supabase schema already has every field needed.

**Phase 4 — Market intelligence**
Listings have timestamps. Rent is a structured field. This is a time-series dataset. Neighborhood-level rent trend charts, days-on-market tracking, and "this listing is priced above the neighborhood average" signals are all possible with the data that already exists.

The core insight that makes all of this possible: **apartments are structured data in disguise.** Email ingestion + AI extraction turns fragmented, platform-specific, unstructured listing information into a clean, queryable dataset. Everything else is product built on top of that foundation.
