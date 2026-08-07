<script lang="ts">
  // Overview "Power & grid" card — SA-specific context: loadshedding status and
  // the Eskom time-of-use tariff period/rate + next change. Useful every day for
  // TOU load-shifting, and it turns loud (red) the moment loadshedding is active.
  import { ha } from "../store.svelte";
  import { E } from "../entities";
  import { n } from "../format";

  const active = $derived(ha.isOn(E.loadsheddingActive));
  const status = $derived(ha.state(E.loadsheddingStatus));
  const urgency = $derived(ha.num(E.loadsheddingUrgency));
  const urgencyLevel = $derived(ha.attr(E.loadsheddingUrgency, "level") as string | undefined);
  const stage = $derived(ha.state(E.eskomStage));
  const period = $derived(ha.state(E.eskomTariffPeriod));
  const rate = $derived(ha.num(E.eskomRate));
  const nextChange = $derived(ha.state(E.eskomNextChange));
  const soc = $derived(ha.num(E.batterySoc));

  // Tariff-period colour: peak = warning, standard = neutral, off-peak = good.
  const periodColor = $derived(
    /peak/i.test(period ?? "") && !/off/i.test(period ?? "") ? "var(--warning)"
    : /off.?peak/i.test(period ?? "") ? "var(--success)"
    : "var(--text-2)",
  );
  const cap = (s: string | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
</script>

<div class="w card grid" class:alert={active}>
  <div class="wh">
    <span class="lb">Power &amp; grid</span>
    {#if urgency != null}<span class="urg" class:hot={urgency >= 60}>{n(urgency)}% risk</span>{/if}
  </div>

  <div class="ls" class:on={active}>
    <span class="ic">{active ? "⚡" : "✅"}</span>
    <div class="lsx">
      <div class="lst">{status ?? (active ? "Loadshedding active" : "No loadshedding")}</div>
      {#if urgencyLevel}<div class="lss">{urgencyLevel}{stage && stage !== "0" && stage !== "unknown" ? ` · Stage ${stage}` : ""}</div>{/if}
    </div>
  </div>

  <div class="tou">
    <div class="trow">
      <span class="tk">Tariff now</span>
      <span class="tv" style="color:{periodColor}">{cap(period)}{rate != null ? ` · R${n(rate, 2)}/kWh` : ""}</span>
    </div>
    {#if nextChange}
      <div class="trow"><span class="tk">Next change</span><span class="tv">{nextChange}</span></div>
    {/if}
    {#if soc != null}
      <div class="trow"><span class="tk">Battery reserve</span><span class="tv" style="color:{soc <= 30 ? 'var(--warning)' : 'var(--success)'}">{n(soc)}%</span></div>
    {/if}
  </div>
</div>

<style>
  .grid.alert { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--error) 55%, transparent); }
  .wh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .urg { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-2); background: rgba(255,255,255,0.05); border-radius: 999px; padding: 3px 9px; }
  .urg.hot { color: var(--warning); background: color-mix(in srgb, var(--warning) 16%, transparent); }
  .ls { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 13px; background: color-mix(in srgb, var(--success) 9%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 20%, transparent); margin-bottom: 12px; }
  .ls.on { background: color-mix(in srgb, var(--error) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--error) 30%, transparent); }
  .ic { font-size: 22px; flex: none; }
  .lst { font-size: 14px; font-weight: 700; color: var(--text); }
  .lss { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .tou { display: flex; flex-direction: column; gap: 9px; }
  .trow { display: flex; justify-content: space-between; align-items: baseline; font-size: 12.5px; }
  .tk { color: var(--muted); }
  .tv { font-weight: 700; color: var(--text-2); }
</style>
