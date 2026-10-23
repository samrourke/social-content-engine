import Calendar from "../../components/Calendar";
import { getCalendarRows } from "../../lib/calendarSheet";

// Read the sheet on every request, so edits show up on refresh
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const rows = await getCalendarRows();

  return (
    <main>
      <Calendar rows={rows} />
    </main>
  );
}
