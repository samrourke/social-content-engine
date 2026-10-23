import "server-only";
import { google } from "googleapis";
import { parse, isValid, format } from "date-fns";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  // .env stores the line breaks as "\n", so turn them back into real ones
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

//Fetch calendar
export async function getCalendarRows() {
  //get spreadsheet data from google sheets
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.CALENDAR_SHEET_ID,
    range: `'${process.env.CALENDAR_SHEET_TAB}'`,
  });

  // Sheet headers conversion Object to use the name used in the code lateer,
  //Changes to sheet headers only need correcting here and not throughout the code
  const COLUMNS = {
    DATE: "date",
    "TIME + ZONE": "time",
    CONTENT: "content",
    "TEXT/VO": "text",
    "CTA/LINK/SOUND": "cta",
    TAGS: "tags",
    HASHTAGS: "hashtags",
    PURPOSE: "purpose",
    NICHE: "niche",
    "CODE FOR BOOSTING": "boostCode",
  };

  //get array of the tables headers and a second array of all otehr
  //rows

  const values = data.values ?? [];
  const headers = values[0] ?? [];
  const rows = values.slice(1);

  //
  //Object.fromEntries() to create new Objects using key: value pairs taken fron
  //headers (keys) and rows (values)

  return rows.map((row) => {
    return Object.fromEntries(
      headers.map((h, i) => [
        COLUMNS[h.trim()] ?? h.trim(),
        (row[i] ?? "").trim(),
      ]),
    );
  });
}
