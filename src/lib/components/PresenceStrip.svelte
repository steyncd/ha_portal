<script lang="ts">
  // Overview "Who's home" card — each family member's presence at a glance
  // (home / out / at a named zone), from HA person.* entities.
  import { ha } from "../store.svelte";

  type Person = { id: string; name: string; initial: string; color: string };
  const PEOPLE: Person[] = [
    { id: "person.christo_steyn", name: "Christo", initial: "C", color: "var(--acc)" },
    { id: "person.mandri_steyn", name: "Mandri", initial: "M", color: "var(--health, #f472b6)" },
    { id: "person.hello_liam_en_eben", name: "Liam & Eben", initial: "L", color: "var(--water)" },
  ];

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
  function status(id: string): { label: string; home: boolean; away: boolean } {
    const s = ha.state(id);
    if (!s || s === "unknown" || s === "unavailable") return { label: "—", home: false, away: false };
    if (s === "home") return { label: "Home", home: true, away: false };
    if (s === "not_home") return { label: "Out", home: false, away: true };
    return { label: cap(s), home: false, away: false }; // a named zone (Work, School…)
  }

  const rows = $derived(PEOPLE.filter((p) => ha.exists(p.id)).map((p) => ({ p, ...status(p.id) })));
  const homeCount = $derived(rows.filter((r) => r.home).length);
</script>

{#if rows.length}
  <div class="w card who">
    <div class="wh"><span class="lb">Who's home</span><span class="sub">{homeCount}/{rows.length} home</span></div>
    <div class="people">
      {#each rows as r (r.p.id)}
        <div class="person">
          <span class="av" style="background:color-mix(in srgb,{r.p.color} 22%,transparent);color:{r.p.color}">
            {r.p.initial}<span class="dot" class:home={r.home} class:away={r.away}></span>
          </span>
          <div class="pm"><div class="pn">{r.p.name}</div><div class="pst" class:on={r.home}>{r.label}</div></div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .who { padding: 18px; }
  .wh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
  .lb { font-size: 13px; font-weight: 700; color: var(--text-2); }
  .sub { font-size: 12px; color: var(--dim); }
  .people { display: flex; flex-direction: column; gap: 12px; }
  .person { display: flex; align-items: center; gap: 12px; }
  .av { position: relative; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-size: 15px; font-weight: 800; flex: none; }
  .dot { position: absolute; right: -1px; bottom: -1px; width: 12px; height: 12px; border-radius: 50%; background: var(--muted); box-shadow: 0 0 0 3px var(--card, #121821); }
  .dot.home { background: var(--success); }
  .dot.away { background: var(--muted-2, #64748b); }
  .pn { font-size: 13.5px; font-weight: 600; color: var(--text); }
  .pst { font-size: 11.5px; color: var(--muted); margin-top: 1px; }
  .pst.on { color: var(--success); }
</style>
