import Calendar from "@/components/Calendar";
import { getCalendarRows } from "@/lib/calendarSheet";
import { requireClient } from "@/lib/tenant";
import { addPost } from "./actions";

// Read the sheet on every request, so edits show up on refresh
export const dynamic = "force-dynamic";

export default async function CalendarPage({ params }) {
  const { client: slug } = await params;
  const { client, isAdmin } = await requireClient(slug);

  if (!client.calendar_sheet_id) {
    return (
      <main>
        <h1>No Calendar Has Been Set Up Yet</h1>
      </main>
    );
  }

  //await the return of Calendar Rows
  const rows = await getCalendarRows(
    client.calendar_sheet_id,
    client.calendar_sheet_tab,
  );

  return (
    <main>
      <Calendar rows={rows} />
    </main>
  );
}
