import { PrismaClient, type Room } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DateTime } from "luxon";

const prisma = new PrismaClient();
const SLOT_MINUTES = 30;

function slotStarts(startAt: Date, endAt: Date) {
  const result: Date[] = [];
  for (let cursor = startAt.getTime(); cursor < endAt.getTime(); cursor += SLOT_MINUTES * 60_000) {
    result.push(new Date(cursor));
  }
  return result;
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: { name: "Alice Johnson", passwordHash },
    create: { name: "Alice Johnson", email: "alice@example.com", passwordHash },
  });
  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: { name: "Bob Smith", passwordHash },
    create: { name: "Bob Smith", email: "bob@example.com", passwordHash },
  });

  const roomData = [
    ["Акваріум", 2, 4],
    ["Дніпро", 2, 12],
    ["Марс", 3, 6],
    ["Гагарін", 4, 8],
    ["Орбіта", 5, 10],
    ["Горизонт", 6, 16],
  ] as const;

  const rooms: Room[] = [];
  for (const [name, floor, capacity] of roomData) {
    rooms.push(await prisma.room.upsert({
      where: { name },
      update: { floor, capacity },
      create: { name, floor, capacity },
    }));
  }

  if (await prisma.booking.count() === 0) {
    const nextMonday = DateTime.now().setZone("Europe/Kyiv").plus({ weeks: 1 }).startOf("week");
    const previousMonday = DateTime.now().setZone("Europe/Kyiv").minus({ weeks: 2 }).startOf("week");

    const demo = [
      { title: "Product sync", base: nextMonday, day: 0, start: 10, end: 11, room: 0, userId: alice.id },
      { title: "Design review", base: nextMonday, day: 1, start: 13, end: 14.5, room: 0, userId: bob.id },
      { title: "Weekly planning", base: nextMonday, day: 2, start: 9.5, end: 10.5, room: 2, userId: alice.id },
      { title: "Client call", base: nextMonday, day: 3, start: 15, end: 16, room: 3, userId: bob.id },
      { title: "Retro", base: previousMonday, day: 1, start: 11, end: 12, room: 0, userId: alice.id },
      { title: "Research review", base: previousMonday, day: 3, start: 14, end: 15, room: 4, userId: alice.id },
    ];

    for (const item of demo) {
      const date = item.base.plus({ days: item.day });
      const startAt = date
        .set({ hour: Math.floor(item.start), minute: item.start % 1 ? 30 : 0, second: 0, millisecond: 0 })
        .toUTC()
        .toJSDate();
      const endAt = date
        .set({ hour: Math.floor(item.end), minute: item.end % 1 ? 30 : 0, second: 0, millisecond: 0 })
        .toUTC()
        .toJSDate();

      await prisma.booking.create({
        data: {
          title: item.title,
          roomId: rooms[item.room].id,
          userId: item.userId,
          startAt,
          endAt,
          slotClaims: {
            create: slotStarts(startAt, endAt).map((slotStart) => ({
              roomId: rooms[item.room].id,
              startAt: slotStart,
            })),
          },
        },
      });
    }
  }

  console.log("Seed complete");
  console.log("alice@example.com / Password123");
  console.log("bob@example.com / Password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
