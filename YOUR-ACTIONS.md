# What needs your hands — in order

Everything else in the redesign is built, deployed and verified. This is the list
that needs a person, ordered so the cheap-and-important things come first.

T11 and T1 are excluded, as you asked. If you change your mind on T1 later, the
instructions are in `HA-FINDINGS.md` and the only thing I need from you is the
output of `vainfo`.

---

## 1 · Merge `portal-vision` into `main` — 2 minutes

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

## 2 · Check the InfluxDB retention policy — 1 minute

This is I5, and it is the one unanswered investigation. Retention lives on the
InfluxDB **server**, which I cannot see from the config mount, so "no retention
policy set" is currently unverified rather than confirmed.

**Settings → Add-ons → InfluxDB → open the Web UI**, then in the query console:

```sql
SHOW RETENTION POLICIES ON homeassistant
```

**How to read it:**

- `duration 0s` on `autogen` → **no retention. The database grows forever.**
- Anything else → you already have a policy and there is nothing to do.

If it is `0s`, set 400 days — long enough for the 90-day baselines and a
year-on-year comparison, short enough to stop unbounded growth:

```sql
ALTER RETENTION POLICY autogen ON homeassistant DURATION 400d
```

**Why it matters more than it sounds:** InfluxDB feeds the ten `90d_baseline`
sensors, which feed the Insights view, which is the only thing in the house that
notices standby power creeping up. A full disk takes that out silently.

---

## 3 · Add the beams sun-follow helpers — 5 minutes

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

## 4 · Clear the garage beam bypass — 1 minute

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

## 5 · Verify the two new nightly jobs — tomorrow morning, 2 minutes

They run at **02:10** and **02:20** for the first time tonight.

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
