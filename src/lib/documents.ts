// Upload a receipt/statement image or PDF to the parseDocument function, which
// runs it through Gemini vision and returns structured JSON (stored in Firestore).
import { auth } from "./firebase";

export type ParseKind = "receipt" | "statement";

export async function parseDocument(file: File, kind: ParseKind) {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Not signed in");

  const fileBase64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Couldn't read file"));
    r.readAsDataURL(file);
  });

  const res = await fetch("/api/parse-document", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, mimeType: file.type, kind }),
  });
  return (await res.json()) as { ok: boolean; extracted?: Record<string, unknown>; error?: string };
}
