// Household access management — read/write the Firestore `settings/access` doc
// ({ members[], owners[], guests[], guestViews[] }). Only owners can write
// (enforced by firestore.rules); this is the client side of the Admin section.
//
// Roles (precedence): owner > member > guest.
//   - owner  : full use + manages the list
//   - member : full use
//   - guest  : forced restricted view (only the views in their guestViews)
import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const REF = () => doc(db, "settings", "access");
const lc = (s: string) => s.trim().toLowerCase();
const uniq = (a: string[]) => [...new Set(a.map(lc))].filter(Boolean);

// Per-guest allowed view ids, stored as an array (not a map) so emails-with-dots
// never become Firestore field-path keys.
export type GuestView = { e: string; v: string[] };
export type Access = { members: string[]; owners: string[]; guests: string[]; guestViews: GuestView[] };

export async function loadAccess(): Promise<Access> {
  const snap = await getDoc(REF());
  const d = (snap.data() as Partial<Access> | undefined) ?? {};
  return { members: d.members ?? [], owners: d.owners ?? [], guests: d.guests ?? [], guestViews: d.guestViews ?? [] };
}

async function save(next: Access) {
  const guests = uniq(next.guests);
  await setDoc(
    REF(),
    {
      members: uniq(next.members),
      owners: uniq(next.owners),
      guests,
      // keep only view-config for emails still in the guests list
      guestViews: next.guestViews
        .map((g) => ({ e: lc(g.e), v: [...new Set(g.v)] }))
        .filter((g) => guests.includes(g.e)),
    },
    { merge: false },
  );
}

const stripEverywhere = (a: Access, email: string) => {
  const e = lc(email);
  a.members = a.members.filter((m) => lc(m) !== e);
  a.owners = a.owners.filter((o) => lc(o) !== e);
  a.guests = a.guests.filter((g) => lc(g) !== e);
  a.guestViews = a.guestViews.filter((g) => lc(g.e) !== e);
  return a;
};

/** Add an email as a member (idempotent); clears any guest role. */
export async function addMember(email: string) {
  const a = stripEverywhere(await loadAccess(), email);
  a.members = uniq([...a.members, email]);
  await save(a);
}

/** Remove an email from every role. */
export async function removeMember(email: string) {
  await save(stripEverywhere(await loadAccess(), email));
}

/** Promote to owner (also a member); clears guest role. */
export async function promote(email: string) {
  const a = stripEverywhere(await loadAccess(), email);
  a.members = uniq([...a.members, email]);
  a.owners = uniq([...a.owners, email]);
  await save(a);
}

/** Demote an owner back to plain member. */
export async function demote(email: string) {
  const a = await loadAccess();
  const e = lc(email);
  a.owners = a.owners.filter((o) => lc(o) !== e);
  a.members = uniq([...a.members, email]);
  await save(a);
}

/** Add (or reconfigure) a guest with the given allowed view ids. */
export async function addGuest(email: string, views: string[]) {
  const a = stripEverywhere(await loadAccess(), email);
  const e = lc(email);
  a.guests = uniq([...a.guests, e]);
  a.guestViews = [...a.guestViews, { e, v: views }];
  await save(a);
}

/** Update a guest's allowed views. */
export async function setGuestViews(email: string, views: string[]) {
  const a = await loadAccess();
  const e = lc(email);
  a.guestViews = a.guestViews.filter((g) => lc(g.e) !== e).concat({ e, v: views });
  await save(a);
}
