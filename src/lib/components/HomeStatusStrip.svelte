<script lang="ts">
  // Overview status strip (docs §12 portal-coverage): a severe-weather alert tile
  // (shown only when active), the Waze commute tile, and a home-services strip
  // (NextDNS block-rate, printer ink, internet health). Every item self-guards on
  // entity availability, so anything missing simply drops out.
  import { ha } from "../store.svelte";
  import Icon from "./Icon.svelte";
  import { n } from "../format";

  const severeActive = $derived(ha.isOn("binary_sensor.severe_weather_active"));
  const severeText = $derived(ha.state("sensor.severe_weather_warning"));

  const commuteMin = $derived(ha.num("sensor.waze_commute_to_work"));
  const commuteDist = $derived(ha.attr("sensor.waze_commute_to_work", "distance") as number | undefined);
  const commuteRoute = $derived(ha.attr("sensor.waze_commute_to_work", "route") as string | undefined);

  const dnsPct = $derived(ha.num("sensor.dns_blocked_percent"));
  const ink = $derived(ha.num("sensor.printer_lowest_ink"));
  const inkCartridge = $derived(ha.attr("sensor.printer_lowest_ink", "cartridge") as string | undefined);
  const netUp = $derived(ha.available("binary_sensor.internet_up") ? ha.isOn("binary_sensor.internet_up") : null);

  const inkLow = $derived(ink != null && ink <= 15);
  const hasServices = $derived(dnsPct != null || ink != null || netUp != null);
</script>

{#if severeActive || commuteMin != null || hasServices}
  <div class="strip">
    {#if severeActive}
      <div class="tile warn">
        <div class="ico"><Icon name="cloud" size={20} /></div>
        <div class="body">
          <div class="lb">Severe weather</div>
          <div class="val">{severeText ?? "Alert active"}</div>
        </div>
      </div>
    {/if}

    {#if commuteMin != null}
      <div class="tile">
        <div class="ico car"><Icon name="car" size={20} /></div>
        <div class="body">
          <div class="lb">Commute to work</div>
          <div class="val">{n(commuteMin)} min{#if commuteDist != null} · {n(commuteDist, 1)} km{/if}</div>
          {#if commuteRoute}<div class="sub">{commuteRoute}</div>{/if}
        </div>
      </div>
    {/if}

    {#if hasServices}
      <div class="tile services">
        {#if netUp != null}
          <div class="svc" class:bad={netUp === false}>
            <Icon name="wifi" size={16} />
            <div><div class="sv">{netUp ? "Online" : "Down"}</div><div class="sk">Internet</div></div>
          </div>
        {/if}
        {#if dnsPct != null}
          <div class="svc">
            <Icon name="shield" size={16} />
            <div><div class="sv">{n(dnsPct, 1)}%</div><div class="sk">DNS blocked</div></div>
          </div>
        {/if}
        {#if ink != null}
          <div class="svc" class:bad={inkLow}>
            <Icon name="printer" size={16} />
            <div><div class="sv">{n(ink)}%{#if inkLow} low{/if}</div><div class="sk">{inkCartridge ? `${inkCartridge} ink` : "Printer ink"}</div></div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin-bottom: 14px; }
  .tile { display: flex; align-items: center; gap: 12px; background: var(--card, rgba(255, 255, 255, 0.04)); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); border-radius: 16px; padding: 14px 16px; }
  .tile.warn { border-color: color-mix(in srgb, var(--warn, #f5a623) 55%, transparent); background: color-mix(in srgb, var(--warn, #f5a623) 12%, transparent); }
  .ico { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; background: rgba(255, 255, 255, 0.06); color: var(--acc); flex: none; }
  .tile.warn .ico { color: var(--warn, #f5a623); background: color-mix(in srgb, var(--warn, #f5a623) 18%, transparent); }
  .ico.car { color: var(--security, #6ea8fe); }
  .body { min-width: 0; }
  .lb { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); font-weight: 600; }
  .val { font-size: 15px; font-weight: 700; color: var(--text); margin-top: 2px; }
  .tile.warn .val { font-weight: 600; font-size: 13.5px; line-height: 1.3; }
  .sub { font-size: 12px; color: var(--muted); margin-top: 1px; }
  .services { justify-content: space-around; gap: 8px; }
  .svc { display: flex; align-items: center; gap: 8px; color: var(--acc); }
  .svc.bad { color: var(--warn, #f5a623); }
  .sv { font-size: 14px; font-weight: 700; color: var(--text); }
  .svc.bad .sv { color: var(--warn, #f5a623); }
  .sk { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }
</style>
