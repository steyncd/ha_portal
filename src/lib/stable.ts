// Referential stability for derived lists/objects.
//
// Svelte 5 skips downstream updates when a $derived returns a value that is
// REFERENTIALLY identical to last time. Deriveds returning primitives (a number,
// a string) get that for free, which is why most of this app is already cheap
// despite ~30 deriveds per view all reading ha.entities.
//
// The expensive ones are the deriveds that build a NEW ARRAY OR OBJECT on every
// evaluation. `ha.entities` is reassigned every 300 ms, so those recompute,
// produce a fresh reference, fail the identity check, and force their {#each} or
// component to re-render — every 300 ms, forever. On the always-on wall display
// that is a permanent render loop for data that changed maybe twice an hour.
//
// This gives each derived a tiny memo: build the value as normal, hand it a
// cheap content signature, and get the PREVIOUS instance back when the
// signature is unchanged. Building the array is trivial; re-rendering it is not.
//
//   const alertsMemo = stable<Alert[]>();
//   const alerts = $derived.by(() => {
//     const a = buildAlerts();
//     return alertsMemo(a, a.map((x) => x.sev + x.text).join("|"));
//   });

export function stable<T>() {
  let key: string | undefined;
  let val: T;
  return (next: T, sig: string): T => {
    if (sig !== key) {
      key = sig;
      val = next;
    }
    return val;
  };
}

/** Signature helper for arrays of objects — joins the given fields per item. */
export function sig<T extends Record<string, unknown>>(items: T[], ...fields: (keyof T)[]): string {
  return items.map((it) => fields.map((f) => String(it[f])).join("")).join("");
}
