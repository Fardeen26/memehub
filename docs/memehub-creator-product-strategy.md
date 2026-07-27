# Memehub Creator Product Strategy

**Date:** 24 July 2026
**Scope:** Image memes only, with special attention to Indian and political-meme creators

## Executive summary

**Recommendation: proceed with validation, but reposition the product.**

Memehub should not try to win as another template generator or a smaller Canva. The current app is already a capable locally persisted canvas: it supports detailed text styling, image overlays, Giphy assets, vector shapes, freehand drawing, masking, creator text branding, reusable local assets, platform export variants, and animated export. Its biggest weakness is that it is not yet a complete creator operating system. There are no named projects, global undo/redo, complete cross-type layer ordering, reusable Page Kits, source history, curated rights-aware asset graph, or collaboration.

The strongest product thesis is:

> **Memehub is the India-first operating system for repeat meme accounts: from a breaking moment to a polished, localized, attributable image meme in under 90 seconds.**

The moat is not the canvas editor by itself. Canva, Adobe Express, Picsart, PixelLab, Photopea, and Mematic already make generic editing cheap or free. Memehub can differentiate through:

1. a culturally indexed Indian asset graph;
2. a fast but professional meme-native editor;
3. creator memory—projects, page kits, reusable casts, styles, and export recipes;
4. source, rights, satire, and synthetic-media provenance;
5. later, performance data connecting formats and assets to creator outcomes.

## Implementation update

The creator foundation and first visible production-workflow milestone are now implemented:

- versioned IndexedDB autosave with deep schema validation, crash/refresh recovery, explicit resume/discard, replacement confirmation, save-before-back behavior, future-version preservation, and stale-tab conflict protection;
- creator-controlled text branding in any corner, disabled by default, with no forced Memehub watermark;
- verified font loading for Devanagari, Bengali, Gurmukhi, Gujarati, Tamil, Telugu, Kannada, Malayalam, and Urdu, automatic RTL/LTR text-entry direction, and shaping-safe letter spacing;
- a prominent five-part creator workspace—**Discover, Styles, My assets, Layers, and Export**—instead of hiding the primary workflow in utility accordions;
- a live India trend radar backed by Google Trends RSS, with current source coverage kept explicitly reference-only;
- a two-lane discovery model that separates trend evidence from editable media, plus fail-closed Wikimedia Commons raster search with visible credit, license, other-rights notices, and one-click insertion as a local project copy;
- a browser-local Source Inbox for articles, Reels, Reddit posts, videos, and complete image-attribution snapshots, without scraping third-party media;
- source, credit, license, and restriction provenance attached to discovered image layers and preserved through local draft recovery;
- per-client and global discovery-search quota protection, a separate UTC-day YouTube budget, meaningful-query validation, stale-request cancellation, stable provider cache keys, and no caching of degraded upstream responses;
- one-tap Classic Meme, Headline / News, Subtitle, Reaction, and Hindi Bold typography recipes;
- a reusable local asset shelf for creator-owned PNG, JPEG, and WebP cutouts, logos, and reaction images, with a migrated metadata/blob store, lazy thumbnails, and a mobile-safe 40 MB total cap;
- one layer surface for text, shapes, media, and the locked background, with non-destructive visibility, duplication, deletion, and safe within-group ordering;
- selected-image opacity, fit, fill, 90-degree rotation, and manual erase controls;
- Instagram square, portrait, and story exports plus WhatsApp compression in PNG, JPEG, and WebP, with explicit fit or crop behavior;
- keyboard-accessible template cards, labeled editor controls, and a useful no-results state that preserves custom upload;
- one consistent AdSense script, no redundant mutable tracker, and a system-theme-aware accessible toggle;
- typed-array-safe PNG/GIF export paths, restored GIF cache rebuilding with persisted safety limits, top-layer creator branding, and a reproducible npm dependency lock;
- patched PostCSS/Sharp overrides verified through clean install, image optimization, audit, tests, and production build.

This closes the most urgent data-loss, creator-identity, and source-discovery risks and materially improves the everyday creation loop. It does **not** complete the longer product strategy: global undo/redo, one cross-type ordered layer model, non-destructive crop/filters, named projects, automated claim verification, background removal, and reusable multi-page kits remain the next high-value work.

## What Memehub is today

The live product is now a safer **single-draft creator editor**, but not yet a complete **workspace for running a meme page**.

| Creator job | Current Memehub | Important gap |
|---|---|---|
| Find a starting point | Curated Cloudinary templates, Imgflip trending templates, name search, pagination | No format, emotion, person, quote, language, region, event, or freshness taxonomy |
| Bring source material | Live India trend evidence, licensed Commons image search, local URL/source inbox, custom background and image-overlay upload/paste | No OCR, source screenshot capture, claim history, watermark or duplicate detection |
| Add copy | Multiple draggable/resizable/rotatable text boxes; full text styling; nine Indian-script font choices; five one-tap style recipes | No transliteration, language-aware line breaking, text background/pill, custom font upload, or creator-defined style recipes |
| Composite a scene | Raster overlays, Giphy stickers/GIFs, seven shapes, freehand drawing, image erasing, layer visibility/duplication, and selected-image fit/fill/rotate/opacity | Cross-type order is still grouped; no grouping, snapping, crop, perspective, non-destructive filters, blend modes, or automatic cutout |
| Keep work safe | Anonymous local autosave, refresh recovery, resume/discard, replacement confirmation, save-before-back, deep validation, and stale-tab conflict rejection | One active local draft only; no named projects, user-visible versions, cloud sync, or migrations beyond preserving unknown versions |
| Brand a page | Optional creator handle in four corners; no forced Memehub watermark | No logo-based kit, safe zone, saved multi-page kits, or multiple reusable brand recipes |
| Export | Instagram square/portrait/story and WhatsApp profiles; PNG/JPEG/WebP; quality, fit/crop, copy, and animated GIF/MP4 paths | No custom dimensions, transparent-background workflow, multi-variant batch, file-size target, or X/YouTube profiles |
| Work repeatedly | The active draft survives refresh/navigation and creator-owned image assets persist in a local shelf | No named projects, favorites/collections, cloud sync, remix history, or reusable project recipes |
| Work with others | None | No brief, comment, review, approval, shared library, roles, or version comparison |

### Confirmed product-quality findings

The hands-on QA report is in `qa-artifacts/memehub-20260724-204352/REPORT.md`. Its most serious confirmed issues drove the first implementation milestone:

- **Resolved:** Refresh and Back destroyed all work with no recovery.
- **Resolved:** Template cards were not keyboard-accessible and important editor controls lacked names.
- **Resolved:** A no-results search removed the custom-upload route and offered no recovery action.
- **Resolved:** The same AdSense script was mounted three times with conflicting strategies.

### Technical diagnosis

The main editor is a 5,000-plus-line Canvas 2D component with `@ts-nocheck`. Document state is split across parallel text arrays, image overlays, shapes, and drawing strokes rather than one ordered scene model (`src/components/MemeEditor.tsx:1`).

That design makes the next important features—global undo, cross-type layer ordering, grouping, version history, collaboration, and reliable hit testing—much harder than they should be.

The new creator layer surface now exposes text, images, shapes, and the locked background, but it truthfully limits ordering to within each type because rendering remains group-based. The editor still needs one ordered, typed project document before cross-type ordering, global undo, grouping, and collaboration can be reliable.

### Repository verification

- Clean `npm ci`: passed with the current cross-platform lock.
- `npm test`: 273 tests passed across 37 files.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with no warnings or errors.
- `npm run build`: passed on Next.js 15.5.21, producing all ten routes.
- `npm audit --omit=dev`: zero vulnerabilities.
- Manual browser regression: Hindi preset and copy, creator handle/position, Giphy media insertion, shape/image layer controls, manual-erase controls, autosave recovery, a 1080 × 1350 WebP platform export, live India discovery, person search, licensed image insertion, Source Inbox attribution, workspace-tab persistence, and return-to-live-pulse behavior passed.

Next.js 15.5.21 remains on the supported Maintenance LTS line. Memehub pins PostCSS 8.5.22 and Sharp 0.35.3 over Next’s older transitive versions and standardizes installs on npm. The declared Node range starts at 20.19 because the current test/build toolchain is stricter than Sharp’s own Node 20.9 minimum. Clean install and production image checks remain release gates. [Next.js release policy](https://nextjs.org/support-policy), [Sharp 0.35 changelog](https://sharp.pixelplumbing.com/changelog/v0.35.0/)

## How Indian meme accounts operate

The best-observed political workflow is closer to a rapid-response newsroom than a template gallery:

```text
moment or source
  → idea and narrative
  → familiar cultural reference
  → colloquial copy
  → design/composite
  → review and channel choice
  → localized/platform variants
  → publish/forward
  → archive and learn
```

An Indian political war-room example documented concept approval, youth-language writing, editing, and publication within 7–8 hours because the issue would quickly lose relevance. The same report describes approval by handlers and distribution across official/surrogate pages and WhatsApp chains. [Indian Express: journey of a political meme](https://indianexpress.com/article/long-reads/journey-political-meme-digital-war-room-whatsapp-chat-9343537/)

Creators repeatedly reuse familiar shorthand:

- politician expressions and speech screenshots;
- Bollywood, OTT, cricket, and celebrity reactions;
- news headlines and mock-newspaper frames;
- two-panel comparisons and dialogue sequences;
- visual metaphors such as chess, musical chairs, logos, objects, and superheroes;
- caricatures, mascots, minimal comics, and dramatic composite posters;
- chat, tweet, headline, and social-post interfaces.

Instagram’s India review describes cricket, current events, nostalgia, and small viral moments becoming shared meme waves. This supports a freshness- and context-driven asset system, not a static list of “popular templates.” [Instagram India 2025 review](https://about.fb.com/news/2025/12/what-kept-india-scrolling-in-2025-instagrams-year-in-review-is-here/)

Language must be treated as part of the joke, not a translation step. IAMAI/Kantar reported that 870 million users accessed the internet in Indic languages in 2024 and that 57% of urban users preferred Indic-language content. [Internet in India 2024 report](https://www.iamai.in/sites/default/files/research/Kantar_%20IAMAI%20report_2024_.pdf)

## Competitive position

| Competitor group | Strength | Why it does not fully solve the repeat meme-account job |
|---|---|---|
| Canva / Adobe Express | Huge asset/template libraries, resizing, brand kits, sync, scheduling, collaboration, AI tools | Broad design taxonomy rather than Indian meme context, recurring casts, source provenance, page voice, and rapid moment workflow |
| Picsart / Photopea / PixelLab / Photoroom | Deep photo manipulation or fast mobile precision | Generic editing, fragmented asset sourcing, weak team continuity, and no culturally indexed trend-to-meme workflow |
| Imgflip / Mematic | Very fast meme generation | Shallow compositing, limited production memory, branding, approval, rights, and asset operations |
| Supermeme and other AI generators | Caption ideation and semantic template matching | Generic humor risk; weak cultural judgment and insufficient professional editing |
| MemeChat / IndiaMemes / local directories | Indian templates, community, discovery, campaigns | Not yet a professional cross-device creator workspace with a reliable project and provenance system |

PixelLab is an especially important benchmark for Indian mobile creators: its Google Play listing has more than 100 million downloads and includes project saving, custom fonts, text effects, background removal, perspective editing, drawing, arbitrary-resolution export, and a meme preset. Memehub should match that practical precision while adding cross-device workflow and cultural discovery. [PixelLab on Google Play](https://play.google.com/store/apps/details?id=com.imaginstudio.imagetools.pixellab)

Adobe Express is the strongest horizontal threat in India. Its current India offering includes large asset/font libraries, background removal, resize, brand kits, content scheduling, safe zones, captions, and translation. Competing on a generic checklist is not viable. [Adobe Express India plans and features](https://www.adobe.com/in/express/pricing)

## Market assessment

There is strong evidence for creator demand, but no reliable “Indian meme software market size.” Treat the numbers below as a planning model, not a forecast.

- BCG estimates 2–2.5 million monetized Indian creators influencing $350–400 billion in consumer spending. [BCG creator-economy study](https://www.bcg.com/publications/2025/india-from-content-to-commerce-mapping-indias-creator-economy)
- YouTube reported more than 100 million India-based channels uploading in the preceding year and ₹21,000 crore paid to Indian creators, artists, and media companies over three years. This is a broad ecosystem signal, not a Memehub addressable-market count. [YouTube India creator commitment](https://blog.google/intl/en-in/products/platforms/youtubes-india-bet-inr-21000-crore-paid-out-to-indian-creators-commits-inr-850-crores-to-power-indias-creator-nation/)

### Illustrative TAM / SAM / SOM

| Layer | Assumption | Illustrative annual value at ₹1,999/year |
|---|---:|---:|
| Broad TAM proxy | 2–2.5 million monetized Indian creators | ₹400–500 crore |
| Initial SAM | 5–10% are repeat visual-content creators or small teams | ₹20–50 crore |
| Three-year SOM target | 10,000 paid creator seats | About ₹2 crore |

The 5–10% SAM is an explicit hypothesis that must be tested. The better beachhead is not “everyone who has made a meme”; it is people or teams publishing several visual posts per week whose reach or income depends on speed and consistency.

## Product positioning

### Primary user

An independent meme-page operator or two-to-five-person social team in India that:

- reacts to news, politics, cricket, entertainment, and internet moments;
- publishes several times a week or day;
- uses English, Hinglish, native script, or regional language;
- repeatedly needs the same people, expressions, cutouts, fonts, and page branding;
- currently moves between social/news sources, Google Images, background removers, PixelLab/Canva/Photopea, and publishing apps.

### Positioning statement

> For repeat Indian meme creators who need to react while a moment is still relevant, Memehub turns a source or idea into a polished, localized, attributable image meme in under 90 seconds—using culturally indexed assets and professional controls without generic design-tool complexity.

### North-star metric

**Median time from “I know what I want to say” to a publish-ready export.**

The initial target should be under 90 seconds for a known format and under five minutes for a composite poster.

## The product to build

Use one project model through two depths of the same editor:

- **Quick Compose:** paste/upload a source, choose a meme recipe, edit suggested copy, apply a Page Kit, and export. This is the under-90-second path for beginners and known formats.
- **Pro Canvas:** expand the same draft into complete layers, cutouts, crop, masks, filters, perspective, typography, and precise export controls.

Do not make creators choose between a simplistic generator and a disconnected advanced tool. Progressive disclosure should keep the first screen fast while preserving professional control when it is needed.

### 1. Reliable project and layer foundation — P0

Create a versioned project document before expanding the tool list:

```ts
type MemeProject = {
  version: number;
  canvas: { width: number; height: number; background: Background };
  sourceRefs: SourceReference[];
  layers: MemeLayer[];
  pageKitId?: string;
  exportPresetIds: string[];
  provenance: ProvenanceRecord[];
};

type MemeLayer = {
  id: string;
  type: "raster" | "text" | "vector" | "drawing" | "group";
  z: number;
  transform: { x: number; y: number; width: number; height: number; rotation: number };
  opacity: number;
  visible: boolean;
  locked: boolean;
  data: unknown;
};
```

Build these capabilities on top:

- command-based global undo/redo;
- reorder, group, duplicate, lock, hide, and delete;
- anonymous IndexedDB autosave and crash recovery before requiring accounts;
- versioned serialization and migrations;
- document coordinates separated from viewport coordinates, with zoom/pan and screen-sized handles;
- a typed renderer/tool-controller/panel split instead of extending the monolith.

### 2. Meme-native still-image editor — P0/P1

The next editor tools should be chosen by creator workflow value:

1. crop, straighten, flip, rotate, and canvas/aspect resize;
2. alignment, snap lines, safe zones, grouping, and multi-select;
3. brightness, contrast, saturation, hue, blur, sharpen, pixelate, and redaction;
4. automatic background/subject removal with manual erase-and-restore refinement;
5. perspective warp and color/light matching for poster composites;
6. panel grids, chat frames, headline cards, tweet/social-post frames, and speech bubbles;
7. text backgrounds/pills, line height, gradients, reusable styles, and custom font upload;
8. non-destructive masks and filters;
9. PNG, JPEG, WebP, transparent background, quality/file-size controls, and custom dimensions.

Animated export is already disproportionately advanced for the current image-first strategy. Keep it stable, but do not expand it until still-image creation and project reliability are excellent.

### 3. India-focused asset graph — P1

Giphy should remain a supplemental source, not Memehub’s primary asset system. Build a catalog with:

- asset type: template, blank still, cutout, reaction, object, background, frame, sticker, font, layout;
- person/character/team/show/film/source work;
- quote/dialogue and searchable aliases;
- expression, emotion, relationship, situation, and meme grammar;
- language, script, region, and transliteration;
- event/topic/date/freshness and trend expiry;
- resolution, transparency, aspect ratio, and quality score;
- source URL, uploader, licence/permission, required attribution, rights state, and takedown state;
- political entity/topic and moderation state;
- duplicate/perceptual hash and upstream-watermark status.

The creator-facing system should provide:

- semantic and Hinglish/native-script search;
- favorites, recents, collections, and personal uploads;
- saved cutouts and recurring casts;
- “more like this” by emotion/format, not only visual similarity;
- contributor submissions with review, attribution, and remix lineage;
- curated packs for events, cricket, festivals, entertainment, regional culture, and elections.

Do not distribute unlicensed film, news, or public-figure assets merely because they are commonly used in memes. Give each asset an explicit rights state.

### 4. Indic typography and localization — P1 (font selection started)

Add properly tested font packs and shaping for Devanagari, Bengali, Gurmukhi, Gujarati, Tamil, Telugu, Kannada, Malayalam, and Urdu. Include:

- Roman-Hinglish transliteration;
- native-script spell and line-break assistance;
- automatic fit that respects grapheme clusters;
- locale-specific punctuation and numeral choices;
- saved typography presets for headline, dialogue, subtitle, and poster styles;
- caption variants rather than literal translation.

Script-specific Noto fonts are now selectable, fetched to readiness, and persisted with the draft. Manual code-unit spacing is disabled for shaping-sensitive text so conjuncts, marks, Urdu joining, and emoji stay intact. The remaining work is screenshot-based shaping and line-break verification, transliteration, language-aware fit, custom fonts, and reusable typography recipes.

### 5. Page kits, export packs, and creator memory — P1

A meme-page brand kit is not only a logo and hex colors. A **Page Kit** should contain:

- handle/logo and locked watermark positions;
- safe-zone presets;
- preferred fonts, outline, shadow, and text recipes;
- recurring people/characters and cutouts;
- saved caption tone and language choices;
- default satire/source/AI labels;
- preferred export formats.

One project should generate:

- Instagram portrait, square, and story variants;
- X-friendly single-image and multi-image variants;
- YouTube community square;
- compressed WhatsApp-forward copy;
- optional source-credit and clean archive copies.

X currently displays standard single-photo ratios from 2:1 through 3:4 in full and permits up to four images, which supports platform-specific export packs rather than one universal file. [X photo guidance](https://help.x.com/en/using-x/posting-gifs-and-pictures)

### 6. Trend/source inbox and production workflow — P1/P2

Let creators paste a source URL or screenshot and create a project that retains:

- headline/quote, publisher, URL, date, and captured image;
- OCR text and recognized people;
- intended narrative, audience, language, and expiry;
- source credit, permission/licence, and verification status.

Then add briefs, comments, approvals, version comparison, regional variants, shared libraries, and a moderated submission inbox. Direct publishing and full social analytics should come after export and archival workflows are dependable.

## AI strategy

Use AI to remove friction while keeping the creator in control.

### Build early

- semantic asset and template search;
- OCR and source metadata extraction;
- background removal, object selection, erase/restore, and upscaling;
- transliteration and caption alternatives by tone/language;
- auto-fit, layout suggestions, face-aware resize, and export variants;
- similarity and duplicate/watermark detection.

### Defer

- one-click realistic political face swaps;
- fabricated “news footage” or event images;
- automatic posting of political content;
- fully autonomous joke generation as the core experience.

Generic AI humor is easy for competitors to copy and can be culturally wrong. The valuable system is a creative copilot with a strong local asset corpus and creator history.

## Rights, political content, and synthetic-media safety

This is product design, not legal advice; launch decisions need Indian counsel.

- India’s Copyright Office describes limited fair-dealing exceptions for criticism/review and current-event reporting. That is not blanket permission for every film still, news photo, logo, or celebrity image. [Copyright Office exceptions](https://copyright.gov.in/Exceptions.aspx)
- India’s 2026 IT Rules FAQ distinguishes routine good-faith edits such as colour correction and compression from realistic synthetic alterations, while describing labelling and provenance duties for covered synthetic media. [MeitY 2026 FAQ](https://www.meity.gov.in/static/uploads/2025/10/065b6deb585441b5ccdf8be42502a49c.pdf)
- The Election Commission advises political parties/candidates to clearly label AI-generated or significantly altered campaign images, video, audio, and other materials with disclosures such as `AI-Generated`, `Digitally Enhanced`, or `Synthetic Content`. [ECI AI advisory](https://www.eci.gov.in/eci-backend/public/api/download?url=LMAhAK6sOPBp%2FNFF0iRfXbEB1EVSLT41NNLRjYNJJP1KivrUxbfqkDatmHy12e%2FzGjJMI0%2FjETs7fjrM8lYn4ipTqYtDEvVosG8Bae5QB8%2Fj5TBF9Esc2hlzORgYtkmzyKzGsKzKlbBW8rJeM%2FfYFA%3D%3D)

Memehub should therefore include:

- a source/rights ledger and takedown process;
- visible `SATIRE`/`PARODY` modes for mock-news layouts;
- immutable AI/synthetic declarations and export provenance;
- persistent visible labels when realistic people/events are materially generated or altered;
- checks for missing source, false attribution, deceptive news styling, harassment, and identity/community attacks;
- human review and an audit trail rather than an opaque political-content classifier.

## Recommended next 90-day sequence

### Days 1–21: replace the editor bottleneck

1. Move the current draft into one ordered, typed project document with a migration from the existing schema.
2. Split rendering, selection/hit testing, commands, and panels out of the 5,000-line editor.
3. Add command-based global undo/redo and true cross-type layer ordering.
4. Add viewport zoom/pan, crop/canvas resize, snap lines, and resolution-independent handles.
5. Expand interaction and screenshot tests, then remove `@ts-nocheck` module by module.

### Days 22–60: finish the repeat-creator core

6. Add automatic background removal with non-destructive erase-and-restore refinement.
7. Turn the current handle, asset shelf, and text recipes into reusable Page Kits.
8. Add crop, filters, pixelate/redact, text backgrounds, custom fonts, and Roman-Hinglish transliteration.
9. Add reusable layout recipes for reaction, comparison, dialogue, headline, chat, and composite-poster formats.

### Days 61–90: build the differentiating workflow

10. Launch a small, high-quality asset catalog with rights/source metadata and semantic tags.
11. Add named projects, versions, favorites, collections, and reusable casts.
12. Pilot a source inbox with OCR, date, URL, credit, rights state, and provenance.
13. Add lightweight share-for-review links after project versions are reliable.
14. Instrument the creation funnel and begin creator-panel testing.

## The first ten engineering tickets

1. `MemeProject v2` ordered scene schema plus migration from the current parallel arrays.
2. Renderer/tool-controller/panel extraction from `MemeEditor`.
3. Command history for global undo/redo.
4. True cross-type layer ordering, locking, grouping, and multi-select.
5. Viewport zoom/pan, alignment guides, and resolution-independent handles.
6. Non-destructive crop, canvas resize, and background controls.
7. Background removal plus erase-and-restore mask refinement.
8. Page Kits built from saved branding, typography recipes, and creator assets.
9. Source-aware asset catalog API with rights, language, cultural, and freshness tags.
10. Named projects, versions, and import/export of the project document.

## Validation plan before scaling the build

Recruit 15–20 active creators:

- five political/current-affairs accounts or campaign designers;
- five cricket/entertainment/pop-culture accounts;
- five regional-language creators;
- several one-to-five-person teams, not only solo casual users.

Run observed tasks using a real recent moment:

1. measure their existing tools and elapsed time;
2. give them current Memehub plus a manually curated asset pack;
3. prototype Page Kits, semantic search, and export variants;
4. measure time-to-first-export, number of external tools opened, correction loops, and willingness to reuse;
5. test ₹199/month Creator Pro and ₹999/month Studio pricing.

Good four-week validation signals:

- at least 50% of participants produce a usable export in the first session;
- median known-format creation time falls below 90 seconds;
- at least 30% return voluntarily the following week;
- asset search succeeds without leaving Memehub in at least 70% of observed tasks;
- several creators agree to pay or pre-order, rather than only saying the idea is useful.

## Monetization

Recommended starting model:

- **Free:** clean 1080p export, core editor, public assets, local drafts, limited AI. Do not force Memehub branding onto a serious creator’s page identity.
- **Creator Pro — ₹149–249/month:** 4K/transparent export, private asset vault, Page Kits, advanced cutout/effects, versions, premium/local packs, and monthly AI credits.
- **Studio — ₹799–1,499/month:** three-to-five seats, shared libraries, multiple pages, comments/approvals, role controls, and batch variants.
- **Later:** short event passes, premium/local asset packs, contributor marketplace, brand briefs, and a semantic asset/rendering API.

Ads inside the editor conflict with a professional creator workflow and are already creating runtime problems. Subscription value should come from saved time, consistency, asset memory, and team operations—not from charging for basic text on a template.

## What not to build next

- another large batch of untagged templates;
- more GIF/video export sophistication during the image-first phase;
- a generic text-to-meme generator as the main product;
- full social scheduling before projects and exports are reliable;
- realistic political face/event generation without provenance and legal review;
- dozens of isolated canvas tools before the project/layer architecture is fixed.

The correct next product is not “Memehub with more templates.” It is **Memehub Creator Workbench**: reliable projects, culturally searchable assets, professional image compositing, Page Kits, multilingual exports, and a source-aware rapid-response workflow.
