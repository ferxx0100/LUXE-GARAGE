import { json } from "@/lib/http";
import { clearMemberCookie } from "@/lib/members";

export const dynamic = "force-dynamic";

export async function POST() {
  return json({ ok: true }, 200, { "Set-Cookie": clearMemberCookie });
}
