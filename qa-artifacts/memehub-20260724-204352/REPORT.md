# App QA Report: Memehub

| Field | Value |
|---|---|
| Date | 2026-07-24 |
| Target | http://localhost:3000 |
| Platform | web / mobile-web |
| Environment | local development |
| Scope | Image-meme creator journey: discovery, editing, upload, export, persistence, responsive behavior |

## Summary

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 2 |
| Medium | 2 |
| Low | 0 |
| **Total** | **4** |

## Coverage

| # | Area | Status | Evidence | Notes |
|---:|---|---|---|---|
| 1 | Landing and template library | visited | screenshots/01-home.png | Initial mapping complete |
| 2 | Template search and empty state | visited | screenshots/02-search-no-results.png | Search works; empty state has a dead end (ISSUE-003) |
| 3 | Pagination | visited | screenshots/01-home.png | Next-page navigation works |
| 4 | Template-to-editor flow | visited | screenshots/03-editor-initial.png | Curated and Imgflip templates open in the same editor |
| 5 | Text and layer editing | visited | screenshots/04-hindi-text.png, screenshots/05-sticker-and-layers.png | Hindi/emoji rendering, extra text, media layers, vector shape controls exercised |
| 6 | Stickers / GIF assets | visited | screenshots/05-sticker-and-layers.png | Giphy search and sticker insertion work |
| 7 | Freehand drawing and drawing undo | visited | screenshots/09-draw-before-undo.png, screenshots/10-draw-after-one-undo.png | One stroke was removed by one Undo action |
| 8 | Still-image download | blocked | | The button ran without a console error, but the controlled browser did not expose the generated download event |
| 9 | Custom-image upload | blocked | | Dialog and validation states visited; Chrome extension lacked file-URL access |
| 10 | Refresh persistence | visited | screenshots/06-before-refresh.png, screenshots/11-after-refresh-home.png | Draft is discarded (ISSUE-001) |
| 11 | Narrow/mobile layout | visited | screenshots/07-mobile-home.png, screenshots/08-mobile-editor.png | 390×844 DOM viewport had no horizontal overflow |
| 12 | Keyboard/accessibility smoke test | visited | screenshots/01-home.png, screenshots/03-editor-initial.png | Core controls lack semantics (ISSUE-002) |
| 13 | Console/runtime errors | visited | screenshots/01-home.png | Reproducible hydration error (ISSUE-004); unrelated Chrome-extension errors excluded |

## Limitations

- Production publishing, social-network integrations, authenticated collaboration, and billing are not visible in the current local product and are outside this run.
- Video behavior is outside the user-requested image-only focus.
- Direct file upload was blocked because the ChatGPT Chrome extension did not have “Allow access to file URLs” enabled. The repository path was inspected separately.
- The generated still-image download could not be captured by the browser controller. No app-side console error appeared, and the export implementation was inspected in source.
- MetaMask/Grammarly browser-extension warnings were excluded from app findings.

## Issues

### ISSUE-001: A refresh or Back action permanently discards the entire meme

| Field | Value |
|---|---|
| Severity | high |
| Category | functional / ux |
| Surface | `/`, selected-template editor |
| Environment | Chrome, local Next.js development build, desktop and 390×844 |
| Evidence | screenshots/06-before-refresh.png, screenshots/11-after-refresh-home.png |

**Expected**

An in-progress creator draft should autosave, or Memehub should warn before discarding it and offer recovery.

**Actual**

After adding Hindi text, a custom text layer, a Giphy sticker, a vector arrow, and a drawing, refreshing returned to the template library with no recovery. Back also clears the editor immediately.

**Reproduction**

1. Select any template.
2. Add text or another canvas object.
3. Refresh the page, or select Back.
4. Observe that the template library returns and the draft is gone.

**Notes**

The root cause is architectural: selection and edit state live only in React memory. `handleReset` clears the selected/custom template without persistence or confirmation.

### ISSUE-002: Core creation controls are unavailable or unidentified to assistive input

| Field | Value |
|---|---|
| Severity | high |
| Category | accessibility |
| Surface | template library and editor |
| Environment | Chrome, local Next.js development build |
| Evidence | screenshots/01-home.png, screenshots/03-editor-initial.png |

**Expected**

Every template and icon-only editor control should be keyboard focusable and expose a meaningful role and accessible name.

**Actual**

Template cards are clickable `div` elements with `tabIndex=-1`, no role, and no accessible label. The two text-style gear buttons and theme toggle are announced as unnamed buttons.

**Reproduction**

1. Open the template library and navigate with the keyboard or inspect the accessibility tree.
2. Observe that template images are not interactive controls and cannot be reached as template actions.
3. Open a template and inspect the text-style gear buttons.
4. Observe unnamed buttons for settings.

**Notes**

This blocks the primary workflow for keyboard-only and screen-reader users.

### ISSUE-003: A failed search removes the custom-template escape hatch

| Field | Value |
|---|---|
| Severity | medium |
| Category | ux |
| Surface | `/`, template search |
| Environment | Chrome, local Next.js development build |
| Evidence | screenshots/02-search-no-results.png |

**Expected**

When no template matches, Memehub should keep “Use Custom Template” available and offer to clear the query, upload an image, or request an asset.

**Actual**

The page shows only “No templates found”; the custom-upload button and all recovery actions disappear.

**Reproduction**

1. Enter `zzzz-no-template-zzzz` in template search.
2. Observe the empty state.

**Notes**

This is particularly harmful for long-tail Indian people, quotes, films, and local events—the exact searches a culturally specific product needs to learn from.

### ISSUE-004: Advertising scripts cause a React hydration mismatch

| Field | Value |
|---|---|
| Severity | medium |
| Category | console / performance |
| Surface | `/` |
| Environment | Chrome, local Next.js development build |
| Evidence | screenshots/01-home.png |

**Expected**

The page should hydrate without application runtime errors and should load each external script once.

**Actual**

The Next.js issue overlay appears after reload, and the console reports that the AdSense script attributes differ between server and client markup.

**Reproduction**

1. Start `npm run dev`.
2. Open or reload `/`.
3. Inspect the Next.js issue overlay and console.

**Notes**

`src/app/layout.tsx` mounts the same AdSense URL three times, using both `afterInteractive` and `beforeInteractive`. This matches the hydration trace and creates redundant script work.
