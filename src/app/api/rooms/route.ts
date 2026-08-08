import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";

export async function GET(req: Request) {
  try {
    await requireUser();
    const raw = new URL(req.url).searchParams.get("minCapacity");
    const minCapacity = raw ? Number(raw) : 0;

    const rooms = await prisma.room.findMany({
      where: Number.isFinite(minCapacity) && minCapacity > 0 ? { capacity: { gte: Math.floor(minCapacity) } } : undefined,
      orderBy: [{ floor: "asc" }, { capacity: "asc" }, { name: "asc" }],
    });

    return ok({ rooms });
  } catch (error) {
    return fail(error);
  }
}
