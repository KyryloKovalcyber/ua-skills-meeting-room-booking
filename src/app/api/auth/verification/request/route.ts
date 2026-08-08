import { requireUser } from "@/lib/auth";
import { issueEmailVerificationToken } from "@/lib/verification";
import { fail, ok } from "@/lib/http";

export async function POST() {
  try {
    const user = await requireUser();

    if (user.emailVerifiedAt) {
      return ok({ alreadyVerified: true });
    }

    const { expiresAt } = await issueEmailVerificationToken(user.id, user.email);
    return ok({ sent: true, expiresAt });
  } catch (error) {
    return fail(error);
  }
}
