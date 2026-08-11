# Circa Waves Content Engine

A content discovery, archiving and interview-processing system for the Circa Waves video archive.

The primary purpose of this project is to **discover, review, categorise and archive Circa Waves video material** from online sources.

The system maintains a structured database of source material alongside a locally organised video archive.

A secondary pipeline processes **interview content only**, automatically extracting audio, generating transcripts and metadata, identifying promising short-form moments, and cutting candidate clips.

Other forms of content — including live footage, fan footage, backstage material, acoustic sessions and official videos — are archived for later human review and editing rather than automatically processed into clips.

---

# System Overview

The project consists of two main workflows:

1. **Content Discovery & Archive**
2. **Interview Processing**

## Content Discovery & Archive

```text
YouTube
   │
   ▼
internetSearch.js
   │
   ▼
content_discoveries
   │
   ▼
Human Review
   │
   ▼
importDiscoveries.js
   │
   ▼
circa_full_content
   │
   ▼
downloadContent.js
   │
   ▼
Local Video Archive
```

This is the primary workflow.

Its purpose is to continually discover Circa Waves material, review it manually, store useful sources in Supabase and download approved material into an organised local archive.

## Interview Processing

```text
input/interviews/
       │
       ▼
 extractAudio.js
       │
       ▼
  transcribe.js
       │
       ▼
extractMetadata.js
       │
       ▼
 selectClips.js
       │
       ▼
 processClips.js
```

These stages can be run together using:

```bash
node scripts/processInterviews.js
```

The interview pipeline is deliberately limited to material stored in `input/interviews/`.

Live performances, fan footage, backstage footage, studio sessions and official/promotional material are not automatically processed into clips.

---

# Tech Stack

The project currently uses:

- **Node.js** — scripts and pipeline orchestration
- **Supabase** — source database and discovery state
- **YouTube Data API** — content discovery
- **yt-dlp** — downloading source videos
- **FFmpeg** — audio extraction and video clipping
- **OpenAI API** — transcription, metadata extraction and clip analysis

A separate Next.js interface is used for manually reviewing discovered content before it enters the main archive.

---

# Project Structure

The project broadly follows this structure:

```text
project/
│
├── config/
│   ├── categoryDirectories.js
│   └── videoDirectories.js
│
├── input/
│   ├── interviews/
│   ├── professional-live/
│   ├── fan-live/
│   ├── backstage-tour/
│   ├── studio-acoustic/
│   ├── official-promo/
│   └── other/
│
├── output/
│   ├── audio/
│   ├── transcripts/
│   ├── metadata/
│   ├── clip-analysis/
│   ├── clips/
│   └── orphaned-duplicates/
│
├── scripts/
│   ├── internetSearch.js
│   ├── importDiscoveries.js
│   ├── downloadContent.js
│   │
│   ├── findDuplicateVideos.js
│   ├── removeOrphanedDownloads.js
│   ├── removeQuarantine.js
│   │
│   ├── processInterviews.js
│   ├── extractAudio.js
│   ├── transcribe.js
│   ├── extractMetadata.js
│   ├── selectClips.js
│   └── processClips.js
│
├── .env
└── README.md
```

`input/` contains the source video archive.

`output/` contains generated or temporary data such as transcripts, metadata, clip analysis and generated clips.

---

# Archive Categories

Archive category names and their corresponding filesystem directories are centrally defined in:

```text
config/categoryDirectories.js
```

The current archive structure is:

| Archive Category  | Directory                  |
| ----------------- | -------------------------- |
| Interview         | `input/interviews/`        |
| Professional Live | `input/professional-live/` |
| Fan Live          | `input/fan-live/`          |
| Backstage / Tour  | `input/backstage-tour/`    |
| Studio / Acoustic | `input/studio-acoustic/`   |
| Official / Promo  | `input/official-promo/`    |
| Other             | `input/other/`             |

Scripts that need to understand the archive structure import the shared configuration rather than maintaining independent directory lists.

This prevents archive paths from drifting between scripts as categories change.

---

# Database

Supabase is used as the source of truth for the content library and discovery system.

The main tables used by the current workflow are:

## `circa_full_content`

The main content archive.

Each row represents a known source of Circa Waves material.

Relevant fields used by the current scripts include:

```text
id
title
source_url
normalised_source_url
source_location
description
archive_category
processing_status
download_status
downloaded_filename
downloaded_at
download_error
updated_at
```

Downloaded filenames contain the database UUID, allowing files on disk to be associated with their corresponding Supabase record.

Example:

```text
interviews/example-interview-550e8400-e29b-41d4-a716-446655440000.mp4
```

This relationship is also used by archive maintenance scripts.

---

## `content_discoveries`

Temporary staging area for newly discovered online material.

YouTube results are inserted here before entering the main archive.

Discoveries can then be manually:

```text
pending
approved
rejected
```

Approved discoveries are eventually imported into `circa_full_content`.

Relevant fields include:

```text
platform
platform_video_id
title
description
source_url
normalised_source_url
channel_name
channel_id
published_at
thumbnail_url
search_query
discovery_score
suggested_content_type
review_status
archive_category
imported_at
```

---

## `discovery_search_state`

Tracks progress through YouTube search results.

This allows discovery searches to continue through pagination rather than repeatedly processing the first pages of the same searches.

Search state is stored separately for each search query.

---

# Discovery Pipeline

## `internetSearch.js`

Searches YouTube for new Circa Waves material using the YouTube Data API.

Current search queries include variations such as:

```text
Circa Waves
Circa Waves interview
Circa Waves live
Circa Waves backstage
Circa Waves festival
Circa Waves acoustic
Circa Waves session
Circa Waves BBC
Circa Waves NME
Circa Waves Radio X
```

The script:

1. Searches YouTube.
2. Filters results for Circa Waves relevance.
3. Normalises YouTube URLs.
4. Checks the main archive for existing source URLs.
5. Checks `content_discoveries` for previously discovered videos.
6. Calculates a basic discovery score.
7. Suggests a broad content type.
8. Inserts genuinely new results into `content_discoveries`.
9. Maintains pagination state through `discovery_search_state`.

Run with:

```bash
node scripts/internetSearch.js
```

Discovery does **not** automatically add material to the permanent archive.

All discoveries pass through human review first.

---

# Human Review

New discoveries are reviewed manually using the project's review interface.

The reviewer decides whether a source should be:

- approved
- rejected

Approved content is also assigned an archive category.

This human review stage is intentional.

Automated discovery is useful for finding large quantities of potential material, but human judgement determines whether that material is actually useful enough to archive.

---

# Importing Discoveries

## `importDiscoveries.js`

Moves approved discoveries from `content_discoveries` into `circa_full_content`.

Run with:

```bash
node scripts/importDiscoveries.js
```

The script only considers discoveries where:

```text
review_status = approved
imported_at = null
```

Before importing, it retrieves existing `normalised_source_url` values from `circa_full_content`.

This provides duplicate protection at the import boundary.

It also updates the in-memory URL set during the import, preventing two discoveries containing the same normalised URL from entering the archive during the same batch.

After successful import, the original discovery receives an `imported_at` timestamp.

The script contains a `DRY_RUN` option that can be enabled when testing import behaviour.

---

# Downloading Archive Material

## `downloadContent.js`

Downloads pending archive sources using `yt-dlp`.

Run with:

```bash
node scripts/downloadContent.js
```

The script queries `circa_full_content` for records with a download status of:

```text
pending
failed
```

Downloads are processed in batches.

The current batch size is configured inside the script.

Each video's archive category determines its output directory using the shared category configuration.

For example:

```text
Interview
    ↓
input/interviews/

Professional Live
    ↓
input/professional-live/

Fan Live
    ↓
input/fan-live/
```

Downloaded filenames contain:

```text
sanitised-title + database-UUID
```

This guarantees uniqueness even when multiple videos have identical titles.

After a successful download, Supabase is updated with:

```text
download_status
downloaded_filename
downloaded_at
updated_at
```

If downloading fails, the error is recorded and the source receives:

```text
download_status = failed
```

Failed downloads can therefore be retried on subsequent runs.

The script prints a summary showing:

```text
Attempted
Successful
Failed
```

---

# Archive Maintenance

Several scripts exist specifically to keep the local archive consistent with the Supabase database.

These scripts should generally be considered maintenance tools rather than part of the normal discovery pipeline.

---

## `findDuplicateVideos.js`

Checks the local archive for byte-for-byte duplicate videos.

Run with:

```bash
node scripts/findDuplicateVideos.js
```

The script recursively scans the configured video directories and calculates a **SHA-256 hash** for every video.

Files with identical SHA-256 hashes contain identical binary data and are therefore exact duplicates regardless of:

- filename
- directory
- title
- database record

The script currently recognises common video formats including:

```text
.mp4
.mov
.mkv
.webm
.avi
.m4v
```

Duplicate groups are printed to the terminal and written to:

```text
output/duplicate-videos.json
```

This script only identifies duplicates. It does not automatically delete them.

---

## `removeOrphanedDownloads.js`

Checks whether downloaded archive files still have corresponding records in `circa_full_content`.

Run with:

```bash
node scripts/removeOrphanedDownloads.js
```

Because downloaded filenames contain the Supabase UUID, the script can extract the ID from each filename and compare it with the current database.

Files are classified as:

```text
retained
orphaned
unmatched
```

### Retained

The UUID exists in `circa_full_content`.

The file remains untouched.

### Orphaned

The filename contains a valid UUID, but that UUID no longer exists in the database.

Instead of deleting these files immediately, they are moved to:

```text
output/orphaned-duplicates/
```

The original archive directory structure is preserved inside quarantine.

### Unmatched

The script could not extract a recognised UUID from the filename.

These files are reported but left untouched.

This is deliberately conservative: files that cannot safely be associated with a database record should not be automatically removed.

The script also writes a JSON report describing the cleanup operation.

A `DRY_RUN` option can be enabled to inspect what would happen without moving files.

---

## `removeQuarantine.js`

Permanently removes files previously placed in:

```text
output/orphaned-duplicates/
```

Running:

```bash
node scripts/removeQuarantine.js
```

does **not** delete anything.

Permanent deletion requires the explicit flag:

```bash
node scripts/removeQuarantine.js --delete
```

This provides a second opportunity to inspect quarantined material before permanently removing it.

---

# Interview Processing

Interview processing is a secondary workflow within the project.

Only videos stored in:

```text
input/interviews/
```

are automatically processed.

The entire pipeline can be run using:

```bash
node scripts/processInterviews.js
```

`processInterviews.js` sequentially runs:

```text
extractAudio()
transcribe()
extractMetadata()
selectClips()
processClips()
```

Each stage generally checks for existing output before processing a file, allowing the pipeline to be rerun without unnecessarily repeating completed work.

---

# Audio Extraction

## `extractAudio.js`

Extracts audio from interview videos using FFmpeg.

Input:

```text
input/interviews/*.mp4
```

Output:

```text
output/audio/*.mp3
```

Before processing, the script compares existing MP3 files with the available interview videos.

Videos that already have matching audio files are skipped.

Audio is converted to a transcription-friendly format:

```text
16 kHz
mono
64 kbps MP3
```

---

# Transcription

## `transcribe.js`

Transcribes extracted interview audio using the OpenAI transcription API.

Input:

```text
output/audio/*.mp3
```

Output:

```text
output/transcripts/*.json
```

Existing transcript filenames are checked before processing, so already-transcribed audio is skipped.

The transcript is stored as verbose JSON so that timestamped transcript segments remain available for later clip extraction.

These timestamps allow selected transcript phrases to be mapped back to locations in the original video.

---

# Metadata Extraction

## `extractMetadata.js`

Uses an OpenAI model to generate structured metadata from interview transcripts.

Input:

```text
output/transcripts/*.json
```

Output:

```text
output/metadata/*.json
```

The metadata schema currently includes:

```text
title
summary
searchDescription
videoType
tone
places
topics
keywords
people
entities
contentSignals
tags
```

Metadata extraction is deliberately separated from clip selection.

This stage is instructed to extract **factual metadata only**.

It should not:

- identify TikTok clips
- score viral potential
- suggest edits
- invent information

The resulting metadata is intended to support future archive search, filtering, categorisation and clip analysis.

---

# Clip Selection

## `selectClips.js`

Analyses interview transcripts and identifies promising sections for short-form video.

Input:

```text
output/transcripts/
output/metadata/
```

Output:

```text
output/clip-analysis/
```

The script looks specifically for self-contained interview moments that could work as:

- TikToks
- Instagram Reels
- YouTube Shorts

Candidate formats include:

```text
confession
funny-story
surprising-detail
behind-the-scenes
emotional-moment
strong-opinion
career-insight
fan-interest
other
```

A strong candidate should contain:

- an early hook
- a clear reason to continue watching
- a payoff, reveal, punchline or useful insight
- minimal dependency on earlier context
- a natural beginning and ending
- a self-contained idea

The model is explicitly instructed not to return ordinary interview answers simply because they are informative.

Candidates below the configured quality threshold are rejected.

If an interview contains no sufficiently strong moments, the resulting clip array can be empty.

For accepted candidates, the analysis includes information such as:

```text
title
topic
format
viralScore
startSnippet
endSnippet
hook
hookReason
reasonToWatch
payoff
takeaway
onScreenText
captionIdea
estimatedDuration
requiresContext
confidence
```

`startSnippet` and `endSnippet` are copied from the transcript and later used to locate the corresponding timestamped transcript segments.

---

# Clip Processing

## `processClips.js`

Cuts selected interview moments from their original source videos using FFmpeg.

Input includes:

```text
input/interviews/
output/transcripts/
output/metadata/
output/clip-analysis/
```

Output:

```text
output/clips/
```

Each source receives its own output directory.

For example:

```text
output/clips/
└── interview-name-uuid/
    ├── clip_1_example-title.mp4
    └── clip_2_another-title.mp4
```

The script finds the transcript segments corresponding to each candidate's `startSnippet` and `endSnippet`.

Those segments provide the actual video timestamps.

Padding is added around the selected section before FFmpeg cuts the clip so the resulting edit has some room around the AI-selected boundaries.

Existing non-empty clip directories are treated as already processed, preventing clips from being regenerated unnecessarily.

Generated clips are **candidates for human review**, not automatically publishable social content.

---

# Normal Workflow

A typical archive update looks like:

```text
1. Search for new content
        ↓
2. Review discoveries
        ↓
3. Import approved discoveries
        ↓
4. Download pending archive material
        ↓
5. Check archive integrity when required
```

Commands:

```bash
node scripts/internetSearch.js

# Review discoveries through the web interface

node scripts/importDiscoveries.js

node scripts/downloadContent.js
```

Archive maintenance can then be run when necessary:

```bash
node scripts/findDuplicateVideos.js

node scripts/removeOrphanedDownloads.js
```

Quarantined files should be manually inspected before running:

```bash
node scripts/removeQuarantine.js --delete
```

---

# Interview Workflow

Once interview material has been downloaded into:

```text
input/interviews/
```

run:

```bash
node scripts/processInterviews.js
```

This performs:

```text
Interview video
      ↓
Audio
      ↓
Transcript
      ↓
Metadata
      ↓
Clip analysis
      ↓
Candidate video clips
```

The generated clips should then be manually reviewed and edited as necessary.

---

# Environment Variables

The current scripts require environment variables including:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
YOUTUBE_API_KEY=
OPENAI_API_KEY=
```

These should be stored in:

```text
.env
```

The `.env` file must not be committed to Git.

---

# External Dependencies

The project expects the following command-line tools to be available on the system.

## FFmpeg

Used for:

- audio extraction
- clip cutting
- video processing

Check installation with:

```bash
ffmpeg -version
```

## yt-dlp

Used to download source video files.

Check installation with:

```bash
yt-dlp --version
```

`downloadContent.js` currently uses browser cookies from Firefox when invoking `yt-dlp`.

---

# Safety and Data Integrity

The archive contains material collected over a long period, so destructive operations should be conservative.

The current system follows several safeguards:

### Duplicate prevention

Duplicate URLs are checked during discovery and again before approved discoveries enter the main archive.

### Unique filenames

Downloaded filenames contain their Supabase UUID.

### Existing-file checks

Download and processing scripts generally skip work that already has corresponding output.

### Duplicate detection

SHA-256 hashing can detect exact duplicate files independently of filenames.

### Quarantine before deletion

Orphaned files are moved out of the archive rather than immediately deleted.

### Explicit permanent deletion

Quarantine deletion requires the `--delete` command-line flag.

### Dry-run support

Maintenance/import scripts that can modify significant amounts of data include dry-run behaviour where appropriate.

---

# Design Principles

## Supabase is the archive index

`circa_full_content` represents the structured catalogue of known source material.

The local filesystem stores the actual downloaded media.

The database UUID embedded in downloaded filenames provides a link between the two.

## Human review remains part of the system

Discovery is automated.

Archive selection is not.

The discovery engine is intended to find potential material at scale, while a human decides what is useful and how it should be categorised.

## Automation stops where judgement becomes more valuable

Interview content works reasonably well with transcript-based automated analysis because spoken content provides structured semantic information.

Other material such as:

- live footage
- music videos
- fan footage
- backstage video
- studio/acoustic performances

is primarily visual or musical.

That material is therefore archived and left for human editorial judgement rather than being automatically clipped.

## Files should not be silently destroyed

Potentially orphaned material is quarantined.

Unknown files are left alone.

Permanent deletion requires an explicit action.

## Shared configuration should define archive structure

Category-to-directory mappings are defined centrally rather than independently inside individual scripts.

When the archive structure changes, configuration should be updated rather than maintaining duplicate directory lists throughout the codebase.

---

# Current Scope

The project's main priority is:

> **Build and maintain a comprehensive, organised and searchable archive of Circa Waves video material.**

The discovery system helps locate material that may otherwise be difficult to find manually.

Supabase provides the structured catalogue.

The local archive preserves the actual source media.

Automated interview processing adds another layer by making spoken archive material searchable and identifying potentially useful short-form moments.

The project is **not currently intended to automatically generate finished social media content from every archived video**.

Human editorial judgement remains an important part of the workflow.

---

# Future Development

Potential future improvements include:

- improved archive search
- surfacing transcript metadata through a web interface
- linking transcripts and metadata directly to `circa_full_content`
- better visibility into download/archive status
- additional discovery sources beyond YouTube
- improved interview clip ranking
- human clip-review tooling
- archive statistics and reporting
- improved processing-status tracking
- automated archive integrity checks
- centralised configuration for additional pipeline settings

These should remain secondary to maintaining a reliable archive and discovery workflow.

---

# Summary

The Content Engine currently performs three core jobs:

**Discover**

Find Circa Waves material from online sources and present it for human review.

**Archive**

Store approved source information in Supabase and download the corresponding media into a structured local archive.

**Process Interviews**

Transcribe interview material, generate structured metadata, identify promising short-form moments and create candidate clips for human review.

The archive is the foundation of the system. Automated content processing is an additional layer built on top of it.
