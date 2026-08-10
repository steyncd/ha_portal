# Home Assistant — investigation results and what still needs you

Answers to `HA-TASKS.md` Part A, plus the state of each Part B fix. Written after
working through the brief against the live config on `/Volumes/config`.

**Read the blocked list first** — four tasks all fail on the same thing, and it is
not a hard problem, it is just something only you can reach.

---

## Part A — investigations

### I1 · Is Zigbee2MQTT running? — **No. ZHA is, and there is no conflict.**

Flagged as a possible live risk (two coordinators fighting over one USB dongle).
It is not happening:

- `.storage/core.config_entries` has **one** `zha` entry — *Sonoff Zigbee 3.0 USB
  Dongle Plus* — and one `mqtt` entry pointing at `192.168.0.7`.
- There is **no `/config/zigbee2mqtt` directory**. Z2M cannot run without one.
- The only references to z2m anywhere are **three unused blueprints** in
  `blueprints/switch_manager/` (Aqara E1, IKEA Styrbar, Aqara mini). They are
  inert files, not a running integration.

**One caveat, stated plainly:** the add-on list lives outside the config mount, so
I cannot enumerate installed add-ons from here. But an installed-and-running Z2M
would need a config directory, and there isn't one.

**Action: none.** The risk does not exist.

### I3 · Is the stale SQLite recorder database really stale? — **There is no SQLite database at all.**

`configuration.yaml:41` —

```yaml
recorder:
  db_url: !secret mariadb_url
  purge_keep_days: 30
  commit_interval: 30
  auto_purge: true
```

No `home-assistant_v2.db` exists on the mount. The recorder has been on external
MariaDB with a 30-day purge the whole time, so there is no orphaned SQLite file
consuming disk or confusing anything.

**Action: none.** The premise was wrong.

### I4 · What is in the 29 HomeKit entries? — **30, and they are one bridge per accessory.**

- **29 × `homekit`** (HA exporting accessories to Apple Home) plus **1 ×
  `homekit_controller`** (HA consuming a HomeKit device — the Mi Smart Home Hub).
- Each `homekit` entry is its **own bridge on its own port** — 21088, 21089,
  21090, 21091, 21092 and upward. Titles include `Main Gate:21089`,
  `JoJo Tank:21090`, `Driveway:21091`.

This works, but it is the heavy pattern: 29 bridges means 29 mDNS advertisers, 29
ports and 29 pairing records, where one bridge exposing 29 accessories would do
the same job. It is not urgent and it is not broken.

**Action if you want it tidier:** consolidate into one or two bridges grouped by
purpose. That means re-pairing in Apple Home, so it is a weekend job, not a
five-minute one. I would leave it unless Apple Home is actually misbehaving.

### I5 · InfluxDB retention and volume — **cannot be answered from the config mount.**

`configuration.yaml:277` sets `default_measurement`, `max_retries` and the
include/exclude lists. Retention is a property of the **InfluxDB server**, not of
HA's client config, and the database lives inside the add-on where I cannot see
it.

So I can confirm what HA *writes* (6 whole domains plus 23 entity globs — a lot)
but not what Influx *keeps*.

**Action for you, two commands in the InfluxDB add-on's terminal or UI:**

```bash
influx -execute 'SHOW RETENTION POLICIES ON homeassistant'
```

If the answer is `autogen` with `duration 0s`, there is no retention policy and
the database grows forever. A sensible policy for this house is 400 days — long
enough for the 90-day baselines and a year-on-year comparison, short enough to
stop unbounded growth.

### I2 · Which detect streams are H.265? — **blocked, see below.**

---

## Blocked: four tasks, one cause

**T1** (Frigate hardware decode), **T2** (driveway detects on the main stream),
**T3** (three smaller dials) and **T11** (Gemini key out of the file) all require
editing **Frigate's live configuration**, and I cannot reach it.

Here is the specific problem, because it matters:

`/Volumes/config/frigate.yml` is the **only** Frigate config on the mount. It has
**4 cameras**. Your live Frigate has **6**. I established earlier in this project
that this file is a stale copy the add-on does not read — and I proved it the hard
way, by editing it once and having the change do nothing.

That file currently shows `hwaccel_args: []` (T1 not applied) and, encouragingly,
`api_key: "{FRIGATE_GEMINI_API_KEY}"` — so T11's env-var form is already in *this*
copy. Whether the live config matches, I cannot tell from here.

**I am not going to edit it again.** Guessing which copy is live is how the last
round of Frigate work was wasted.

### What you need to do — T11 first, it is two minutes and the highest risk

**T11 · Get the Gemini key out of the config file.** This is a cloud API key with
billing attached, in a file that goes into the nightly Drive backup. Different
risk class from the camera passwords you deferred.

1. Frigate add-on → **Configuration** tab → Options → add:
   `FRIGATE_GEMINI_API_KEY` = your key
2. In the live `frigate.yml`, ensure the line reads
   `api_key: "{FRIGATE_GEMINI_API_KEY}"` — Frigate does its own `{ENV}`
   substitution, so HA's `!secret` will **not** work here.
3. Restart the add-on.

**T1 · The hardware decode fix — the biggest single win in the brief.** The
diagnosis in the brief is correct and worth restating: `iHD` is the **wrong
driver** for this CPU. iHD covers Gen9+ (Skylake onward); a 4th-gen i5 is Haswell,
Gen7.5, and needs the legacy **`i965`**. "The iHD driver fails to init" was the
expected outcome, not evidence that the hardware lacks the capability.

Do not conflate the two things: **OpenVINO** accelerates *detection* and does need
Skylake+ (correctly ruled out). **QuickSync** accelerates *decode*, and Haswell
has it for H.264.

1. Frigate add-on → Configuration → add env var `LIBVA_DRIVER_NAME=i965`
2. Restart, then in the add-on terminal run `vainfo`.
   **If `vainfo` fails, stop and tell me** — do not enable hwaccel on a driver
   that did not initialise. That is how you turn a CPU problem into no cameras.
3. Only if it initialises and lists H.264 decode entry points, set
   `ffmpeg.hwaccel_args: preset-vaapi`, keeping the old line commented above it.
4. Watch for 15 minutes: host CPU, per-camera `detection_fps`, and especially
   **`skipped_fps`, which must stay at 0**. Note that `skipped_fps` spikes for
   about a minute after any restart — I mistook that for a fault earlier in this
   project, so give it 90 seconds before judging.

**Rollback is one line:** restore `hwaccel_args: []`.

Once `vainfo` output exists, paste it to me and I can answer **I2** (which detect
streams are actually H.265, and therefore which cameras this will and will not
help) from the codec entry points.

---

## Part B — what is already done

### T4 · The alarm asymmetry — **complete, and verified.**

This was flagged as the most consequential change in the brief, and it is done.
Every one of the nine raw call sites is repointed, commented with the brief and
the incident date, and I confirmed the important invariant:

> **No uncommented `alarm_control_panel.alarm_*` call exists anywhere in the
> config except inside `scripts.yaml`** — which is the one place allowed to make
> it, since that is where the `_safe` wrappers live.

The comments at the call sites carry a sharper diagnosis than the brief had, and
it is worth repeating here because it explains the whole class of bug:

> On this IDS panel the raw service call is a **keypad toggle**. Sent to an area
> that is already disarmed, `alarm_disarm` **arms** it. Sent to an area already
> armed, `alarm_arm_away` **disarms** it.

That is why the `_safe` wrappers check current state before acting, and why
restoring a raw call would silently reintroduce the 2026-07-01 18:54 failure.

### T6 · Audit safety-adjacent `unavailable` triggers — **the dangerous six are done.**

Fixed earlier today with `from:` or `not_from:` pinned:

| Automation | Guard |
|---|---|
| `alarm_triggered_emergency_response` | `not_from: [unknown, unavailable]` |
| `1781446268054` (Zone Alert + Camera) | `not_from: [unknown, unavailable]` |
| `night_optimization_auto_shed_poor_projection` | `from: 'off'` |
| `presence_pool_pump_away_mode` | `from: 'off'` |
| `borehole_pump_prevent_on_when_full` | `from: 'off'` |
| `home_away_orchestration` | `not_from`, both directions |

`not_from` rather than `from` on the alarm ones, because a **panic press
legitimately goes `disarmed → triggered`** — pinning `from` to the armed states
would have silenced the one case that matters most. Both triggered automations
would otherwise have sent a critical push with a camera snapshot every time the
Olarm cloud link blipped.

**17 unguarded triggers remain, all alert-only.** `alarm_offline_alert` is
deliberately excluded — it *watches for* `unavailable`, so pinning `from:` would
break the alert it exists to send. A bulk scripted edit of `automations.yaml` was
blocked by the sandbox, which I think is the right call for a file that controls
your alarm and pumps; the rest can go one at a time.

### T8 · Emit restarts and reloads as events — **complete.**

`sensor.ha_last_machine_event` in `feature_alarm_provenance.yaml`, firing on
`homeassistant.start`, `automation_reloaded`, `scene_reloaded`,
`event_template_reloaded` and `core_config_updated`. The Security hub interleaves
these with alarm transitions, so a reload one second before an actor-less disarm
is one glance — and the hero says *"12 seconds after a config reload"* in words.

### T12 · Expose scripts to the LLM as named tools — **not started.**

101 scripts. Named-tool exposure with typed arguments is the highest-leverage
item left on the HA side and the cheapest route to a voice layer, but it is a day
of work on its own and it needs the deterministic gate kept intact: model
proposes, code decides.

---

## Still to do, in the order I would do them

1. **T11** — the API key. Two minutes, and it is the only item here with billing
   attached.
2. **I5** — run the retention query. One command, and it tells you whether a disk
   is quietly filling.
3. **T1 + I2** — the `i965` driver. Biggest performance win in the brief; send me
   `vainfo` and I will finish I2 from it.
4. **T5, T7, T9, T10** — Watchman, consequence labels, documenting the duplicated
   packages, retiring the unused Lovelace surface. All safe, none urgent.
5. **T12** — the script tool layer, when there is a clear day for it.
