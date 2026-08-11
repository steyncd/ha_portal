# What needs your hands — in order

**Updated 2026-08-10, evening.** Items 1, 3 and 4 are now done and are struck
through below rather than deleted, so the record of what changed survives. Item 2
was answered and its original advice was DANGEROUS — read the correction.

Everything else in the redesign is built, deployed and verified. This is the list
that needs a person, ordered so the cheap-and-important things come first.

T11 and T1 are excluded, as you asked. If you change your mind on T1 later, the
instructions are in `HA-FINDINGS.md` and the only thing I need from you is the
output of `vainfo`.

---

## ~~1 · Merge `portal-vision` into `main`~~ — DONE

Merged and pushed. `main` is now the only copy that matters and hosting serves it.

The whole redesign lives on `portal-vision`: **37 commits**. `main` has not moved
since before any of it. Hosting already serves the built output, so this changes
nothing about what is live — it just stops the branch being the only copy.

```bash
cd /Users/christo/Code/HA_Portal && git checkout main && git merge portal-vision --no-ff -m "Merge the v2 redesign" && git push origin main
```

If you would rather review first:

```bash
cd /Users/christo/Code/HA_Portal && git log --oneline main..portal-vision
```

I have deliberately not done this myself — merging to your default branch is your
call, not mine.

---

## 2 · The InfluxDB retention policy — ANSWERED, and my advice was wrong

**Do not run the `ALTER RETENTION POLICY ... DURATION 400d` command that used to
be in this section.** I queried the server directly on 2026-08-10 and it would
have deleted about three and a half years of your history.

What is actually true:

```
SHOW RETENTION POLICIES ON home_assistant
name     duration  shardGroupDuration  replicaN  default
autogen  0s        168h0m0s            1         true
```

- `duration 0s` — so yes, **there is no retention policy and the database grows
  forever.** That part of the original suspicion was right.
- But the oldest point in the database is **2021-09-29**, across **4,950
  series**. A
  400-day policy deletes everything before roughly July 2025.
- And there is no pressure to decide: the disk is **39.8% used with 253.6 GiB
  free**.

I recommended 400 days without knowing how far back the data went. That was a
guess dressed as a recommendation, and acting on it would have been irreversible.

**What I did instead.** System Monitor was installed but all 85 of its sensors
were disabled — this house had no disk, memory or CPU reading anywhere. Eight are
now enabled, Diagnostics has a "The machine" card, and an automation warns at 85%
and 93%. The growth is now visible, which is the part that should not wait.

**What is left for you — a decision, not a task.** Three honest options:

1. **Leave it.** At 40% full and this growth rate you have years. You now get
   warned before it matters. This is a perfectly good answer.
2. **Keep everything, cap the future** — e.g. `DURATION 1825d` (five years).
   Deletes nothing today; the 2021 data starts expiring around September 2026.
3. **Trim hard** — 400d or similar, accepting the loss of pre-2025 history.

If you want option 2 or 3, tell me which and I will run it. I am not choosing how
much of your home's history to delete.

---

## ~~3 · Add the beams sun-follow helpers~~ — DONE

Built in `packages/feature_portal_gaps.yaml`:
`input_boolean.alarm_beams_follow_sun` and
`input_number.alarm_beams_sun_offset` (default +30 min, range −60 to +120), plus
the automation and the Settings › Alarm rows that were already waiting for them.
It is **off** — turning it on is yours. The fixed 22:10 schedule is untouched and
acts as a backstop.

Original instructions, now redundant:

The Settings → Alarm screen already has the Clock/Sun toggle built, rendering
**disabled with the reason** because the helper does not exist yet. This is the
correctness fix behind it: a fixed beam-arm time is wrong by roughly **90 minutes**
between June and December in Pretoria, so a clock-pinned schedule either arms the
perimeter in daylight or leaves it open after dark for half the year.

**Step 1.** Add to `configuration.yaml` (or a package):

```yaml
input_boolean:
  alarm_beams_follow_sun:
    name: Beams follow the sun
    icon: mdi:weather-sunset

input_number:
  alarm_beams_sun_offset:
    name: Beams sun offset
    min: -60
    max: 60
    step: 5
    unit_of_measurement: min
    icon: mdi:clock-outline
```

**Step 2.** Set the offset to **−15** once it exists (arm 15 minutes before
sunset).

**Step 3.** The automation that consumes it. When `alarm_beams_follow_sun` is
**on**, the beams arm at `sunset + offset` and disarm at `sunrise − offset`, and
the fixed-time helpers are ignored:

```yaml
automation:
  - id: beams_sun_arm
    alias: "Beams: arm at sunset (sun-following)"
    triggers:
      - trigger: sun
        event: sunset
        offset: "-00:15:00"
    conditions:
      - condition: state
        entity_id: input_boolean.alarm_beams_follow_sun
        state: "on"
    actions:
      # The guarded wrapper, never the raw service — on this panel the raw call
      # is a keypad toggle and would DISARM an already-armed area.
      - action: script.alarm_arm_beams_safe
    mode: single

  - id: beams_sun_disarm
    alias: "Beams: disarm at sunrise (sun-following)"
    triggers:
      - trigger: sun
        event: sunrise
        offset: "00:15:00"
    conditions:
      - condition: state
        entity_id: input_boolean.alarm_beams_follow_sun
        state: "on"
    actions:
      - action: script.alarm_disarm_beams
    mode: single
```

**Step 4.** Your existing fixed-time beam automations need one extra condition so
the two schedules cannot both fire:

```yaml
      - condition: state
        entity_id: input_boolean.alarm_beams_follow_sun
        state: "off"
```

**Step 5.** Reload automations (`Developer Tools → YAML → Automations`). No full
restart needed for automations, and **do not use Reload All** — it flaps template
sensors.

The portal picks the toggle up automatically once the helper exists; there is
nothing to change on my side.

---

## ~~4 · Clear the garage beam bypass~~ — ALREADY CLEAR

Checked against the panel on 2026-08-10: zone 030 is **not** bypassed. Its bypass
button was last pressed on 6 August and has been cleared since.
`sensor.alarm_bypassed_zones_2` reads **1** — zone 022 (Beam · Back Garden), which
is the deliberate standing bypass for the faulty beam.

You can now see and change all of this yourself: **Security → Zones** lists all 32
with live status and a bypass/restore control on each. The cheatsheet has been
corrected too.

Original text, which was true when written:

`binary_sensor.helloliam_alarm_zone_030_beam_garage` is bypassed with **no
expiry**. The Security hub reports it, and it is the exact thing the new
maintenance-window rule exists to prevent: a suppression nobody has to remember
to undo, which therefore never gets undone.

Two options, both fine:

- **Un-bypass it** in the Olarm app or at the keypad, if the beam is behaving now.
- **Keep it bypassed but give it an end date** — Settings → System → Maintenance
  windows, target `binary_sensor.helloliam_alarm_zone_030_beam_garage`, reason
  "faulty beam, waiting on a replacement", ends in two weeks. It will then expire
  on its own and speak up again.

The second is the honest option if the beam is genuinely faulty. The point is that
"indefinitely quiet" stops being available.

---

## ~~5 · Verify the two nightly jobs~~ — DONE, and one was broken

I triggered both early with `gcloud scheduler jobs run` rather than leaving you to
check in the morning. `firebase functions:log` does fail, but `gcloud logging read`
works fine — my earlier "credentials" explanation was wrong.

**`cadenceJob` works.** `measured=109 skipped=158`, `config/cadence` written. But
my expectation in this section was wrong: I said skipped "should be small" and it
is the majority. 109 entities is still 109 real p95 thresholds where there were
none, so the freshness badges are now measured rather than guessed for those — but
the skip rate is worth a look sometime.

**`applianceDrift` was failing every night and writing nothing.** HTTP **504 after
exactly 540.001 seconds** — it timed out. Two causes, and the first hid the second:

1. Its filter, `(current_consumption|_power)` minus `victron|solar|grid|battery`,
   matched **67 entities** including `multiplus_inverters_dc_power` and
   `venus_pv_power`. Drift on an inverter leg is the sun moving, not an appliance
   getting worse.
2. Those are the largest series in the recorder, and 67 sequential 30-day history
   fetches could not finish in nine minutes.

Fixed: the filter is now `current_consumption` (the Tapo/Matter convention) plus
seven named circuit meters, minus everything inverter-side — **18 entities, all
real loads** — and the fetches run four at a time. It now returns **200 in 235
seconds** with `checked=18 flagged=6`.

The six findings, for what they are worth:

| Entity | Baseline | Last 7 days | Change |
|---|---|---|---|
| living room TV plug | 28 W | 55 W | **+101%** |
| study router + HA | 229 W | 54 W | **−76%** |
| hallway/bedroom/living lights | 66 W | 32 W | −52% |
| borehole pump | 955 W | 469 W | −51% |
| microwave | 7 W | 10 W | +35% |
| kettle | 1 128 W | 1 499 W | +33% |

**The study router + HA one is worth your eyes** — a 229 W circuit dropping to
54 W is either something unplugged or a meter problem. The kettle and microwave are
probably artefacts: these are daily *means*, so for something used in bursts the
number tracks how often you used it, not its condition. Worth refining if the noise
bothers you.

They run nightly at **02:10** and **02:20**.

`cadenceJob` is the one that matters: it computes the observed p95 interval per
entity from 14 days of recorder history, and those become the freshness
thresholds. **Every "14 min old" badge in the app has been guessing from a
per-domain default until now** — `setCadence()` had existed since the first phase
with no caller at all.

**Firebase Console → Firestore → `config` → `cadence`** and check:

- `measured` should be a few hundred (there are 304 curated entities)
- `skipped` should be small — an entity with fewer than four state changes in a
  fortnight cannot yield a p95, and that is expected for things like a button

If `measured` is 0, tell me and I will look at the recorder query.

Then **`config` → `applianceDrift`** for `findings` — each metered plug whose last
7 days sit more than 25% off its own 30-day baseline. An empty list is a good
result, not a broken job.

---

## 6 · Two hardware jobs, whenever suits — no urgency

**The weak Zigbee links.** Kitchen button LQI **14**, bedroom button LQI **11**.
Presses are occasionally missed. The fix is a mains-powered Zigbee router (any
always-on Zigbee plug) roughly midway between the coordinator and those two
buttons — **not** new buttons. Nothing critical sits behind either of them, which
is deliberate, so this is comfort rather than safety.

**The street-light relay.** The Tapo cloud relay drops commands; there is a
self-heal loop retrying every 10 minutes, which masks it. Replacing the relay with
a local-control device (Shelly, or a Zigbee plug) removes both the fault and the
workaround.

---

## 7 · Rotate the camera and MQTT passwords — when you are ready

You deferred this and that is a reasonable call, but it should not be lost: the
Frigate config you pasted into a chat earlier contained the MQTT password and four
RTSP camera passwords in clear text. That paste is in this conversation's history.

Not urgent in the sense that nothing is exposed to the internet, but those
credentials should be considered known and changed at some point.

---

## Not doing, and why

- **T11 / T1** — excluded at your request.
- **The remaining 17 `unavailable` triggers** — all alert-only, so the worst case
  is a spurious notification rather than a spurious action. A bulk scripted edit
  of `automations.yaml` was blocked by the sandbox, which I think is right for a
  file that controls your alarm and pumps. They can go one at a time.
- **T5, T7, T9, T10** — Watchman, consequence labels, documenting the duplicated
  packages, retiring the unused Lovelace surface. All safe, none urgent.
- **T12, the script tool layer** — 101 scripts exposed as named LLM tools. The
  highest-leverage item left on the HA side and the cheapest route to a voice
  layer that works in Afrikaans, but it is a day of work and wants a clear run.
