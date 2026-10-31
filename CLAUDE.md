# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

WisdomWell is a public board of motivational quotes: anyone can add a quote, like one, or edit and delete one, with no accounts. It runs on Express 5, the MongoDB Node driver (no Mongoose) and EJS. Live at https://wisdomwell.up.railway.app/, and linked from Bobby's portfolio.

- It started from zellwk's CRUD tutorial in 2022. Bobby extended it in June 2025, and it was brought up to date in October 2026.
- The default branch is `master`, and every merge to it deploys to production. Changes go through a branch and a pull request, one at a time: start the next branch from `master` after the previous PR has merged.
- **The Node version:**
  - Railway builds on the exact version in package.json's `engines`: 24.22.1, the Oct 21 2026 security release.
  - The service's builder is Railpack, which honours an exact pin. Nixpacks only reads the major version.
  - Bump the pin for each Node security release, and never loosen it to a range.
  - The startup log line prints the running version, so the deploy log confirms it. The deploy log's `npm warn config production` line is harmless.
- `readME.md` is Bobby's own description of the project. Change its wording only with his approval.

## Commands

```bash
npm run dev    # node --watch server.js
npm start      # node server.js
npm test       # node --test: runs test/*.test.js
```

- **Local setup:** copy `.env.example` to `.env` in the repo root.
  - `DB_STRING` must point at a local or throwaway MongoDB, never the production database.
  - `PORT` defaults to 3000.
- **Dependency updates:**
  - Take versions at least a week old: `npm install --before=<the date a week ago>` applies that to the whole tree.
  - Keep `npm audit` at 0.

## Architecture

The whole server is `server.js`. In order:
1. **dotenv, then `trust proxy` 1.** Railway sends each request through one proxy; without this, the rate limiter counts the proxy instead of each visitor.
2. **helmet,** with an explicit CSP.
3. **The view engine, `app.locals.limits` and `express.static('public')`.** `app.locals.limits` feeds the forms' `maxlength`. Static files come before the limiter, so CSS, JS and icons don't count toward it.
4. **The general rate limiter:** 100 requests per 15 minutes per visitor.
5. **`express.json` and `express.urlencoded({ extended: false })`**, both capped at 10kb with `inflate: false`.
   - With `inflate: false`, a compressed body gets a 415. Decompressing one put Node's Brotli decoder within reach of anyone (the Oct 2026 security release). Keep it on any parser added later.
   - `extended: false` keeps a field like `name[$ne]` a plain key.
6. **The routes,** then a 404 handler and the error handler.
7. **MongoDB connects, then `app.listen`.** Express 5 passes a failed start, like a port in use, to the listen callback, which throws it.

| Route | Called by | Answers |
|---|---|---|
| GET / | the browser | the page. `?sort=new` lists newest first, otherwise most liked; `?q=` searches |
| GET /privacy | the browser | the privacy page |
| GET /addQuotes | a refresh or the back button | a 302 to `/` |
| POST /addQuotes | the add form (a plain form post) | a 302 to `/`, or the page again with the reason (400, or 429 from `addQuoteLimiter`). A post from another site gets a 403. |
| PUT /editQuote | main.js `fetch()` | the updated quote, or `{ error }`: a 403 for another browser's quote, a 404 for none |
| PUT /addUpvote | main.js `fetch()` | `{ likes, liked: true }`; liking twice changes nothing |
| PUT /removeUpvote | main.js `fetch()` | `{ likes, liked: false }`: takes back this browser's like |
| DELETE /deleteQuote | main.js `fetch()` | `{ message }`, or `{ error }` (403 or 404, as for editing) |

**Sort and search** live in `middleware/quoteList.js`, as pure functions tested in `test/quoteList.test.js`.
- **Reading the address:** `readListOptions(req.query)` turns `?sort` and `?q` into `{ sort: 'top' | 'new', q }`.
  - Anything else falls back to the defaults: a list from `?q=a&q=b`, or an unknown sort.
  - The search is tidied like form text, and cut to `MAX_SEARCH_LENGTH` (100).
- **The query:** `listQuery()` builds the filter and sort.
  - "top" is `{ likes: -1, _id: -1 }`, and "new" is `{ _id: -1 }`.
  - A search is an `$expr` with `$indexOfCP` on `$toLower` of the quote and the author, with the term in `$literal`. Nothing typed becomes a regex, and a search like `$likes` stays text.
  - MongoDB's `$toLower` only lowercases A–Z, so an uppercase accented letter in a quote won't match a lowercase search.
- **Links:** `listUrl()` builds them, leaving out the defaults. renderHome passes `list` (sort, q, topUrl, newUrl, clearUrl), so sorting keeps the search and clearing the search keeps the sort.

**Validation** is in `middleware/validators.js`, as pure functions tested in `test/validators.test.js`.
- `checkQuoteInput(body)` returns `{ name, quote }` ready to save, or `{ error }` for the visitor.
  - Any text is allowed: colons, curly quotes, accents, emoji. EJS escapes it on output.
  - Refused:
    - missing or non-string fields
    - a name over `MAX_NAME_LENGTH` (100) or a quote over `MAX_QUOTE_LENGTH` (500), counted after trimming
    - control characters and text-direction overrides
    - links (`http://`, `https://`, `www.`). This was Bobby's call on Oct 30 2026, since nothing is moderated.
  - Runs of whitespace collapse to one space.
- `isQuoteId(id)` wants 24 hex characters. Not `ObjectId.isValid`, which accepts any 12-character string.

**Errors:**
- The add form is a plain form post, so its errors re-render index.ejs through `renderHome()`, with `formError` and the typed `formValues`. index.ejs needs both locals on every render.
- That page is the reply to the POST, so its address is `/addQuotes`.
  - main.js swaps the address for `/` on load (`history.replaceState`). Any reload, such as the one after saving an edit, then asks for `/` with a GET, instead of re-sending the refused form (Chromium) or asking for a page that doesn't exist (the 404 Bobby hit on Oct 30 2026).
  - `GET /addQuotes` redirects to `/`, for refreshes with JavaScript off.
- The `fetch()` calls in main.js send `Accept: application/json` and get `{ error }`, which main.js shows. The edit dialog shows it in `#editError` and stays open.
- `sendError()` picks JSON or `views/error.ejs` by the Accept header. It serves the 404 handler and the error handler.
- The error handler keeps the parsers' 4xx statuses: 400 for bad JSON, 413 over 10kb, 415 for a compressed body. It never shows `err.message`.

**Routes are `async`.** Express 5 sends a rejected promise to the error handler, so don't wrap database calls in try/catch just to send a 500.

**The database:**
- Database `motivational-quotes`, collection `quotes`.
- Fields: `name`, `quote`, `likes` (a number), `ownerHash`, `likedBy` (a list of hashed keys), `createdAt` and `updatedAt`.
  - Quotes from 2022 have no `createdAt`, which is why ties sort on `_id`.
  - Quotes added before Oct 2026's PR 5 have no `ownerHash`.
- Likes only change through `$inc`; the page sends just the quote's id.
- **Likes are one per browser.**
  - `PUT /addUpvote` gives the browser a key if it has none, then `$addToSet`s its hash to `likedBy` and `$inc`s `likes`. The filter is `likedBy: { $ne: hash }`, so a second like matches nothing.
  - `PUT /removeUpvote` `$pull`s it and `$inc`s by −1, filtered on `likedBy: hash`. It never runs without a key: `likedBy: null` would match every quote with no list and take a like off.
  - Counts from before PR 6 have no `likedBy` entries, so they stay as the base and can't be taken back.
  - Replies are `{ likes, liked }`.
  - A script that throws away its cookie can still like again. The general rate limit (100 per 15 minutes) is what slows it.
- In driver 7, `findOneAndUpdate` returns the document itself, or null, not `{ value }`.

**Adding quotes** has its own limiter, `addQuoteLimiter`:
- 10 saved quotes an hour per visitor.
- `skipFailedRequests`, so refused quotes don't count.
- Its handler re-renders the page with the reason.

**Own quotes:** only the browser that added a quote can edit or delete it. There are no accounts. The code is in `middleware/visitorKey.js`, with tests in `test/visitorKey.test.js`.
- **The key:** a browser's first saved quote calls `giveVisitorKey()`, which sets the `ww_key` cookie: 32 random bytes as base64url, httpOnly, `sameSite: 'lax'`, `secure` from `req.secure`, one year.
- **Storage:** the quote stores `ownerHash`, the SHA-256 of that key. `loadVisitor` (before the routes) sets `req.visitorHash` from a well-formed cookie, or to null.
- **Hashes never leave the server:**
  - `renderHome()` turns `ownerHash` into `isOwner` and `likedBy` into `likedByViewer`, then drops both fields. index.ejs shows Edit and Delete only on the visitor's own quotes, and a solid heart with `aria-pressed="true"` on the ones they liked.
  - Edit replies use `projection: { ownerHash: 0, likedBy: 0 }`. Like replies carry only `{ likes, liked }`.
- **Edits and deletes** filter on `{ _id, ownerHash: req.visitorHash }`. `refuseChange()` answers 403 when the quote exists but isn't theirs, and 404 when it doesn't exist.
- **Never query without a key.** If `req.visitorHash` is null, refuse before touching the database: a filter on `ownerHash: null` matches every quote that has no `ownerHash`.
- **Older quotes have no owner,** so nobody can edit or delete them on the site. Bobby manages them in Atlas.
- **Posts from other sites get a 403 (`isCrossSite()`).** The browser doesn't send `ww_key` with them, so the reply would hand out a new key and replace the visitor's own.
  - It trusts Sec-Fetch-Site first.
  - Origin is only the fallback for old browsers. helmet's `Referrer-Policy: no-referrer` makes browsers send `Origin: null` even for this site's own form, so "null" isn't treated as another site. (An Origin-only check refused every real add; the browser check caught it.)

## The page

- **Views:** `views/index.ejs` and `views/privacy.ejs` each carry their own head, header and footer, with no partials.
  - The copyright year is rendered by EJS.
  - `views/error.ejs` is a smaller page with no scripts.
- **main.js:**
  - `public/main.js` loads at the end of `<body>`, on the home page only. It expects the quote list and the edit dialog.
  - Its listeners sit at the top, and its function declarations are hoisted.
  - It selects with `querySelector`, never `getElementById` (Bobby's standard).
- **The edit dialog** is a `<dialog>` opened with `showModal()`.
  - The browser moves focus to the `autofocus` field, closes it on Escape, and returns focus to the Edit button.
  - A click on `::backdrop` lands on the dialog element. main.js closes the dialog only when the press started outside the dialog's box too, because a text selection dragged out of a field also ends as a click on the dialog.
    - It compares positions (a document-level `pointerdown` against `isOutsideDialog()`), not targets. iPhone Safari reports a touch on the backdrop as starting on the page behind it, so a target check broke tap-to-close there (Bobby's PR #4 check).
  - The × is a 44px light circle with a dark × (9.7:1). Bobby found the plain gray × too faint on his phone.
  - `.modal` has no `display` rule, because the browser shows and hides the dialog.
  - It reads a quote from the card's `data-name` and `data-quote` attributes, not from the card's text. Reading the text used to strip every `"`.
- **The quote box:** both forms use a `<textarea class="quote-box">` with `maxlength`, plus a "N of 500 characters" line (`.char-count`) tied to it by `aria-describedby`.
  - `updateCharCount()` in main.js refreshes the line on every input, and when the dialog opens. The add form's line is also rendered by the server, so a refused quote shows its count.
  - The line isn't a live region, so screen readers read the count when they reach the box, not after every key.
  - The server collapses line breaks into spaces, like any other whitespace.
- **Messages:** the bottom-right message (`#message`) sits inside a `role="status"` region that is always on the page, so screen readers announce it. `showMessage()` empties it when it hides, so a repeated message is announced again.
- **Search and sort:** both sit above the list.
  - The search is a plain GET form (`role="search"`, a hidden `sort` when it's "new"). The two sort links mark the current one with `aria-current="true"`.
  - A search adds "N quotes match “…”" (or "No quotes match") with a "Show all quotes" link.
  - Everything is in the address, so results can be shared, and the reload after an edit keeps them.
- **The like button** is a toggle.
  - It starts as an outline heart with `aria-pressed="false"`. After a like it's a solid heart, `"true"`, with the title "Remove your like".
  - `handleLike()` calls `/removeUpvote` when it's pressed and `/addUpvote` otherwise, then `showLiked()` updates it.
  - A `data-busy` flag ignores presses while a request runs. It's not `disabled`, which would knock keyboard focus off the button.
- **The like button's name** comes from visually hidden text ("Like quote by …. Likes:") plus the visible count. Text buttons ("Add Quote", "Save Changes") have no `aria-label`, so their name matches what's on screen (WCAG 2.5.3).
- **EJS escaping:** use `<%=` for anything a visitor typed, attribute values included. Keep `<%-` for includes.
- **`hidden`:** `#editError` is shown and hidden with the `hidden` attribute, so `.form-error` has no `display` rule. A class that sets `display` overrides `hidden`.
- **The CSP has no `'unsafe-inline'`.**
  - No inline scripts, `onclick`-style attributes, `style=""` attributes or `<style>` blocks; setting `element.style` from main.js is fine.
  - The JSON-LD blocks are data, not scripts, so they need no exception.
  - Outside hosts: cdnjs (Font Awesome, loaded with an `integrity` hash: change the version and the hash together) and Google Fonts (Roboto 400, 500 and 700).
- **Colors meet WCAG AA:**

  | Color | Used for | Contrast |
  |---|---|---|
  | `#2471a3` | buttons, links, the header gradient's end | 5.3:1 against white |
  | `#1b5a85` | hover | |
  | `#5f6b6d` | gray text | 5.5:1 |
  | `#1e8449` | success messages | |
  | `#c0392b` | errors | |
  | `#899396` | input borders | 3.1:1, the minimum for a form control's outline |

  Check any new color against its background.
- **`prefers-reduced-motion`:** the block at the end of style.css cuts animations and transitions for visitors who ask for less motion.
- **`public/favicon.png`** is favicon.svg rendered at 512px with headless Chromium.
- **`public/og-image.png`** (1200×630) is the social card that link previews show (`og:image`, `twitter:card` `summary_large_image`), on the home and privacy pages.
  - It's rendered from the HTML template `~/projects/.scratchpad/wisdomwell/social-card/card.html` (on Bobby's Pi) with headless Chromium.
  - To change it, edit the template, render it again, and keep the width, height and alt tags in step.

## The privacy policy

`views/privacy.ejs` is Bobby's own text, not generated.
- Don't change its wording: flag problems and draft new wording for him to approve.
- Section 4 describes the one cookie, `ww_key`, and says there are no tracking cookies. The policy also lists its third-party services. A change that adds a cookie, a new use of data or a new service needs a policy update in the same PR, with Bobby's approval.

## Checking changes

- **`npm test`.**
- **The smoke kit** (on Bobby's Pi, `~/projects/.scratchpad/wisdomwell/smoke`) runs the app against a throwaway mongod: the app on port 3998, mongod on 27021.
  - The scripts: `start.sh`, `check.sh` (API checks), `uiCheck.js` (headless Chromium, through the page) and `stop.sh`.
  - Run it from a git worktree. It sets `DB_STRING` itself, and refuses a folder with a `.env`.
- **Never test against the production database.**

## Work in progress

An approved plan (Oct 30 2026), one PR at a time.

Done:
- PR #2: adding, editing, liking and deleting fixes. This file arrived with it.
- PR #3: page, accessibility and CSP fixes.
- PR #4: the quote box with a character count, the social card, and two fixes from Bobby's checks (reloads after a refused quote; the faint ×).
- PR #5: own quotes (above), with the privacy wording, and a fix for tap-to-close on iPhones.
- PR #6: one like per browser, with privacy lines.
- PR 7: sort and search.

Next:
8. "Inspire me" from the ZenQuotes API: display-only, with the credit link their free tier requires. Their terms forbid republishing, so it can't be saved to the collection.
9. A README refresh.

PR 8 also changes what the privacy policy has to say. The full plan is `~/.claude/plans/hey-claude-sorry-i-swirling-bentley.md` on Bobby's Pi. Update this section as PRs merge.
