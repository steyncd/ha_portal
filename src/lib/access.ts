// Household access management — read/write the Firestore `settings/access` doc
// ({ members[], owners[] }). Only owners can write (enforced by firestore.rules);
// these helpers are the client side of the Admin section in Settings.
import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const REF = () => doc(db, "settings", "access");
const lc = (s: string) => s.trim().toLowerCase();
const uniq = (a: string[]) => [...new Set(a.map(lc))].filter(Boolean);

export type Access = { members: string[]; owners: string[] };

export async function loadAccess(): Promise<Access> {
  const snap = await getDoc(REF());
  const d = (snap.data() as Partial<Access> | undefined) ?? {};
  return { members: d.members ?? [], owners: d.owners ?? [] };
}

async function save(next: Access) {
  await setDoc(REF(), { members: uniq(next.members), owners: uniq(next.owners) }, { merge: false });
}

/** Add an email as a member (idempotent). */
export async function addMember(email: string) {
  const a = await loadAccess();
  a.members = uniq([...a.members, email]);
  await save(a);
}

/** Remove an email from both members and owners. */
export async function removeMember(email: string) {
  const a = await loadAccess();
  const e = lc(email);
  a.members = a.members.filter((m) => lc(m) !== e);
  a.owners = a.owners.filter((o) => lc(o) !== e);
  await save(a);
}

/** Promote a member to owner (also ensures they're a member). */
export async function promote(email: string) {
  const a = await loadAccess();
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
