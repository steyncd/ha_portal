// Parcel tracking (Ship24). The portal CRUDs tracking numbers in Firestore
// `parcels`; a Cloud Function (refreshParcels) queries Ship24 and writes status.
import { collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";

export type Parcel = {
  id: string;
  trackingNumber: string;
  label?: string;
  status?: string;
  courier?: string | null;
  lastEvent?: string | null;
  delivered?: boolean;
  refreshedAt?: number;
};

export function watchParcels(cb: (parcels: Parcel[]) => void) {
  return onSnapshot(collection(db, "parcels"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Parcel, "id">) })));
  });
}

export async function addParcel(trackingNumber: string, label = "") {
  const tn = trackingNumber.trim();
  if (!tn) throw new Error("Enter a tracking number");
  await addDoc(collection(db, "parcels"), {
    trackingNumber: tn,
    label: label.trim(),
    addedBy: auth.currentUser?.email ?? null,
    ts: Date.now(),
  });
}

export async function removeParcel(id: string) {
  await deleteDoc(doc(db, "parcels", id));
}

export async function refreshParcels() {
  const token = await auth.currentUser?.getIdToken();
  await fetch("/api/refresh-parcels", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}
