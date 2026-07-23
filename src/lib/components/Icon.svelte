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
    // domain objects (appliances / pumps)
    fridge: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 10h12"/><path d="M9 6.3v1.6M9 12.5v3"/>',
    washer: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6.2h.01M11 6.2h.01"/>',
    cup: '<path d="M6 8h11v4.5a5 5 0 0 1-10 0z"/><path d="M17 9h1.5a2 2 0 0 1 0 4H17"/><path d="M8.5 3.2v2M11.5 3.2v2"/>',
    microwave: '<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="6" y="8" width="9" height="8" rx="1"/><path d="M18 8.5v7"/>',
    pot: '<path d="M5 9h14l-1 9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M3.5 9h17"/><path d="M9 5l1 2M15 5l-1 2"/>',
    flame: '<path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3.2 1.6-3.8 0 1.4 1.2 2.2 2 2.2 0-2.6 1.4-3.9 1.4-5.4z"/>',
    wifi: '<path d="M2.5 8.5a15 15 0 0 1 19 0"/><path d="M5.5 12a10 10 0 0 1 13 0"/><path d="M8.5 15.3a5 5 0 0 1 7 0"/><circle cx="12" cy="18.8" r="0.7" fill="currentColor" stroke="none"/>',
    waves: '<path d="M2 8.5c2 0 2 1.4 4 1.4s2-1.4 4-1.4 2 1.4 4 1.4 2-1.4 4-1.4 2 1.4 4 1.4"/><path d="M2 13.5c2 0 2 1.4 4 1.4s2-1.4 4-1.4 2 1.4 4 1.4 2-1.4 4-1.4 2 1.4 4 1.4"/>',
    well: '<path d="M5 5h14"/><path d="M12 5v9"/><path d="M8 10l4 4 4-4"/><path d="M6 20h12"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18z"/>',
    snow: '<path d="M12 3v18M4.5 7l15 10M19.5 7l-15 10"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    printer: '<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="1.5"/><path d="M7 14h10v6H7z"/><circle cx="17" cy="12" r="0.7" fill="currentColor" stroke="none"/>',
    sliders: '<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 3-7s2 4-1 6M14 12c4 0 7 1 7 3s-4 2-6-1M12 14c0 4-1 7-3 7s-2-4 1-6M10 12c-4 0-7-1-7-3s4-2 6 1"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  };
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {@html P[name] ?? ""}
</svg>
