import { MyBookings } from "@/components/MyBookings";
import { OFFICE_TIME_ZONE } from "@/lib/config";

export default function MyBookingsPage() {
  return <MyBookings officeTimeZone={OFFICE_TIME_ZONE} />;
}
