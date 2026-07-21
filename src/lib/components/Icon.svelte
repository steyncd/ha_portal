<script lang="ts">
  // Line icons (Aurora Command §1): 1.7px stroke, currentColor, 24×24, sized via
  // font-size/props. Inherit colour from the parent (domain-tinted in the nav).
  let { name, size = 16 }: { name: string; size?: number } = $props();

  const P: Record<string, string> = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    chart: '<path d="M4 20V4M4 20h16"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="5" width="3" height="12"/>',
    droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    leaf: '<path d="M4 20c0-8 6-14 16-14 0 10-6 16-16 14z"/><path d="M9 15c3-3 6-4 9-5"/>',
    door: '<rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none"/>',
    shield: '<path d="M12 3 5 6v5c0 4 3 7 7 8 4-1 7-4 7-8V6z"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
    car: '<path d="M5 16v-4l2-5h10l2 5v4"/><path d="M3 16h18"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/>',
    bulb: '<path d="M9.5 18h5"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    plug: '<path d="M9 3v5M15 3v5"/><path d="M6 8h12v2a6 6 0 0 1-12 0z"/><path d="M12 16v5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-3.8 4-6 7.5-6s6.7 2.2 7.5 6"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M9 14.5 7 22l5-3 5 3-2-7.5"/>',
    trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  };
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {@html P[name] ?? ""}
</svg>
