// Client for the Trello proxy Cloud Function (/api/trello). The Trello API
// key+token live server-side; every call carries the caller's Firebase ID token.
import { auth } from "./firebase";

export type TrelloLabel = { id?: string; name?: string; color?: string | null };
export type TrelloCard = {
  id: string;
  name: string;
  due?: string | null;
  dueComplete?: boolean;
  labels?: TrelloLabel[];
  shortUrl?: string;
  idList: string;
  pos?: number;
};
export type TrelloList = { id: string; name: string; pos?: number; cards?: TrelloCard[] };
export type TrelloBoard = { id: string; name: string };

async function idToken(): Promise<string> {
  const t = await auth.currentUser?.getIdToken();
  if (!t) throw new Error("Not signed in");
  return t;
}

async function get(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`/api/trello?${q}`, { headers: { Authorization: `Bearer ${await idToken()}` } });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || `Trello error (${res.status})`);
  return j;
}

async function post(body: Record<string, unknown>) {
  const res = await fetch(`/api/trello`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await idToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || `Trello error (${res.status})`);
  return j;
}

export const trello = {
  boards: async (): Promise<TrelloBoard[]> => (await get({ action: "boards" })).boards,
  board: async (boardId: string): Promise<TrelloList[]> => (await get({ action: "board", boardId })).lists,
  createCard: (listId: string, name: string, due?: string) =>
    post({ action: "create", listId, name, ...(due ? { due } : {}) }),
  moveCard: (cardId: string, destListId: string, pos?: string | number) =>
    post({ action: "move", cardId, destListId, ...(pos != null ? { pos } : {}) }),
  setComplete: (cardId: string, dueComplete: boolean) => post({ action: "complete", cardId, dueComplete }),
  archive: (cardId: string) => post({ action: "archive", cardId }),
  rename: (cardId: string, name: string) => post({ action: "rename", cardId, name }),
};
