# Multi-Tenancy Roadmap

A step-by-step plan, written 27 October 2026, for turning this project from a single Circa Waves site into a portal where each client logs in and sees only their own **Dashboard**, **Calendar** and **Fan Interests** board.

The discovery and download pipeline (YouTube and Instagram search, review, archive) stays a service that you run. It becomes an admin-only area plus scripts that take a `--client` flag.

---

## 1. Where things stand today

| Area | Current state | What has to change |
|---|---|---|
| Login | `proxy.ts` uses one shared Basic Auth username and password | Real user accounts with Supabase Auth |
| `next-auth` | Installed but never used | Remove it |
| Database access | Every query goes through `lib/supabaseAdmin.js` (service-role key, which skips all security rules) | Client-facing pages switch to a user-scoped client, so Row Level Security (RLS) applies |
| Tables | No `client_id` anywhere. `platform_video_id` is globally unique in `tiktok_videos` and `instagram_discoveries`. The table name `circa_full_content` contains the band's name | Add `client_id` to every table, make unique constraints per client, use a neutral table name |
| Schema history | `content_discoveries`, `circa_full_content` and `discovery_search_state` aren't in `supabase/migrations/`, and there is no migration `001` | Capture the real schema before changing it |
| Routes | `/` (Content Review), `/instagram`, `/tiktok` (Dashboard), `/calendar` | Client pages move under `/[client]/…` and review pages under `/admin/…` |
| Calendar | Google Sheet set by `CALENDAR_SHEET_ID` and `CALENDAR_SHEET_TAB` in env vars | Short term: a sheet ID per client. Long term: a Supabase table |
| Fan Interests | Scripts in `scripts/fanAnalysis/` exist. The `fan_analysis` migration is an empty placeholder and there's no page yet | Build it tenant-aware from day one |
| Hard-coded band | `app/layout.js`, the logo alt text in `Nav.jsx` and `MobileNav.jsx`, `lib/instagramScoring.js` (`BAND_PATTERN`, `BAND_HANDLE`), search terms and scoring in `scripts/internetSearch.js`, and `TIKTOK_USERNAME` / `INSTAGRAM_USERNAME` env vars | Per-client settings stored in the database |

### Which features belong to whom

| Feature | Route today | Who uses it | New route |
|---|---|---|---|
| Content Review (YouTube) | `/` | You | `/admin/[client]/review` |
| Instagram Review | `/instagram` | You | `/admin/[client]/instagram` |
| TikTok Dashboard | `/tiktok` | Client | `/[client]/dashboard` |
| Calendar | `/calendar` | Client | `/[client]/calendar` |
| Fan Interests | (not built) | Client | `/[client]/fans` |

---

## 2. Target architecture

```text
                    ┌──────────────────────────────────────────────┐
  Browser ─────────▶│ proxy.ts: refresh the Supabase session,      │
                    │ send logged-out users to /login               │
                    └──────────────────┬───────────────────────────┘
                                       ▼
      /[client]/…  (layout looks up the slug and checks membership)       /admin/…  (platform admins only)
      ├─ dashboard ─┐                                                     ├─ clients (create / invite)
      ├─ calendar  ─┼─▶ user-scoped Supabase client ─▶ RLS ─▶ rows        └─ [client]/review, instagram
      └─ fans      ─┘   (anon key + user's session)     for this client           │
                                                                                 ▼
  scripts/*.js --client <slug> ─────────────▶ service-role client (skips RLS, always sets client_id)
```

Rules that hold throughout:

1. Every table with client data has a `client_id uuid not null`.
2. Every such table has RLS turned on.
3. The service-role key is used **only** in `/admin` and in `scripts/`, never on a client-facing page.
4. Every server component, server action and route handler checks membership itself. `proxy.ts` only handles convenience redirects and must never be the only check.

---

## 3. Phases

Each phase leaves the app working, so you can stop between phases. Circa Waves becomes **client #1**, and the site should keep working for it at every step.

### Phase 0: Prepare (about half a day)

- [ ] Create a branch: `git switch -c multi-tenancy`.
- [ ] Back up the database (Supabase dashboard → Database → Backups, or `pg_dump`).
- [ ] Set up somewhere to test that isn't production: a second Supabase project, or local Supabase via `supabase start` (needs Docker).
- [ ] Capture the current schema so migrations match reality:
  ```bash
  npx supabase db pull
  ```
  Commit the result as the baseline migration. It fills the gaps for `content_discoveries`, `circa_full_content` and `discovery_search_state`.
- [ ] Remove the unused dependency: `npm uninstall next-auth`.

**Done when:** the migrations folder rebuilds the current database from scratch.

### Phase 1: Tenancy tables and `client_id` (1–2 days)

New migration, `007_tenancy.sql`:

```sql
create table clients (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  logo_url text,
  theme_color text,
  tiktok_username text,
  instagram_username text,
  calendar_sheet_id text,
  calendar_sheet_tab text,
  search_config jsonb not null default '{}',  -- search terms, band pattern, handles
  created_at timestamptz not null default now()
);

create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create type client_role as enum ('client_viewer', 'client_editor');

create table memberships (
  user_id uuid references auth.users(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  role client_role not null default 'client_viewer',
  primary key (user_id, client_id)
);

insert into clients (slug, name, tiktok_username, instagram_username)
values ('circa-waves', 'Circa Waves', '<current TIKTOK_USERNAME>', 'circawaves');
```

Then, **for each table** (`content_discoveries`, `circa_full_content`, `discovery_search_state`, `instagram_discoveries`, `tiktok_videos`, `tiktok_profile_snapshots`, `fan_analysis`):

```sql
alter table tiktok_videos add column client_id uuid references clients(id);
update tiktok_videos set client_id = (select id from clients where slug = 'circa-waves');
alter table tiktok_videos alter column client_id set not null;
create index on tiktok_videos (client_id);
```

- [ ] Make global unique constraints unique per client, so two clients can track the same video:
  ```sql
  alter table tiktok_videos drop constraint tiktok_videos_platform_video_id_key;
  alter table tiktok_videos add unique (client_id, platform_video_id);
  ```
  Do the same for `instagram_discoveries` and any URL or video-ID uniques on `content_discoveries` and `circa_full_content`. Check each actual constraint name with `\d tablename` first.
- [ ] Update every `upsert(..., { onConflict: "platform_video_id" })` in `scripts/` to `onConflict: "client_id,platform_video_id"`.
- [ ] Rename `circa_full_content` → `full_content`. To avoid breaking the scripts mid-change, leave a view behind for a while: `create view circa_full_content as select * from full_content;`. Update `TABLE_NAME` in `downloadContent.js`, `removeOrphanedDownloads.js` and `keepAlive.cjs`, plus the `.from()` calls in `internetSearch.js`, `instagramSearch.js` and `importDiscoveries.js`, then drop the view.
- [ ] Add your own user to `platform_admins` once you have an account (Phase 2).

**Done when:** every row belongs to Circa Waves through `client_id` and nothing visible has changed.

### Phase 2: Real logins with Supabase Auth (1–2 days)

- [ ] `npm install @supabase/ssr`
- [ ] Create `lib/supabase/server.js`: a `createServerClient` that reads and writes cookies via `next/headers`, used in server components and actions.
- [ ] Create `lib/supabase/browser.js`: a `createBrowserClient`, only needed if a client component calls Supabase directly.
- [ ] Rename `lib/supabaseAdmin.js` → `lib/supabase/admin.js` and add `import "server-only"` at the top (the package is already installed), so the service key can never be bundled into the browser.
- [ ] Build `app/login/page.jsx`: email + password, or magic link. Magic links are easiest for clients, with no passwords to manage.
- [ ] Add `app/auth/callback/route.js` for magic-link and invite redirects.
- [ ] Rewrite `proxy.ts`: replace the Basic Auth check with the Supabase session-refresh pattern from the `@supabase/ssr` Next.js guide, and redirect to `/login` when there's no user (leave `/login` and `/auth/*` open).
- [ ] In the Supabase dashboard: **turn off public sign-ups** (Authentication → Providers → Email) so the only way in is an invite.
- [ ] Remove `SITE_USER` and `SITE_PASSWORD` from `.env` and from the hosting provider once logins work.

**Done when:** you log in as yourself and the existing pages still work. They still use the admin client at this point, which is fine for now.

### Phase 3: Row Level Security (1 day)

Helper functions keep the policies short. `security definer` lets them read `memberships` without being blocked by RLS on that table.

```sql
create function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create function is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_platform_admin()
      or exists (select 1 from memberships where user_id = auth.uid() and client_id = cid);
$$;

create function can_edit(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_platform_admin()
      or exists (select 1 from memberships
                 where user_id = auth.uid() and client_id = cid and role = 'client_editor');
$$;
```

For each client-facing table:

```sql
alter table tiktok_videos enable row level security;
create policy "members read" on tiktok_videos for select using (is_member(client_id));
```

- [ ] Turn RLS on for **every** table, including admin-only ones (`content_discoveries`, `instagram_discoveries`, `discovery_search_state`, `full_content`). Give the admin-only tables **no** policies, so only the service role can touch them.
- [ ] `clients`: members can read their own row (`using (is_member(id))`).
- [ ] `memberships`: users can read their own rows (`using (user_id = auth.uid())`).
- [ ] Run the Supabase **Security Advisor** (Dashboard → Advisors). It flags tables with RLS turned off.

**Done when:** querying with the anon key and no session returns nothing from any table.

### Phase 4: Client routes (2–3 days)

New structure:

```text
app/
  login/page.jsx
  page.jsx                     → redirect to the user's client (or a picker if they have several)
  [client]/
    layout.jsx                 → look up slug, check membership, notFound() if not allowed, render branded Nav
    dashboard/page.jsx         ← moved from app/tiktok/page.jsx
    calendar/page.jsx          ← moved from app/calendar/page.jsx
    calendar/actions.js        ← moved from app/calendar/actions.js
    fans/page.jsx              (Phase 7)
  admin/
    layout.jsx                 → require is_platform_admin
    clients/page.jsx           (Phase 8)
    [client]/review/page.jsx   ← moved from app/page.jsx
    [client]/instagram/page.js ← moved from app/instagram/page.js
  api/admin/discoveries/…      ← moved from app/api/discoveries/…
  api/admin/instagram/…        ← moved from app/api/instagram/…
```

- [ ] Add `lib/tenant.js` with one helper that every client page and action calls:
  ```js
  // Returns { client, role } or throws notFound(). Never trust the slug alone.
  export async function requireClient(slug) { … }
  ```
  `React.cache()` it so the layout and page share one lookup per request.
- [ ] Change the `lib/` functions to take a `clientId` and pass in the user-scoped Supabase client:
  - `getTiktokDashboardData()` → `getTiktokDashboardData(supabase, clientId)`
  - The `lib/instagramDiscoveries.js` functions → also take `clientId` (admin side, service-role client, explicit `.eq("client_id", clientId)`)
- [ ] Admin routes still filter by `client_id` **explicitly**, because the service role skips RLS.
- [ ] Admin route handlers in `app/api/admin/` check `is_platform_admin` at the top. They can't rely on the admin layout, since layouts don't wrap route handlers.
- [ ] Move `nav` out of `config/site.js` into a function that builds links from the slug and role (clients get Dashboard / Calendar / Fans; admins also get the review links).
- [ ] Replace the static `metadata` in `app/layout.js` with `generateMetadata` in `[client]/layout.jsx` using `client.name`. Make the logo and alt text in `Nav.jsx` / `MobileNav.jsx` come from `client.logo_url` / `client.name`.
- [ ] Keep `export const dynamic = "force-dynamic"` (or read cookies, which has the same effect) so one client's data is never cached and served to another.

**Done when:** `/circa-waves/dashboard` works for a Circa Waves member, and `/other-client/dashboard` returns a 404 for that same user.

### Phase 5: Per-client calendar (1 day short term, 3–4 days long term)

**Short term (keep Google Sheets):**

- [ ] Change `getCalendarRows`, `appendCalendarPost` and `insertCalendarRow` in `lib/calendarSheet.js` to take `{ sheetId, tab }` instead of reading `CALENDAR_SHEET_ID` / `CALENDAR_SHEET_TAB`.
- [ ] Look up the values from `clients.calendar_sheet_id` / `calendar_sheet_tab` after `requireClient()`.
- [ ] In `calendar/actions.js`, check that the user is a `client_editor` (or admin) **before** validating and writing. Read-only clients get the calendar without the Add button.
- [ ] Share each client's sheet with the service account email.

**Long term (recommended once you have 3+ clients):** move the calendar into a `calendar_posts` table with `client_id`, RLS (`select` for members, `insert/update/delete` with `can_edit`), and the existing `FIELD_LIMITS` mirrored as `check` constraints. You get real permissions, an audit trail and no Google API quotas. Keep an "Export to Sheet/CSV" button if clients like spreadsheets.

### Phase 6: Pipeline scripts take a client (1–2 days)

- [ ] Add a small `scripts/lib/loadClient.js`: read `--client <slug>` from `process.argv`, fetch the `clients` row with the service-role client, and exit with an error if it's missing.
- [ ] Every insert or upsert in `scripts/` sets `client_id: client.id`. Every select filters `.eq("client_id", client.id)`.
- [ ] Move band-specific values into `clients.search_config`:
  - Search terms and title-scoring keywords in `scripts/internetSearch.js`
  - `BAND_PATTERN`, `BAND_HANDLE` and the song lists in `lib/instagramScoring.js`
  - `TIKTOK_USERNAME` / `INSTAGRAM_USERNAME` → `clients.tiktok_username` / `instagram_username`
- [ ] Local file paths become per client: `output/<slug>/…`, `videos/<slug>/…`, `output/<slug>/fan-analysis/…`.
- [ ] Scheduled jobs (cron) loop over clients, e.g. `for c in circa-waves other-band; do node scripts/syncTikTokStats.js --client $c; done`, or add `--all`.

**Done when:** running every script with `--client circa-waves` gives the same results as before.

### Phase 7: Fan Interests board (build tenant-aware from the start)

- [ ] Write the real `006_fan_analysis` schema with `client_id`, an index and a read policy for members.
- [ ] `scripts/fanAnalysis/03_analyse.js` writes aggregated results with `client_id`. Raw fan data stays in `output/<slug>/fan-analysis/` and never reaches the database, which matches the current design.
- [ ] Build `app/[client]/fans/page.jsx` reading through the user-scoped client.

### Phase 8: Onboarding and invites (1 day)

- [ ] `app/admin/clients/page.jsx`: list clients and a "New client" form (name, slug, handles, sheet ID).
- [ ] An "Invite user" server action: `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: …/auth/callback })`, then insert into `memberships` with the chosen role.
- [ ] A remove-access button that deletes the membership row (access ends on the next request).
- [ ] Optional: let `client_editor`s invite viewers to their own client.

### Phase 9 (optional): Subdomains

Only once path-based routing is solid.

- [ ] In the domain's DNS, add a wildcard `*.yourdomain.com` record. On Vercel, add the wildcard domain to the project.
- [ ] In `proxy.ts`, read the `host` header. If it's `slug.yourdomain.com`, `NextResponse.rewrite` to `/slug/…`. The pages don't change.
- [ ] Set the Supabase auth cookie domain to `.yourdomain.com` if you want one login across subdomains. Otherwise each subdomain logs in separately, which also isolates clients more strongly.
- [ ] Add each subdomain to Supabase's allowed redirect URLs.

---

## 4. Testing that clients can't see each other

Run this checklist after Phase 4 and again after any data-access change.

- [ ] Create a dummy client (`test-band`) with a few rows in each table, and a user who belongs **only** to it.
- [ ] As that user:
  - [ ] `/circa-waves/dashboard` → 404
  - [ ] `/admin/...` → redirect or 404
  - [ ] Calling the Circa Waves calendar action directly (e.g. changing the slug in a form post) → rejected
  - [ ] `POST /api/admin/discoveries/review` → 401/403
- [ ] In the browser console, with the anon key and that user's session:
  `supabase.from("tiktok_videos").select("client_id")` → only `test-band` IDs.
- [ ] A `client_viewer` can't add calendar posts, either through the UI or by posting to the action directly.
- [ ] Logged out: every route except `/login` redirects.
- [ ] Search the code to confirm the service key is server-only: `grep -rn supabaseAdmin app components`. It should only appear under `app/admin` and `app/api/admin`.

---

## 5. Suggested order and time estimates

| Week | Work | Result |
|---|---|---|
| 1 | Phases 0–2 | Real logins and `client_id` everywhere, with Circa Waves still working |
| 2 | Phases 3–4 | RLS turned on and `/[client]/…` routes, so the portal works for one client |
| 3 | Phases 5–6 | Per-client calendar and pipeline, so a second client can be onboarded by hand |
| 4 | Phases 7–8 | Fan Interests board and self-service invites |
| Later | Phase 9, `calendar_posts` migration | Subdomains and no more Sheets |

## 6. Further reading

- Supabase docs: *Row Level Security*, *Server-Side Auth → Next.js* (`@supabase/ssr`), *Custom Claims & RBAC*, *Inviting users*
- Next.js docs: *Authentication* guide, *Multi-tenant* guide, *Dynamic Routes*
- Vercel Platforms Starter Kit (`github.com/vercel/platforms`): reference for subdomain routing
- Azure Architecture Center: *Tenancy models for SaaS*, for background on shared tables vs schema-per-tenant vs database-per-tenant
