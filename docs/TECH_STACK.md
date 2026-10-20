# Tech Stack & Learning Guide

A stock-take of everything in this project as of 20 October 2026: what each piece is, where it lives, how the pieces connect, how to debug them, and what to learn to understand them fully.

The README describes the original YouTube + interview workflow. Since then the project has grown an Instagram pipeline, a TikTok dashboard, password protection and scheduled jobs. This guide covers all of it.

---

## 1. The big picture

The project is really **three things sharing one database**:

1. **Command-line scripts** (`scripts/`): Node.js programs you (or cron) run by hand. They talk to outside services, write to Supabase and move files around on your Mac.
2. **A web app** (`app/`, `components/`, `lib/`): a Next.js site for reviewing discoveries and viewing TikTok stats.
3. **A Supabase database**: the shared memory between the two.

```text
           OUTSIDE SERVICES                    YOUR MAC                         SUPABASE (Postgres)
  ┌────────────────────────────┐   ┌──────────────────────────────┐   ┌───────────────────────────────┐
  │ YouTube Data API           │──▶│ internetSearch.js            │──▶│ content_discoveries           │
  │ Apify (Instagram scraper)  │──▶│ instagramSearch.js           │──▶│ instagram_discoveries         │
  │ Apify (TikTok scraper)     │──▶│ syncTikTokStats.js           │──▶│ tiktok_videos / _snapshots    │
  │ OpenAI                     │◀─▶│ tagContentPillars.js         │◀─▶│ tiktok_videos.content_pillar  │
  └────────────────────────────┘   │                              │   │ discovery_search_state        │
                                   │ Next.js web app (localhost)  │◀─▶│ (review: approve / reject)    │
                                   │                              │   │                               │
                                   │ importDiscoveries.js         │──▶│ circa_full_content            │
                                   │ downloadContent.js ─ yt-dlp  │◀──│ (the master library)          │
                                   │        │                     │   └───────────────────────────────┘
                                   │        ▼                     │
                                   │ input/<category>/ videos     │
                                   │        │ (interviews only)   │
                                   │        ▼                     │
                                   │ ffmpeg → OpenAI → ffmpeg     │──▶ output/ audio, transcripts,
                                   │ (processInterviews.js)       │    metadata, clips
                                   └──────────────────────────────┘
```

---

## 2. The stack, layer by layer

| Layer | What it is | Where it's used | Why it's here |
|---|---|---|---|
| **JavaScript** | The programming language for everything | Every `.js` / `.jsx` file | — |
| **Node.js** (v22) | Runs JavaScript outside a browser | All of `scripts/`, and it runs Next.js | Lets scripts read files, call APIs, launch `yt-dlp`/`ffmpeg` |
| **ES Modules** | `import`/`export` syntax | `"type": "module"` in `package.json` | Modern module system. `keepAlive.cjs` is the one old-style (`require`) file — the `.cjs` extension is what allows that |
| **npm** | Package manager | `package.json`, `package-lock.json`, `node_modules/` | Installs the libraries below |
| **Next.js 16** (App Router) | Web framework built on React | `app/`, `proxy.ts` | Pages, API routes and server-side database calls in one project |
| **React 19** | UI library | `components/*.jsx` | Builds the interactive reviewer screens |
| **CSS Modules** | Per-component CSS files | `*.module.css` | Styles that only apply to one component, so class names never clash |
| **next/font** | Font loading | `app/fonts.js` | Self-hosts Work Sans and Caprasimo from Google Fonts |
| **TypeScript 7** | Typed JavaScript | Only `proxy.ts` (and `tsconfig.json`) | Barely used — `strict: false`, everything else is plain JS |
| **Supabase** | Hosted Postgres database + REST API | `lib/supabaseAdmin.js`, every script | Stores discoveries, review decisions, the library and TikTok stats |
| **SQL / Postgres** | Database language | `supabase/migrations/*.sql` | Defines tables and columns |
| **YouTube Data API v3** | Google's search API | `scripts/internetSearch.js` (raw `fetch`) | Finds new YouTube videos |
| **Apify** | Paid scraping platform ("actors") | `instagramSearch.js` (`apify/instagram-scraper`), `syncTikTokStats.js` (`clockworks/tiktok-scraper`) | Instagram and TikTok have no usable public API, so Apify scrapes them for you |
| **OpenAI API** | AI models | `transcribe.js` (`whisper-1`), `extractMetadata.js` + `tagContentPillars.js` (`gpt-5-mini`), `selectClips.js` (`gpt-5.5`) | Transcription, summarising, picking clip moments, classifying captions |
| **yt-dlp** | Command-line video downloader (Homebrew) | `downloadContent.js` | Downloads YouTube/Instagram videos. Uses your **Firefox cookies** to get past sign-in checks |
| **FFmpeg / ffprobe** | Command-line audio/video toolkit (Homebrew) | `extractAudio.js`, `processClips.js`, `downloadContent.js` | Extracts audio, cuts clips, checks codecs |
| **dotenv** | Loads `.env` into `process.env` | Top of every script | Keeps API keys out of the code |
| **HTTP Basic Auth** | Browser username/password prompt | `proxy.ts` | Password-protects the whole site |
| **cron** + bash | macOS job scheduler | `crontab -l`, `~/scripts/run-*.sh`, logs in `~/logs/` | Runs TikTok sync, YouTube discovery and the Supabase keep-alive automatically |
| **Git / GitHub** | Version control | `github.com/samrourke/social-content-engine` | History of every change |

**Installed but not used:** `next-auth` (nothing imports it — `proxy.ts` does the auth instead).
**Leftover test files:** `index.js` (an early transcription test) and `response.json`.

---

## 3. How the web app works

This is the part most likely to feel like magic, so here's the request flow.

```text
Browser ──▶ proxy.ts ──▶ app/page.jsx (runs on the SERVER) ──▶ Supabase
  (checks SITE_USER /         │ fetches the next pending discovery + counts
   SITE_PASSWORD)             ▼
                     components/DiscoveryReviewer.jsx (runs in the BROWSER, "use client")
                              │ you click Approve / Reject / Undo
                              ▼
                     fetch("/api/discoveries/review")  ──▶ app/api/discoveries/review/route.js
                                                            (SERVER) updates Supabase,
                                                            returns the next discovery
```

Key ideas to understand:

- **Server vs client components.** Files in `app/` are *server components* by default: they run on the Node server, so they can safely use the secret `SUPABASE_SERVICE_ROLE_KEY`. Files starting with `"use client"` (the reviewers, the nav) run in the browser and must never touch secrets. They ask the server to do things via `fetch()` to an API route.
- **File-based routing.** The folder path is the URL. `app/tiktok/page.jsx` → `/tiktok`. `app/api/instagram/review/route.js` → `POST /api/instagram/review`.
- **`export const dynamic = "force-dynamic"`** means "query the database on every visit" rather than baking data in at build time.
- **`lib/`** holds shared server code (database queries, Instagram scoring rules) so pages and API routes don't duplicate it.
- **`config/site.js`** drives the nav links; **`config/archiveCategories.js`** is the single source of truth for archive categories and their folders.
- **`@/`** in imports (e.g. `@/config/site`) is a shortcut for the project root, set in `jsconfig.json`/`tsconfig.json`.
- **`proxy.ts`** is what Next.js 16 calls "middleware": it runs before every request. Here it checks a Basic Auth header against `SITE_USER`/`SITE_PASSWORD`.

| Page | Server file | Client component | API routes |
|---|---|---|---|
| `/` YouTube review | `app/page.jsx` | `DiscoveryReviewer.jsx` | `/api/discoveries/review`, `/api/discoveries/undo` |
| `/instagram` review | `app/instagram/page.js` | `InstaReviewer.jsx` | `/api/instagram/review`, `/api/instagram/undo` |
| `/tiktok` dashboard | `app/tiktok/page.jsx` | `TiktokDashboard.jsx` | none (read-only) |

---

## 4. How the scripts work

### Discovery → library → archive

| Step | Script | Reads | Writes |
|---|---|---|---|
| 1a | `internetSearch.js` | YouTube API, `discovery_search_state` | `content_discoveries` (pending) |
| 1b | `instagramSearch.js` | Apify, `discovery_search_state` | `instagram_discoveries` (pending / auto_rejected / split), raw JSON in `output/instagram/` |
| 2 | *(web app review)* | discoveries tables | `review_status`, `archive_category`, `carousel_slides` |
| 3 | `importDiscoveries.js` | approved rows from both discovery tables | `circa_full_content` |
| 4 | `downloadContent.js` | `circa_full_content` rows not yet downloaded | `input/<category>/…<uuid>.mp4` |

`instagramSearch.js` has the most options (`--dry-run`, `--limit`, `--backlog`, `--only`, `--from-file`, `--rescore`, `--refresh`); the comment block at the top of the file lists them. Its scoring rules live separately in `lib/instagramScoring.js` so they can be tuned without re-scraping (`--from-file … --rescore`).

Instagram carousels are split into one review row per video slide (migration 005). Instagram's video links expire after a few days, so `--refresh` renews them for pending rows.

### Interview processing (`node scripts/processInterviews.js`)

`extractAudio` (ffmpeg → `output/audio/`) → `transcribe` (Whisper → `output/transcripts/`) → `extractMetadata` (GPT → `output/metadata/`) → `selectClips` (GPT → `output/clip-analysis/`) → `processClips` (ffmpeg → `output/clips/`).

Each step reads the previous step's output folder and skips files already done, so you can rerun it safely.

### Housekeeping

- `findDuplicateVideos.js`: hashes every video in `input/` to find identical files.
- `removeOrphanedDownloads.js`: moves files whose UUID isn't in `circa_full_content` to `output/orphaned-duplicates/`.
- `removeQuarantine.js`: deletes that quarantine folder (only with `--delete`).
- `keepAlive.cjs`: pings Supabase so the free-tier project doesn't pause.

### TikTok

- `syncTikTokStats.js`: Apify → `tiktok_profile_snapshots` (follower counts over time) and `tiktok_videos` (per-video stats).
- `tagContentPillars.js`: sends untagged captions to GPT and saves a `content_pillar`.

### What runs automatically

`crontab -l` shows three hourly jobs. Each calls a wrapper in `~/scripts/` that checks a timestamp file in `~/logs/` and only does real work when it's due:

| Wrapper | Runs | Due | Log |
|---|---|---|---|
| `run-weekly-sync.sh` | `syncTikTokStats.js` | weekly, after Monday 09:00 | `~/logs/syncTikTokStats.log` |
| `run-fortnightly-discovery.sh` | `internetSearch.js` | every 14 days | `~/logs/internetSearch.log` |
| `run-supabase-keepalive.sh` | `keepAlive.cjs` | every 3 days | `~/logs/supabaseKeepAlive.log` |

Everything else (Instagram search, import, download, interview processing, pillar tagging) is run by hand. **Cron only runs while your Mac is awake.**

---

## 5. The database

| Table | Purpose | Defined in |
|---|---|---|
| `content_discoveries` | YouTube candidates awaiting review | **not in the repo** (created in the Supabase dashboard) |
| `instagram_discoveries` | Instagram candidates (incl. auto-rejected and split carousels) | migrations 003–005 |
| `discovery_search_state` | Where each search last got to, so reruns only fetch new posts | **not in the repo** |
| `circa_full_content` | The master library of approved sources; its `id` is the UUID in every downloaded filename | **not in the repo** (004 adds a column) |
| `tiktok_profile_snapshots` | Follower/like counts over time | migration 002 |
| `tiktok_videos` | Per-video TikTok stats + content pillar | migration 002 |

`review_status` values: `pending`, `approved`, `rejected`, and for Instagram also `auto_rejected` and `split`.

The migrations start at `002`: there is no `001` for the three original tables. If the Supabase project were ever lost, the repo alone couldn't rebuild it (see section 8).

---

## 6. Secrets & environment (`.env`)

`.env` is git-ignored and has never been committed. Never paste its values anywhere public.

| Variable | Used by | Notes |
|---|---|---|
| `OPENAI_API_KEY` | transcription, metadata, clips, pillar tagging | Costs money per call |
| `NEXT_PUBLIC_SUPABASE_URL` | everything | `NEXT_PUBLIC_` means Next.js *may* expose it to the browser. Fine for a URL |
| `SUPABASE_SERVICE_ROLE_KEY` | everything | **Admin key that bypasses all database security.** Must only be used server-side, which it currently is |
| `YOUTUBE_API_KEY` | `internetSearch.js` | Daily quota from Google |
| `APIFY_API_TOKEN` | Instagram + TikTok scrapers | Costs credits per run |
| `TIKTOK_USERNAME` | `syncTikTokStats.js` | |
| `SITE_USER`, `SITE_PASSWORD` | `proxy.ts` | Site login |

---

## 7. Debugging playbook

**First questions for any problem:** *Which of the three parts is it (script, web app, database)? What's the exact error message, and which file and line does it name?*

| Symptom | Where to look |
|---|---|
| A script crashes | Read the stack trace from the top: the first `file:///…/scripts/x.js:LINE` line is usually the culprit. Common causes: a missing `.env` value, an outside service down, or a renamed column |
| A scheduled job seems not to run | `tail -50 ~/logs/<name>.log`, then `cat ~/logs/.<name>.last` (Unix time; `date -r <number>` makes it readable). Was the Mac awake? |
| Web page shows an error / blank | The terminal running `npm run dev` shows server errors. The browser's DevTools Console shows client errors; the Network tab shows API route responses |
| Approve/Reject does nothing | DevTools → Network → click the `review` request → Response tab |
| Data looks wrong | Supabase dashboard → Table Editor. Check the row directly before suspecting the code |
| `yt-dlp` fails | Run the same URL by hand: `yt-dlp -v <url>`. Often fixed with `brew upgrade yt-dlp`, or by logging into the site again in Firefox |
| `ffmpeg` fails | Run the command it printed by hand; ffmpeg's own error is usually very specific |
| OpenAI / Apify error | Check billing and credits on their dashboards first, then the model or actor name. A `429 You have no credits remaining` from OpenAI means the account balance is empty: top up at platform.openai.com → Settings → Billing and rerun |
| Instagram slide won't play in the reviewer | Video link expired: `node scripts/instagramSearch.js --refresh` |
| Site asks for a password repeatedly | `SITE_USER` / `SITE_PASSWORD` in `.env`; restart the dev server after changing `.env` |

Useful habits:

- Add `console.log(variable)` just before the line that fails, rerun, and read what's actually there.
- Several scripts have a dry-run mode (`DRY_RUN` constant or `--dry-run` flag). Use it before anything that writes or moves files.
- `git diff` and `git log -p <file>` show what changed recently. "It worked last week" bugs are usually in there.
- When you ask Claude to fix something, paste the full error and the log path. It saves a lot of guessing.

---

## 8. Issues found during this stock-take

Real problems, worst first:

1. ~~**The TikTok sync has been failing since 23 September.**~~ *Fixed 20 Oct.* `scripts/syncTikTokStats.js` used `supabase` before creating it (`ReferenceError: Cannot access 'supabase' before initialization` in `~/logs/syncTikTokStats.log`).
2. ~~**YouTube discovery is being blocked by that failure.**~~ *Fixed 20 Oct.* `~/scripts/run-fortnightly-discovery.sh` was writing its "last attempt" stamp to the TikTok job's `.syncTikTokStats.attempt`, so the failing TikTok retries kept discovery throttled. It now uses `.internetSearch.attempt`.
3. **`findDuplicateVideos.js` and `removeOrphanedDownloads.js` won't start.** Both import `../config/videoDirectories.js`, which doesn't exist. `VIDEO_DIRECTORIES` now lives in `config/archiveCategories.js`.
4. **The original tables have no migration.** `content_discoveries`, `circa_full_content` and `discovery_search_state` exist only in Supabase. A `001_initial.sql` exported from the dashboard would make the database rebuildable.
5. **The README is out of date.** It doesn't cover Instagram, TikTok, `proxy.ts` or cron, and it refers to `config/categoryDirectories.js`, which no longer exists.
6. **Minor tidy-ups:** unused `next-auth` dependency; leftover `index.js` and `response.json`; `config/site.js` still contains template placeholders ("Content Farm", example.co.uk).

---

## 9. Learning path

In this order. Each step makes the next one make sense. Bold items matter most for this project.

1. **Modern JavaScript.** Variables, functions, arrays and objects, **`async`/`await` and Promises** (used everywhere here), `import`/`export`, destructuring (`const { data, error } = …`).
   → [javascript.info](https://javascript.info) (parts 1 and the "Promises, async/await" chapter) · [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
2. **Node.js & the terminal.** Running scripts, `process.env`, `process.argv`, reading files with `fs`, running other programs with `child_process` (how `yt-dlp`/`ffmpeg` are called), npm.
   → [nodejs.org/en/learn](https://nodejs.org/en/learn)
3. **HTTP & APIs.** Requests and responses, GET vs POST, JSON, status codes, headers, API keys. Then practise with your browser's DevTools Network tab on this app.
   → [MDN: An overview of HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)
4. **SQL & Supabase.** Tables, columns, rows, `select`/`insert`/`update`/`where`, indexes; then how `supabase.from("x").select().eq()` maps onto SQL.
   → [Supabase docs](https://supabase.com/docs) (Database + JavaScript client reference) · [SQLBolt](https://sqlbolt.com) for SQL basics
5. **React.** Components, props, **state (`useState`)**, events. Read `DiscoveryReviewer.jsx` alongside it.
   → [react.dev/learn](https://react.dev/learn)
6. **Next.js App Router.** Routing, **server vs client components**, route handlers (API routes), middleware/proxy.
   → [nextjs.org/learn](https://nextjs.org/learn) (the official free course)
7. **The tools.** Learn as needed rather than up front:
   - yt-dlp: [github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) README (options section)
   - FFmpeg: [ffmpeg.org/documentation](https://ffmpeg.org/documentation.html)
   - Apify: [docs.apify.com](https://docs.apify.com) (Actors, datasets, API client for JS)
   - OpenAI: [platform.openai.com/docs](https://platform.openai.com/docs) (speech-to-text, structured outputs)
   - YouTube API: [developers.google.com/youtube/v3](https://developers.google.com/youtube/v3) (search.list, quotas)
   - cron: [crontab.guru](https://crontab.guru) to decode schedules
8. **Git.** Commits, `log`, `diff`, branches, reverting a bad change.
   → [git-scm.com/book](https://git-scm.com/book/en/v2) chapters 1–3

### Practice exercises using this codebase

Doing these teaches more than reading:

1. Trace one YouTube video from search to downloaded file: find its row in each Supabase table and its file in `input/`.
2. Add a `console.log` to `app/api/discoveries/review/route.js`, approve something, and find your log (hint: it shows in the terminal, not the browser).
3. Fix issue #3 above yourself: it's a one-line import change in each file.
4. Run `instagramSearch.js --from-file <a file in output/instagram> --rescore --dry-run` after changing a weight in `lib/instagramScoring.js`, and see how scores move.
5. Write the SQL for `001_initial.sql` by reading the columns of the original tables in the Supabase dashboard.
