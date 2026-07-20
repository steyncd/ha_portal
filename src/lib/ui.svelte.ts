// Tiny shared UI-signal store so the global top bar's per-page action buttons can
// trigger state that lives inside a view (Overview Customize, Reminders New).
// The action only shows when its view is active, so the view is always mounted.
class UI {
  overviewCustomize = $state(false);
  newReminderTick = $state(0);
}

export const ui = new UI();
