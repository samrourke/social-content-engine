import Calendar from "../../components/Calendar";
import { getCalendarRows } from "../../lib/calendarSheet";

// Read the sheet on every request, so edits show up on refresh
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  //await the return of Calendar Rows
  const rows = await getCalendarRows();

  return (
    <main>
      <Calendar rows={rows} />
    </main>
  );
}
