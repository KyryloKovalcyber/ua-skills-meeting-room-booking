import { requireUser } from "@/lib/auth";
import { Schedule } from "@/components/Schedule";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; week?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;

  return (
    <Schedule
      userId={user.id}
      initialRoomId={query.room}
      initialWeek={query.week}
    />
  );
}
