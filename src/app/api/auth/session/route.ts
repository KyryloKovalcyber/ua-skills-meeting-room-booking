import { currentUser } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function GET() {
  return ok({ user: await currentUser() });
}
