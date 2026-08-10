<script lang="ts">
  // Settings › Alarm — Phase 4.
  //
  // TWO INDEPENDENTLY SCHEDULED AREAS. Home/interior (25 zones) and Outdoor
  // beams (6 perimeter beams) each get their own arm and disarm rows, and the
  // backing HA helper is NAMED in the row. That naming is not documentation
  // decoration: when the automation and the portal disagree, the only way to
  // find out which one is lying is to know which entity the row writes.
  //
  // The portal writes the helper and reads it straight back. It never keeps its
  // own copy of the schedule — the automation stays the single source of truth,
  // so nothing can drift out of step with what the house will actually do.
  //
  // The brief named these helpers input_boolean.auto_arm_home and friends. The
  // real ones are alarm_auto_arm_away / _stay / _beams (verified against
  // core.entity_registry), so those are what the rows write and name.
  import { ha } from "../store.svelte";
  import SettingRow from "./SettingRow.svelte";
  import TimeStepper from "./TimeStepper.svelte";
  import Toggle from "./Toggle.svelte";

  type Sched = {
    label: string;
    explain: string;
    onOff: string;
    time: string;
  };

  // Home / interior.
  const HOME: Sched[] = [
    {
      label: "Arm away",
      explain: "input_boolean.alarm_auto_arm_away · input_datetime.alarm_auto_arm_away_time",
      onOff: "input_boolean.alarm_auto_arm_away",
      time: "input_datetime.alarm_auto_arm_away_time",
    },
    {
      label: "Arm stay",
      explain: "input_boolean.alarm_auto_arm_stay · input_datetime.alarm_auto_arm_stay_time",
      onOff: "input_boolean.alarm_auto_arm_stay",
      time: "input_datetime.alarm_auto_arm_stay_time",
    },
    {
      label: "Disarm",
      explain: "input_boolean.alarm_auto_disarm · input_datetime.alarm_auto_disarm_time",
      onOff: "input_boolean.alarm_auto_disarm",
      time: "input_datetime.alarm_auto_disarm_time",
    },
  ];

  // Weekend override — its own pair of times, because the schedule that suits a
  // school night is wrong on a Saturday.
  const WEEKEND: Sched[] = [
    {
      label: "Arm away · weekend",
      explain: "input_boolean.alarm_auto_arm_away_2 · input_datetime.alarm_auto_arm_away_time_2",
      onOff: "input_boolean.alarm_auto_arm_away_2",
      time: "input_datetime.alarm_auto_arm_away_time_2",
    },
    {
      label: "Arm stay · weekend",
      explain: "input_boolean.alarm_auto_arm_stay_2 · input_datetime.alarm_auto_arm_stay_time_2",
      onOff: "input_boolean.alarm_auto_arm_stay_2",
      time: "input_datetime.alarm_auto_arm_stay_time_2",
    },
  ];

  const BEAMS: Sched[] = [
    {
      label: "Arm beams",
      explain: "input_boolean.alarm_auto_arm_beams · input_datetime.alarm_auto_arm_time_beams",
      onOff: "input_boolean.alarm_auto_arm_beams",
      time: "input_datetime.alarm_auto_arm_time_beams",
    },
    {
      label: "Disarm beams",
      explain: "input_boolean.alarm_auto_disarm_beams · input_datetime.alarm_auto_disarm_time_beams",
      onOff: "input_boolean.alarm_auto_disarm_beams",
      time: "input_datetime.alarm_auto_disarm_time_beams",
    },
  ];

  // Clock vs Sun for the beams. A fixed time is wrong by about ninety minutes
  // between June and December in Pretoria, so a beam schedule pinned to the
  // clock either arms in daylight or leaves the perimeter open after dark for
  // half the year.
  const SUN_MODE = "input_boolean.beams_follow_sun";
  const followSun = $derived(ha.exists(SUN_MODE) ? ha.isOn(SUN_MODE) : false);
  const sunAvailable = $derived(ha.exists(SUN_MODE));

  const on = (id: string) => ha.exists(id) && ha.isOn(id);
</script>

<section class="grp">
  <h3 class="kicker">Home · interior</h3>
  <p class="lead">25 zones. Scheduled on its own — disarming one area must never touch the other.</p>
  {#each HOME as s (s.onOff)}
    <SettingRow label={s.label} explain={s.explain}>
      {#snippet control()}
        <div class="pair">
          <Toggle on={on(s.onOff)} onchange={() => ha.setBoolean(s.onOff, !on(s.onOff))} />
          <TimeStepper entity={s.time} disabled={!on(s.onOff)} />
        </div>
      {/snippet}
    </SettingRow>
  {/each}
</section>

<section class="grp">
  <h3 class="kicker">Weekend override</h3>
  <p class="lead">Its own pair of times. A school-night schedule is wrong on a Saturday.</p>
  {#each WEEKEND as s (s.onOff)}
    <SettingRow label={s.label} explain={s.explain}>
      {#snippet control()}
        <div class="pair">
          <Toggle on={on(s.onOff)} onchange={() => ha.setBoolean(s.onOff, !on(s.onOff))} />
          <TimeStepper entity={s.time} disabled={!on(s.onOff)} />
        </div>
      {/snippet}
    </SettingRow>
  {/each}
</section>

<section class="grp">
  <h3 class="kicker">Outdoor beams</h3>
  <p class="lead">
    6 perimeter beams, scheduled independently of the house.
    {#if sunAvailable}
      Following the sun is the default: a fixed time is out by roughly 90 minutes
      between June and December in Pretoria.
    {/if}
  </p>

  {#if sunAvailable}
    <SettingRow
      label="Follow the sun"
      explain="Sunset −15 / sunrise +15 instead of a fixed clock time · {SUN_MODE}"
    >
      {#snippet control()}
        <div class="seg" role="group" aria-label="Beam schedule mode">
          <button class="sg" class:on={!followSun} onclick={() => ha.setBoolean(SUN_MODE, false)}>Clock</button>
          <button class="sg" class:on={followSun} onclick={() => ha.setBoolean(SUN_MODE, true)}>Sun</button>
        </div>
      {/snippet}
    </SettingRow>
  {/if}

  {#each BEAMS as s (s.onOff)}
    <SettingRow
      label={s.label}
      explain={followSun ? `Following the sun — the fixed time is ignored · ${s.time}` : s.explain}
    >
      {#snippet control()}
        <div class="pair">
          <Toggle on={on(s.onOff)} onchange={() => ha.setBoolean(s.onOff, !on(s.onOff))} />
          <TimeStepper entity={s.time} disabled={!on(s.onOff) || followSun} />
        </div>
      {/snippet}
    </SettingRow>
  {/each}
</section>

<section class="grp">
  <h3 class="kicker">Guards</h3>
  <p class="lead">Locked, not preferences. These are the rules that stop the house disarming itself.</p>
  <SettingRow
    label="Ignore unavailable transitions"
    explain={'A bare to: "on" also matches unavailable → on. Every safety-adjacent trigger pins from: or not_from:.'}
    value="On"
    lock
  />
  <SettingRow
    label="Flag changes with no actor"
    explain="Recorded per transition with the area, and raises an Interrupt when protection drops with nobody attached."
    value="On"
    lock
  />
  <SettingRow
    label="Never queue alarm actions offline"
    explain="They fail loudly instead. A queued disarm that lands twenty minutes later is worse than one that failed."
    value="On"
    lock
  />
  <SettingRow
    label="An automatic disarm needs a real schedule trigger"
    explain="Never an inferred state. This is the rule the 2026-08-09 incident was missing."
    value="On"
    lock
  />
  <SettingRow
    label="Disarming one area never touches the other"
    explain="House and beams are independent, in the schedule and in the service calls."
    value="On"
    lock
  />
</section>

<style>
  .grp { margin-bottom: 22px; }
  .lead { font-size: 12px; color: var(--mut); line-height: 1.5; margin: 6px 0 8px; text-wrap: pretty; }
  .pair { display: flex; align-items: center; gap: 10px; }
  .seg { display: inline-flex; gap: 2px; background: var(--fill); border-radius: var(--r-control); padding: 2px; }
  .sg { padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; color: var(--mut); background: none; min-height: 34px; }
  .sg.on { background: var(--fill-strong); color: var(--tx); }
</style>
