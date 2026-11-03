import { memoryStore, toPublic } from "@/lib/garage-state";

export const dynamic = "force-dynamic";

// Público: solo el estado. Nunca datos de quién reservó.
export async function GET() {
  const data = toPublic(await memoryStore.get());
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
