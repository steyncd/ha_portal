<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { toast } from "../lib/toast.svelte";

  const TIERS = ["Blue", "Bronze", "Silver", "Gold", "Diamond"];
  const TIER_COLOR: Record<string, string> = {
    Blue: "#5b8def",
    Bronze: "#cd7f32",
    Silver: "#c0c8d4",
    Gold: "#e8b923",
    Diamond: "#7fe3ff",
  };

  const annual = $derived(ha.num("input_number.vitality_points_annual") ?? 0);
  const currentTier = $derived(ha.state("sensor.vitality_current_tier") ?? "Blue");
  const nextTier = $derived(ha.state("sensor.vitality_next_tier") ?? "Bronze");
  const toNext = $derived(ha.num("sensor.vitality_points_to_next_tier") ?? 0);

  const thresholds = $derived({
    Bronze: ha.num("input_number.vitality_threshold_bronze") ?? 15000,
    Silver: ha.num("input_number.vitality_threshold_silver") ?? 50000,
    Gold: ha.num("input_number.vitality_threshold_gold") ?? 80000,
    Diamond: ha.num("input_number.vitality_threshold_diamond") ?? 100000,
  });

  // progress through the CURRENT tier band toward the next threshold
  const ringPct = $derived.by(() => {
    const bands: Record<string, number> = { Blue: 0, ...thresholds };
    const cur = bands[currentTier] ?? 0;
    const nxt = (thresholds as Record<string, number>)[nextTier] ?? cur + 1;
    if (nxt <= cur) return 100;
    return Math.max(0, Math.min(100, ((annual - cur) / (nxt - cur)) * 100));
  });

  // ---- weekly Active Rewards ----
  const weeklyPct = $derived(ha.num("sensor.vitality_weekly_goal_progress") ?? 0);
  const weeklyEst = $derived(Number(ha.attr("sensor.vitality_weekly_goal_progress", "estimated") ?? 0));
  const weeklyGoal = $derived(Number(ha.attr("sensor.vitality_weekly_goal_progress", "goal") ?? 900));
  const weeklyRemaining = $derived(Number(ha.attr("sensor.vitality_weekly_goal_progress", "remaining") ?? 0));

  // ---- gym 75%-off ----
  const gymStatus = $derived(ha.state("sensor.vitality_gym_discount_status") ?? "—");
  const gymVisits = $derived(Number(ha.attr("sensor.vitality_gym_discount_status", "visits") ?? 0));
  const gymTarget = $derived(Number(ha.attr("sensor.vitality_gym_discount_status", "target") ?? 36));
  const gymOnTrack = $derived(String(ha.attr("sensor.vitality_gym_discount_status", "on_track")) === "true"
    || ha.attr("sensor.vitality_gym_discount_status", "on_track") === true);
  const gymPct = $derived(Math.max(0, Math.min(100, (gymVisits / (gymTarget || 36)) * 100)));

  // ---- cardio ----
  const cardioLevel = $derived(ha.state("sensor.vitality_cardio_fitness_level") ?? "Unknown");
  const vo2 = $derived(ha.attr("sensor.vitality_cardio_fitness_level", "vo2_max"));

  const fmt = (n: number) => n.toLocaleString("en-ZA");

  const configured = $derived(ha.exists("sensor.vitality_current_tier"));

  // ---- actions ----
  function logGym() {
    ha.script("script.vitality_log_gym_visit");
    toast.show("🏋️ Gym visit logged");
  }

  let pointsDraft = $state<string>("");
  let editingPoints = $state(false);
  function startEditPoints() {
    pointsDraft = String(annual);
    editingPoints = true;
  }
  function savePoints() {
    const v = Number(pointsDraft);
    if (Number.isFinite(v) && v >= 0) {
      ha.setNumber("input_number.vitality_points_annual", v);
      toast.show("Vitality points updated");
    }
    editingPoints = false;
  }

  function setStatus(e: Event) {
    const opt = (e.target as HTMLSelectElement).value;
    ha.setSelect("input_select.vitality_status", opt);
    toast.show(`Status set to ${opt}`);
  }
</script>

{#if !configured}
  <div class="empty">
    <div class="ecard">
      <div class="eicon">🏅</div>
      <strong>Vitality isn't loaded yet</strong>
      <p>
        The <code>feature_vitality.yaml</code> package hasn't been picked up by Home
        Assistant. Restart HA (Settings → System → Restart), then seed your annual
        points and status here.
      </p>
    </div>
  </div>
{:else}
  <div class="grid">
    <!-- HERO: tier ring -->
    <section class="card hero">
      <div class="ring" style="--pct:{ringPct}; --c:{TIER_COLOR[currentTier] ?? '#7c5cff'}">
        <div class="ring-in">
          <span class="tier" style="color:{TIER_COLOR[currentTier] ?? '#fff'}">{currentTier}</span>
          <span class="pts">{fmt(annual)} pts</span>
        </div>
      </div>
      <div class="hero-meta">
        <div class="steps">
          {#each TIERS as t}
            <span class="dot" class:on={TIERS.indexOf(t) <= TIERS.indexOf(currentTier)}
              style="--tc:{TIER_COLOR[t]}" title={t}></span>
          {/each}
        </div>
        {#if toNext > 0}
          <p class="tonext"><strong>{fmt(toNext)}</strong> points to {nextTier}</p>
        {:else}
          <p class="tonext">Top tier reached 🎉</p>
        {/if}
        {#if editingPoints}
          <div class="editrow">
            <input type="number" bind:value={pointsDraft} min="0" step="100" />
            <button class="btn sm" onclick={savePoints}>Save</button>
            <button class="btn sm ghost" onclick={() => (editingPoints = false)}>Cancel</button>
          </div>
        {:else}
          <button class="btn sm ghost" onclick={startEditPoints}>Update points from app</button>
        {/if}
        <label class="statuspick">
          Recorded status
          <select value={currentTier} onchange={setStatus}>
            {#each TIERS as t}<option value={t}>{t}</option>{/each}
          </select>
        </label>
      </div>
    </section>

    <!-- WEEKLY ACTIVE REWARDS -->
    <section class="card">
      <div class="ch"><span class="ci">🎯</span><h3>Weekly Active Rewards</h3></div>
      <div class="bigrow">
        <span class="big">{weeklyPct}%</span>
        <span class="sub">~{fmt(weeklyEst)} / {fmt(weeklyGoal)} pts</span>
      </div>
      <div class="bar"><div class="fill" style="width:{Math.min(100, weeklyPct)}%"></div></div>
      {#if weeklyRemaining > 0}
        <p class="hint">{fmt(weeklyRemaining)} pts to go — a 30-min workout or 10k steps closes it. Miss it and this week's Discovery Miles (up to 750) are gone.</p>
      {:else}
        <p class="hint good">Weekly goal met — Discovery Miles secured 💎</p>
      {/if}
    </section>

    <!-- GYM 75% OFF -->
    <section class="card">
      <div class="ch"><span class="ci">🏋️</span><h3>Virgin Active — 75% off</h3></div>
      <div class="bigrow">
        <span class="big">{gymVisits}<span class="of">/{gymTarget}</span></span>
        <span class="sub" class:good={gymOnTrack}>{gymStatus}</span>
      </div>
      <div class="bar"><div class="fill" class:good={gymOnTrack} style="width:{gymPct}%"></div></div>
      <p class="hint">36 visits per rolling 12 months unlocks 75% off. That's ~3× a week.</p>
      <button class="btn logbtn" onclick={logGym}>＋ Log gym visit</button>
    </section>

    <!-- CARDIO -->
    <section class="card">
      <div class="ch"><span class="ci">❤️‍🔥</span><h3>Cardio fitness</h3></div>
      <div class="bigrow">
        <span class="big">{cardioLevel}</span>
        {#if vo2 != null && vo2 !== "unknown" && vo2 !== "unavailable"}
          <span class="sub">VO₂ max {vo2}</span>
        {/if}
      </div>
      <p class="hint">Cardio fitness level is worth up to 10,000 Vitality points a year — measured from your Oura VO₂ max.</p>
    </section>
  </div>
{/if}

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
  .card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 20px;
    backdrop-filter: var(--glass-blur);
  }
  .hero { grid-column: 1 / -1; display: flex; gap: 28px; align-items: center; flex-wrap: wrap; }

  /* tier ring */
  .ring {
    --size: 168px;
    width: var(--size); height: var(--size); flex-shrink: 0; border-radius: 50%;
    background:
      radial-gradient(closest-side, rgba(10,15,22,0.92) 79%, transparent 80% 100%),
      conic-gradient(var(--c) calc(var(--pct) * 1%), rgba(255,255,255,0.08) 0);
    display: grid; place-items: center;
    box-shadow: 0 0 34px -10px var(--c);
  }
  .ring-in { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .tier { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .pts { font-size: 13px; color: var(--muted, #9fb0c3); }
  .hero-meta { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 12px; }
  .steps { display: flex; gap: 8px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,0.12); }
  .dot.on { background: var(--tc); box-shadow: 0 0 10px -2px var(--tc); }
  .tonext { font-size: 17px; }
  .tonext strong { font-size: 22px; color: var(--acc, #b9a8ff); }

  .ch { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
  .ci { font-size: 18px; }
  h3 { font-size: 14.5px; font-weight: 700; }
  .bigrow { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
  .big { font-size: 34px; font-weight: 800; letter-spacing: -1px; }
  .big .of { font-size: 18px; font-weight: 600; color: var(--muted, #9fb0c3); }
  .sub { font-size: 13px; color: var(--muted, #9fb0c3); font-weight: 600; text-align: right; }
  .sub.good { color: var(--success, #43d17a); }

  .bar { height: 9px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; background: var(--grad, linear-gradient(90deg,#7c5cff,#4ac0ff)); transition: width 0.4s ease; }
  .fill.good { background: linear-gradient(90deg, #2fbf71, #43d17a); }

  .hint { font-size: 12px; color: var(--text-2, #b6c5d6); margin-top: 12px; line-height: 1.5; }
  .hint.good { color: var(--success, #43d17a); }

  .btn { border-radius: 12px; padding: 11px 18px; font-weight: 700; font-size: 13.5px; background: var(--grad, linear-gradient(90deg,#7c5cff,#4ac0ff)); color: #0b1017; }
  .btn.ghost { background: rgba(255,255,255,0.07); color: var(--text, #eef4fc); }
  .btn.sm { padding: 7px 12px; font-size: 12.5px; }
  .logbtn { margin-top: 14px; width: 100%; }

  .editrow { display: flex; gap: 8px; align-items: center; }
  .editrow input { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 8px 10px; color: var(--text, #eef4fc); font-size: 14px; }
  .statuspick { display: flex; flex-direction: column; gap: 5px; font-size: 11px; color: var(--muted, #9fb0c3); font-weight: 600; }
  .statuspick select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 8px 10px; color: var(--text, #eef4fc); font-size: 13px; }

  .empty { display: grid; place-items: center; padding: 40px 20px; }
  .ecard { max-width: 440px; text-align: center; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 28px; }
  .eicon { font-size: 40px; margin-bottom: 10px; }
  .ecard p { color: var(--text-2, #b6c5d6); font-size: 13px; margin-top: 8px; line-height: 1.6; }
  code { background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 6px; font-size: 12px; }
</style>
