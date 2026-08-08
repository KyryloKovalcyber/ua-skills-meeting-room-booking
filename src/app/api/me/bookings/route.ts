import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

const PAGE_SIZE = 10;

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const query = new URL(req.url).searchParams;
    const type = query.get("type") === "past" ? "past" : "upcoming";
    const requestedPage = Number(query.get("page") ?? 1);
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
    const now = new Date();

    const where = {
      userId: user.id,
      cancelledAt: null,
      ...(type === "past" ? { endAt: { lt: now } } : { endAt: { gte: now } }),
    };

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { room: { select: { id: true, name: true, floor: true } } },
        orderBy: { startAt: type === "past" ? "desc" : "asc" },
        skip: type === "past" ? (page - 1) * PAGE_SIZE : 0,
        take: type === "past" ? PAGE_SIZE : 100,
      }),
      prisma.booking.count({ where }),
    ]);

    return ok({ items, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return fail(error);
  }
}
