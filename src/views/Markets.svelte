<script lang="ts">
  import { ha } from "../lib/store.svelte";

  // ---- helpers ---------------------------------------------------------------
  const num = (id: string) => ha.num(id);
  const str = (id: string) => ha.state(id);
  const attr = (id: string, k: string) => ha.attr(id, k);
  const fmt = (v: number | null, d = 2) => (v == null ? "—" : v.toFixed(d));
  const pts = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString("en-ZA"));

  // ---- interest rates & outlook ---------------------------------------------
  const repo = $derived(num("sensor.sarb_repo_rate"));
  const prime = $derived(num("sensor.sarb_prime_rate"));
  const outlook = $derived(str("sensor.rate_outlook") ?? "—");
  const daysToMpc = $derived(num("sensor.days_to_mpc_meeting"));
  const lastMove = $derived((attr("sensor.rate_outlook", "last_move") as string) ?? "—");
  const curveSlope = $derived(attr("sensor.rate_outlook", "curve_slope") as string | undefined);
  const outlookColor = $derived(
    outlook.startsWith("Easing") ? "var(--success)" : outlook.startsWith("Tightening") ? "var(--warning)" : "var(--acc)",
  );

  // ---- inflation -------------------------------------------------------------
  const cpi = $derived(num("sensor.sa_inflation_cpi"));
  const ppi = $derived(num("sensor.sa_inflation_ppi"));

  // ---- bonds -----------------------------------------------------------------
  const r2030 = $derived(num("sensor.sa_r2030_bond_yield"));
  const r209 = $derived(num("sensor.sa_r209_bond_yield"));
  const sabor = $derived(num("sensor.sabor_overnight_rate"));

  // ---- FX --------------------------------------------------------------------
  const fx = $derived([
    { label: "USD / ZAR", flag: "🇺🇸", v: num("sensor.usd_zar_rate") },
    { label: "EUR / ZAR", flag: "🇪🇺", v: num("sensor.eur_zar_rate") },
    { label: "GBP / ZAR", flag: "🇬🇧", v: num("sensor.gbp_zar_rate") },
  ]);

  // ---- equities --------------------------------------------------------------
  const pepPrice = $derived(num("sensor.pepkor_share_price"));
  const pepChg = $derived(num("sensor.pepkor_change_pct") ?? NaN);
  const pepPrev = $derived(Number(attr("sensor.pepkor_share_price", "chartPreviousClose") ?? NaN) / 100);
  const pepColor = $derived(isNaN(pepChg) ? "var(--dim)" : pepChg >= 0 ? "var(--success)" : "var(--warning)");
  const top40 = $derived(num("sensor.jse_top_40"));
  const allShare = $derived(num("sensor.jse_all_share"));

  // ---- load-shedding (national) ---------------------------------------------
  const natStage = $derived(num("sensor.eskom_national_stage"));
</script>

<div class="col">
  <!-- Interest rate hero -->
  <div class="kpis">
    <div class="card k">
      <div class="lb">🏦 Repo rate</div>
      <div class="big">{fmt(repo, 2)}<span class="u">%</span></div>
      <div class="sub">Prime {fmt(prime, 2)}% · {lastMove}</div>
    </div>
    <div class="card k">
      <div class="lb">🧭 Rate outlook</div>
      <div class="big" style="color:{outlookColor};font-size:24px">{outlook}</div>
      <div class="sub">{daysToMpc == null ? "—" : `${daysToMpc} days`} to next SARB MPC · curve slope {curveSlope ?? "—"}%</div>
    </div>
  </div>

  <!-- Rates & inflation strip -->
  <div class="card pad">
    <div class="rh"><span class="lb">Rates &amp; inflation</span><span class="sub">SA Reserve Bank · official</span></div>
    <div class="grid5">
      <div class="mini-stat"><span class="ms-v">{fmt(repo, 2)}%</span><span class="ms-l">Repo</span></div>
      <div class="mini-stat"><span class="ms-v">{fmt(prime, 2)}%</span><span class="ms-l">Prime</span></div>
      <div class="mini-stat"><span class="ms-v">{fmt(sabor, 2)}%</span><span class="ms-l">SABOR o/n</span></div>
      <div class="mini-stat"><span class="ms-v">{fmt(cpi, 1)}%</span><span class="ms-l">CPI</span></div>
      <div class="mini-stat"><span class="ms-v">{fmt(ppi, 1)}%</span><span class="ms-l">PPI</span></div>
    </div>
  </div>

  <!-- Bond yields -->
  <div class="card pad">
    <div class="rh"><span class="lb">Government bond yields</span><span class="sub">market rate expectations</span></div>
    <div class="split2">
      <div class="card sk in"><div class="lb">R2030 (2030)</div><div class="big">{fmt(r2030, 2)}<span class="u">%</span></div></div>
      <div class="card sk in"><div class="lb">R209 (2036)</div><div class="big">{fmt(r209, 2)}<span class="u">%</span></div></div>
      <div class="card sk in"><div class="lb">Curve slope</div><div class="big">{curveSlope ?? "—"}<span class="u">%</span></div></div>
    </div>
  </div>

  <!-- Equities -->
  <div class="kpis">
    <div class="card k">
      <div class="lb">🛍️ Pepkor (PPH)</div>
      <div class="big">R{fmt(pepPrice, 2)} <span class="chg" style="color:{pepColor}">{isNaN(pepChg) ? "" : `${pepChg >= 0 ? "+" : ""}${pepChg.toFixed(2)}%`}</span></div>
      <div class="sub">JSE · prev R{fmt(pepPrev, 2)}</div>
    </div>
    <div class="card k">
      <div class="lb">📈 JSE indices</div>
      <div class="big" style="font-size:24px">{pts(top40)}<span class="u"> Top40</span></div>
      <div class="sub">All Share {pts(allShare)}</div>
    </div>
  </div>

  <!-- FX -->
  <div class="card pad">
    <div class="rh"><span class="lb">Rand exchange rates</span><span class="sub">SARB reference</span></div>
    <div class="split2">
      {#each fx as p}
        <div class="card sk in"><div class="lb">{p.flag} {p.label}</div><div class="big">{fmt(p.v, 2)}</div></div>
      {/each}
    </div>
  </div>

  <!-- National grid status -->
  <div class="callout">
    <div class="co">
      <span class="cov" style="color:{natStage && natStage > 0 ? 'var(--warning)' : 'var(--success)'}">
        {natStage == null ? "—" : natStage > 0 ? `Stage ${natStage}` : "None"}
      </span>
      <span class="cok">national load-shedding</span>
    </div>
    <div class="co"><span class="cov">R{fmt(num("sensor.brent_crude_oil"), 0)}</span><span class="cok">Brent crude (USD)</span></div>
    <div class="co"><span class="cov">R{fmt(num("input_number.petrol_95_current"), 2)}</span><span class="cok">petrol 95 · now</span></div>
  </div>

  <p class="foot">SA Reserve Bank, Eskom &amp; JSE (via Yahoo). Market data for reference only — personal finances live in HQ, not here.</p>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } }
  .k { padding: 18px; }
  .big { font-size: 30px; font-weight: 800; margin-top: 6px; }
  .u { font-size: 14px; color: var(--dim); font-weight: 600; }
  .chg { font-size: 15px; font-weight: 700; margin-left: 4px; }
  .sub { font-size: 12px; color: var(--dim); margin-top: 3px; }
  .lb { font-size: 13px; color: var(--muted-2); font-weight: 600; }
  .pad { padding: 20px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
  .grid5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  @media (max-width: 640px) { .grid5 { grid-template-columns: repeat(2, 1fr); } }
  .mini-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; border-radius: 12px; background: var(--soft); }
  .ms-v { font-size: 20px; font-weight: 800; }
  .ms-l { font-size: 11px; color: var(--dim); }
  .split2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 640px) { .split2 { grid-template-columns: 1fr; } }
  .sk { padding: 14px; }
  .sk.in { display: flex; flex-direction: column; gap: 2px; }
  .sk .big { font-size: 22px; margin-top: 2px; }
  .callout { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 640px) { .callout { grid-template-columns: 1fr; } }
  .co { display: flex; flex-direction: column; gap: 4px; padding: 16px; border-radius: 14px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
  .cov { font-size: 22px; font-weight: 800; }
  .cok { font-size: 12px; color: var(--dim); }
  .foot { font-size: 11px; color: var(--dim); text-align: center; margin: 4px 0 0; }
</style>
