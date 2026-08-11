# Cloud services review — what I did, and what needs you

**Updated 2026-08-10, later.** I was wrong that `gcloud` was not installed — it is
at `~/google-cloud-sdk/bin/gcloud` and my non-login shell simply did not have it on
PATH. Correcting that, items **1, 2, 4 and 5 are now all done** and struck through
below. Only item 3 (the Maps key) and item 6 (Cloud Storage) still need you, plus a
decision on an account-wide budget.

Worked through `Steyn Cloud Services Review.html`. Its central claim checked out:
`@firebase/remote-config`, `performance`, `storage`, `analytics` and `ai` are all
in `package-lock.json` and none were imported anywhere in `src/`. So three of the
four headline recommendations were an import statement, not an integration.

**One correction to the document.** It says *"there is no BigQuery reference
anywhere in the repo — treat it as still-to-build, not as running."* That was true
of `main` when it was written, but it is not true now: `warehouseSnapshot` has been
running nightly for months, I found and fixed five wrong entity ids in it earlier
today, widened it from 15 to 29 columns, and added `askWarehouse` on top. It is
running, and it is now the thing "Ask my house" queries.

---

## Done and deployed

**Remote Config.** Four keys — `default_views`, `gemini_model`, `kill_switches`,
`notice` — each with a real in-app default, so the app behaves identically until
you create the parameters. `gemini_model` closes the trap that has already bitten
twice.

**Performance Monitoring.** With an `ha_first_state` trace: sign-in to the first
WSS entity snapshot, which is the real *app is usable* moment and invisible to any
page-load metric. Off in dev and mock so a laptop on fibre cannot pollute the
numbers.

**Health probe + monitoring webhook.** `healthProbe` every 5 minutes writes
`health/latest`; `monitoringHook` folds Cloud Monitoring alerts into the same doc.
Both surface as Diagnostics cards. This is the half of staleness that was
completely unbuilt — if HA went down, nothing told anyone.

**Leave-now.** The whole Routes API function, cached, weekday mornings only,
comparing against our own trailing median. Deployed and currently no-opping until
you add a key (step 3 below).

**TTL groundwork.** `interruptLog` now writes `expiresAt`, so a TTL policy starts
working immediately with no backfill.

**Also:** dropped the dead `gemini-2.5-flash` fallbacks from four Functions.

---

## ~~1 · A billing budget alert~~ — DONE, and the gap was worse than described

Five budgets already existed, all scoped to individual projects — and **none
covered `helloliam-ha-dashboard` or `steyn-family-finance`**, which are the two
this portal actually runs on. That is precisely the failure mode this item
predicted.

Created: **"Steyn Home portal (helloliam + finance)"**, $5 USD/month, both project
numbers, alerting at 50% / 90% / 100%, all credits included. Matches the pattern of
the existing five, which notify billing admins by email.

**One decision left for you.** There is still no *account-wide* catch-all, and
several other projects (steyn-hindsight, steyn-waypoint, steyn-homestead,
steyn-vault, ha-dashboard-steyncd, gen-lang-client) have no budget at all. I did
not create one because the amount would have been a guess: there is no billing
export to BigQuery, so I cannot see actual spend from here, and a figure set too
low alerts constantly while one set too high never fires. Tell me your rough
monthly total and I will add it.

Original instructions, now redundant:

The document is right that this is what makes everything else safe to try, and it
is the only mechanism that will actually tell you.

**Google Cloud Console → Billing → Budgets & alerts → Create budget**

- Scope: the whole billing account (**not** one project — free quotas are shared
  across `helloliam-ha-dashboard` and `steyn-family-finance`, so a per-project
  budget would miss half the spend)
- Amount: **R20/month**
- Alert thresholds: 50%, 90%, 100%
- Email: your address

Everything in this project is inside free tiers today. The budget is not there to
manage a bill, it is there to tell you the moment one starts.

---

## ~~2 · Create the Remote Config parameters~~ — DONE

Created from the CLI and live as version 1, via a committed
`remoteconfig.template.json` (so the parameters are in git rather than only in the
console, and `firebase deploy --only remoteconfig` re-applies them):

| Parameter | Default | What it is for |
|---|---|---|
| `default_views` | the ten current views | what a FRESH install sees; your own prefs still win |
| `gemini_model` | `gemini-3.5-flash` | change the model with no redeploy — the trap that bit twice |
| `kill_switches` | empty | hide a misbehaving widget at 22:00 |
| `notice` | empty | one line at the top of Home for the household |

The app already had real in-app defaults for all four, so this changed nothing
about how it behaves — it just means the switches now exist where you can reach
them. Nothing safety-critical is remotely configurable: a kill switch can hide a
widget, never touch the alarm.

Original instructions, now redundant:

The app already works without these. Creating them is what makes the console
useful.

**Firebase Console → Remote Config → Create configuration**

| Parameter | Type | Value |
|---|---|---|
| `default_views` | String | `home,overview,energy,water,security,climate,household,me,diagnostics,settings` |
| `gemini_model` | String | `gemini-3.5-flash` |
| `kill_switches` | String | *(leave empty)* |
| `notice` | String | *(leave empty)* |

**What each one buys you:**

- **`gemini_model`** — the next time a model is retired, you change one string in
  a console instead of editing `functions/index.js` and redeploying. `gemini-2.5-*`
  already died once on this key.
- **`kill_switches`** — comma-separated feature ids. If one widget starts throwing
  at 22:00, you switch it off from your phone rather than shipping a build.
- **`notice`** — one line the whole household sees. "Borehole off until Saturday",
  that sort of thing.

Then add a **condition** targeting the wall screen if you want the TV to have a
different default view set — that is how the kiosk idea works without a second
codebase.

---

## 3 · The Maps key, for leave-now — 10 minutes

The function is deployed and skipping itself until this exists. It is
shape-checked, so it will not fire malformed requests at Google in the meantime.

**Step 1 — create a restricted key.**
Google Cloud Console → APIs & Services → Credentials → **Create credentials → API
key**, then immediately **Restrict key**:

- **API restrictions:** Routes API *only*. Nothing else.
- **Application restrictions:** None needed — this key is server-side only and
  never enters the bundle. Do **not** add an HTTP-referrer restriction, which
  would break a server-to-server call.

**Step 2 — enable the Routes API** (APIs & Services → Library → Routes API →
Enable).

**Step 3 — give it to the function:**

```bash
cd /Users/christo/Code/HA_Portal && npx firebase-tools functions:secrets:set MAPS_KEY
```

Paste the key when prompted, then redeploy:

```bash
cd /Users/christo/Code/HA_Portal && npx firebase-tools deploy --only functions:leaveNow,functions:leaveNowLate,functions:leaveNowNow
```

**Step 4 — the coordinates.** `functions/index.js` has a `ROUTES` array with
**placeholder coordinates** near Pretoria. I left them as placeholders
deliberately rather than guessing: a wrong destination produces a confident wrong
number, which is worse than the row being absent. Send me the real ones — home,
school, and either office — and I will wire them, or edit them yourself in that
array.

About 250 calls a month against a 10 000 free allowance.

---

## ~~4 · The uptime check~~ — DONE

- **Uptime check** "Home Assistant reachable": HTTPS, `ha.helloliam.co.za`, path
  `/`, port 443, **5-minute** period, 30-second timeout, three regions (Europe,
  Asia-Pacific, US-Virginia — the API requires at least three). About 26 000
  executions/month against a free million. I used 5 minutes rather than the 1
  minute below because `healthProbe` already covers this from the inside every 5
  minutes; this is the outside-in view, and it does not need to be finer.
- **Email notification channel** for steyncd@gmail.com.
- **Alert policy** "Home Assistant unreachable": fires when the check fails from
  **more than one region for 10 minutes**, auto-closes after 30. More than one
  region deliberately — a single probe location failing is usually the probe.

The webhook half is NOT done. It needs `MONITORING_TOKEN` pasted into a URL, and I
would rather not put a shared secret into a query string on your behalf. Email
alerting works today; add the webhook yourself if you want the findings to become
Diagnostics cards too.

Original instructions:

`healthProbe` already covers HA reachability every 5 minutes, so this is the
belt-and-braces layer plus function-error alerting.

**Cloud Console → Monitoring → Uptime checks → Create**

- Protocol HTTPS, hostname `ha.helloliam.co.za`, path `/`
- Check frequency **1 minute** (about 44 000 executions/month against a free
  million)
- Regions: one is plenty

Then **Monitoring → Alerting → Create policy** on Cloud Functions execution
errors, and add a **Webhook** notification channel pointing at:

```
https://us-central1-helloliam-ha-dashboard.cloudfunctions.net/monitoringHook?token=YOUR_TOKEN
```

Get `YOUR_TOKEN` from **Secret Manager → MONITORING_TOKEN → view latest version**.
I generated it — it is a shared webhook token we chose, not a credential of yours.

Anything that policy fires becomes a Diagnostics card automatically.

**One date to remember:** Cloud Monitoring starts charging for alerting-policy
metric references no sooner than **1 September 2027**. Cheap, but not free forever
— keep the policy count small.

---

## ~~5 · Firestore TTL policies~~ — DONE, both of them

| Collection | Field | State |
|---|---|---|
| `interruptLog` | `expiresAt` | ACTIVE |
| `waRate` | `expiresAt` | CREATING → settles on its own |

`waRate` needed a code change first: it wrote `{count, windowStart}` and no
`expiresAt`, so the policy would have been a no-op exactly as this section warned.
`waInbound` now writes `expiresAt` two days out — long enough that a clock skew or
a late retry still finds its window, short enough that nothing accumulates.

Original instructions:

Free, server-side, and removes cleanup code you would otherwise have to write and
remember.

**Firebase Console → Firestore → TTL → Create policy** for each:

| Collection | Field |
|---|---|
| `interruptLog` | `expiresAt` |
| `waRate` | `expiresAt` |

`interruptLog` already writes the field. `waRate` does not yet — tell me if you
want the policy and I will add it, since a policy on a missing field silently does
nothing.

---

## 6 · Cloud Storage — the boys' surface

This is the one the document is most right about: the portal has **nowhere to put
a file**. `parseDocument` takes a receipt, extracts JSON, and throws the original
away — so a wrong extraction can never be checked against the paper.

And it is what the kids' surface actually needs. The chore approval flow I built
today has photo-proof as its first trust level, and right now "send a photo" is a
state the chore enters rather than an actual upload, because there is no bucket.

**Before any code:**

1. **Firebase Console → Storage → Get started.** Note: since 3 February 2026 a
   project using a default bucket must be on **Blaze** — the free 5 GB quota still
   applies, it just wants a billing account attached. With the budget alert from
   step 1 in place, that is safe.
2. **Enforce App Check on Storage** before the boys' phones can upload.
3. **Set lifecycle rules per prefix on day one**, not later — 5 GB is generous
   until a camera-clip archive finds it:
   - `chores/` → 30 days
   - `anpr/` → 14 days
   - `documents/` → keep

Tell me when the bucket exists and I will wire the photo-proof upload, which turns
level-1 chores from a state into a real photograph Mandri can look at.

---

## 7 · Worth doing, no rush

**A `kiosk` second Hosting site.** The right answer for the wall screen — its own
build with wall density baked in, no login prompt on a screen nobody signs into.
I have deliberately *not* half-built this: it needs a separate build target and
config, which is a small project rather than a bolt-on. Say the word and I will do
it properly.

**Auth custom claims.** `WA_BOOTSTRAP_ADMINS` is a hardcoded email array in
`functions/index.js`. Claims put `parent` / `kid` / `guest` in the token where
`firestore.rules` can read them, which would make the kid surface *enforceable*
rather than merely hidden. Worth doing when we next touch auth.

**Hosting preview channels.** Free, and gives every design change a temporary URL
with an expiry — a real device in a real hand before it reaches the family.

**Air Quality API.** Pretoria's winter inversion and veld-fire smoke are a real
household variable with no sensor. Same key mechanics as step 3. Render it as a
labelled band on the blue→amber ramp, never the stock green-to-red AQI.

**Pollen API** — the document flags this as the one item it would not commit to
sight-unseen, and it is right. "65+ countries" is not a promise about South
Africa. Spend one free call on your coordinates and read the response before
anything gets designed around it.

---

## Deliberately not doing

Per the document's own "ruled out" section, which I agree with: **Firebase SQL
Connect** (Cloud SQL is not in Always Free), **Firebase Studio** (shuts down March
2027), **Analytics** (a four-person audience — you can ask Mandri),
**Crashlytics** (no web target), **Vision / Speech-to-Text / Document AI** (all one
Gemini call you already make), **Compute Engine** (a machine to patch forever that
cannot see your Zigbee), **Google Home APIs** (native only, and the household
abandoned HA's own dashboard so a second control plane is not the goal), and
**Solar API** (estimation is a downgrade from a measured Victron array).

**Firebase AI Logic** I have parked rather than ruled out. Moving the interactive
Gemini calls client-side would drop a proxy hop, but it also moves the retry loop
and the model-fallback chain out of one place I control into the client — and the
document names `gemini-3.6-flash`, which I have not verified exists on your key.
Worth doing after Remote Config is live, so the model name is server-controlled
first.

**Firestore full-text search for ⌘K** is genuinely appealing — typing "geyser"
instead of an entity id — but I could not verify the new query engine is available
on your database from here, and building a search index against an API that might
not be enabled is how you get a broken palette. Confirm it appears in your
Firestore console and I will wire it.
