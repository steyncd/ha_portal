# Handback to Claude Design — Steyn Home v2, after the first implementation pass

Claude Code has implemented the v2 handover on `steyncd/ha_portal@portal-vision`
(9 commits, ~66 files, ~3 900 lines). Phases 1, 2.1, 2.2, 2.3, 3.1, 3.2 and 4 are
in; Phase 5 is partial. Everything below is either **a question only you can
answer**, **a place the package contradicted itself**, or **a spec that turned
out not to match the house**.

Please answer in the same form as the original handover — prototype first, prose
second — because that is the order that resolved every ambiguity so far.

---

## A. The package contradicts itself in one place. Which wins?

`BUILD-ORDER.md` §1.2 says:

> drop `text-transform:uppercase` from `.lb`/`.micro` **except section dividers**

`Steyn Portal v3.dc.html` renders the three section labels — **You usually**,
**Right now**, **Wants you** — at `11px / 700 / --mut` with **no transform and no
tracking**. The uppercase treatment in the prototype belongs to *card kickers*:
`VANAAND 21:00`, `JULIE · DIE MAAND`, `OP DIE TV`, `WHO TO CALL`, at `11px / 700
/ .1em` in copper.

README says the prototype wins, so I split the token into two classes:

- `.divider` — section labels, sentence case, `--mut`
- `.kicker` — card headers, uppercase, `.1em`, `--acc`

**Question:** is that the intended distinction, and is `.kicker` the right name
for it? If BUILD-ORDER's wording was simply loose, say so and I'll stop treating
it as a conflict. If there IS a third treatment I have collapsed into one of
these, name it.

---

## B. Rail counts: derived numbers disagree with the prose

BUILD-ORDER §3.2 gives: **Energy(5) · Water(3) · Security(4) · Rooms(6) ·
Household(7) · Me(4)**, and also says "counts derive from the route table". Those
two instructions conflict, because the route table does not contain enough views
to hit some of those numbers.

I followed "derive from the route table". Actual counts now:

| Hub | Count | Folded views |
|---|---|---|
| Energy | 5 | Energy detail, Solar, Power trends, Batteries, Appliances |
| Water | 2 | Water detail, Irrigation |
| Security | 4 | Security detail, Cameras, Traffic, Timeline |
| Rooms | 2 | Lights, Vitality |
| Household | 6 | Kids, Meals, Faith, Fair Play, Trello, Reminders |
| Me | 4 | Me detail, Focus, Usage, Insights |

**Question:** Water(3) and Rooms(6) are the gaps. Water's third was "Pumps" —
there is no Pumps view; pumps are rows inside Water and Appliances. Rooms(6)
implies four more views than exist. **Were you counting views, or something else
— zones, rooms, sub-sections?** If the numbers are the target, tell me what the
missing entries are and I will build them; if the routes are the target, the
numbers in BUILD-ORDER should come down.

---

## C. Three specs that do not match the house

These are facts I verified against `/Volumes/config`, not preferences.

**1. Olarm does not expose the acting user.** HA brief C says "Olarm and Alarmo
both expose the changing user". `custom_components/olarm/alarm_control_panel.py`
`extra_state_attributes` returns only `armed_custom_bypass_profile`,
`zone_in_alarm`, `zone_in_alarm_time`. The MQTT payload carries `deviceEvents`,
but `coordinator.py` extracts nothing except `eventAction == "zone_alarm"` and
discards the rest.

So provenance is: `ui` (a person via the portal, named) · `auto` (an automation)
· `panel` (keypad, remote or the Olarm app — **real but not attributable to a
person**) · `flap` (to/from unavailable, a machine event).

The hero currently reads *"the panel — keypad, remote or the Olarm app"* for that
case. **Question:** is that the copy you want, or would you rather the hero
degrade differently when the actor is a place rather than a person? A fork of the
integration to keep `deviceEvents` is possible but is a maintenance burden and
may still yield no user field.

**2. The alarm helper ids are different.** Phase 4 names
`input_boolean.auto_arm_home` / `input_datetime.auto_arm_home_time`. The real
ones, from `core.entity_registry`:

```
input_boolean.alarm_auto_arm_away    input_datetime.alarm_auto_arm_away_time
input_boolean.alarm_auto_arm_stay    input_datetime.alarm_auto_arm_stay_time
input_boolean.alarm_auto_disarm      input_datetime.alarm_auto_disarm_time
input_boolean.alarm_auto_arm_beams   input_datetime.alarm_auto_arm_time_beams
input_boolean.alarm_auto_disarm_beams input_datetime.alarm_auto_disarm_time_beams
+ a weekend pair: *_2 / *_time_2 for away and stay
```

Rows name the real ids. **No question — just confirming the substitution.**

**3. `beams_follow_sun` does not exist.** The Clock/Sun toggle is specified and
built, but there is no backing helper, so it renders only when one appears.
**Question:** should the portal create it, or is this an HA-side item for
Christo? If the former, name it and say what the automation should do with it.

---

## D. What I need design for, to finish Phase 5

These are built as scaffolds and need the same treatment the rest of the package
got — a prototype screen, not prose.

**1. The chore approval flow.** §5.2 calls this "the feature, not the chore
list", and it is the largest thing still missing. Three levels — photo proof →
timed auto-approve with a countdown the child sees → self-certifying after five
consecutive approvals — plus a visible trust meter, plus one-tap approval of the
whole day from the evening digest.

I need: what the child sees at each level, what the countdown looks like while it
runs, how the trust meter renders (and what it does when trust is *lost*), and
what the parent's one-tap approval looks like in the digest AND in the app.

**2. Eben's shell, concretely.** §5.2 says icon-led, one screen, ~150px targets,
no money, no streaks, the tick is the reward. `phone-05-kids-eben.png` shows the
idea but I cannot read the interaction from it: what happens between tapping a
chore and it being approved, from an 8-year-old's side?

**3. Visitor passes.** §4 Account specifies scopes + hard expiry + share link +
a generated house-sitter brief. I need the scope vocabulary — what a pass can
actually be scoped TO, in your intended taxonomy, since "views" is explicitly
the wrong answer ("a role that only hides views is tidiness, not security").

**4. The TV audit.** "A record, not a remote." I need to know what the record
looks like — hours per show per person, over what window, and what the reader is
supposed to DO with it. Without that it is a table nobody opens, which is the
Grafana failure again.

**5. Household's four stats.** Every other hub board has four stat cards drilling
to layer 2. Household currently has *Die maand / Water / Takies / Bin day*, which
I chose. **Please confirm or replace** — this is the one board where I invented
the top-level metrics rather than reading them from you.

---

## E. Small things, if you have a view

- **`Now` tab three is labelled "Fair Play"**, not "Household", until the real
  Household phone surface exists. Fine, or would you rather it read Household and
  point at the partial screen?
- **Timeline** composites eight rooms into one occupancy band, so colour was the
  only room identifier — and the shipped palette had the mint/sky/cyan cluster.
  I re-spaced it onto four cool + four warm, interleaved, L≈33–87. Christo
  approved the deviation, but the package didn't specify it, so **a palette from
  you would be better than mine.**
- **Small multiples** are on a fixed 4-column grid sharing a midnight→now axis,
  expanding in place. Gaps break the line rather than interpolating. Confirm the
  gap treatment is what you intended — it is the one visible consequence of "a
  missing value never renders as 0" inside a chart.

---

## F. What is done, so you do not re-specify it

Freshness type · nine themes · the re-spaced heat ramp · Sheet with a real focus
trap · undo restoring true prior state · the offline queue · three notification
classes with the always-sends digest · `Now` with the leaving check · nav 18→9
with a 68px rail and derived counts · `HubBoard` and `SmallMultiples` · Energy,
Water and Security boards · ten Settings sections including the two independently
scheduled alarm areas and the Cheatsheet · alarm provenance end to end (HA package
+ Security hero + interleaved machine events) · `BatterySignal` showing level and
LQI together · the Afrikaans library and the generated-text language line.

Nine latent bugs were found and fixed on the way; they are documented in the
commit messages on `portal-vision` if that is useful context.
