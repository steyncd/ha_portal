// Calendars as entities. PLATFORM-CONCEPTS §8.
//
// Schedules attached to THINGS, instead of a wall of input_datetime helpers.
//
// Why not helpers: a helper cannot express "except in December". School terms,
// public holidays and a pool-service visit are all date RANGES with exceptions,
// and every attempt to model those as a time-of-day plus a weekday mask ends up
// as a template with a hardcoded list of dates in it — which is exactly what
// happens today.
//
// Each calendar declares WHAT IT CHANGES. That is the part that makes this a
// modelling layer rather than a diary: "Away" is not an event, it is a set of
// consequences with a start and an end.

export type Effect = {
  /** Plain-language consequence, shown wherever the calendar is visible. */
  text: string;
  /** The entity or subsystem it acts on, for the dependency view. */
  target?: string;
};

export type Cal = {
  id: string;
  name: string;
  /** HA local_calendar entity, or an iCal subscription. */
  entity: string;
  source: "local" | "ical";
  /** Why it exists, one line. */
  purpose: string;
  effects: Effect[];
};

// Five to start. Deliberately not "every calendar the family has" — a calendar
// belongs here only if something in the house changes behaviour because of it.
export const CALENDARS: Cal[] = [
  {
    id: "school",
    name: "School terms",
    entity: "calendar.school_terms",
    source: "ical",
    purpose: "Term dates and school holidays, subscribed rather than retyped.",
    effects: [
      { text: "The boys' lamps use the school-night time (20:15) instead of 21:30", target: "light.liam_study_lamp" },
      { text: "Morning briefing moves earlier on a school day", target: "sensor.briefing_morning" },
    ],
  },
  {
    id: "away",
    name: "Away",
    entity: "calendar.away",
    source: "local",
    purpose: "The family is not here. One entry, several consequences.",
    effects: [
      { text: "Both alarm areas arm and stay armed", target: "alarm_control_panel.helloliam_alarm_area_01_huis" },
      { text: "Irrigation holds — nobody is here to notice a burst", target: "switch.water_pump" },
      { text: "Digests pause; only Interrupts get through" },
      { text: "Presence-based lighting stops proposing anything" },
    ],
  },
  {
    id: "holidays",
    name: "ZA public holidays",
    entity: "calendar.za_public_holidays",
    source: "ical",
    purpose: "Subscribed. A public holiday is not a Saturday and not a school day.",
    effects: [
      { text: "Bin day moves — the municipality collects a day late" },
      { text: "The school-night lamp rule is cancelled" },
    ],
  },
  {
    id: "pool",
    name: "Pool service",
    entity: "calendar.pool_service",
    source: "local",
    purpose: "A maintenance window on a schedule.",
    effects: [
      { text: "Pump-runtime alerts are suppressed for the visit", target: "switch.pool_pump" },
      { text: "The suppression shows with its end time, and expires on its own" },
    ],
  },
  {
    id: "sabbath",
    name: "Sabbath",
    entity: "calendar.sabbath",
    source: "local",
    purpose: "Sunset Friday to sunset Saturday.",
    effects: [
      { text: "Sabbath mode: nudges, digests and non-safety notifications hold" },
      { text: "Nothing is disabled — only the interrupting is" },
    ],
  },
];

export const calendarById = (id: string) => CALENDARS.find((c) => c.id === id);
