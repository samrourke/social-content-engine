import "server-only";
import { google } from "googleapis";
import { parse, isValid, isAfter, format, addDays } from "date-fns";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  // .env stores the line breaks as "\n", so turn them back into real ones
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
// Sheet headers conversion Object to set the headers as they are used in the code later,
//so that changes to the google sheet headers only need correcting here and not throughout the code
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

/*---------- Dates ----------------*/

// Spreadsheets store a date as the number of days since 30 December 1899
const SHEETS_EPOCH = new Date(1899, 11, 30);

// Read the whole tab. With `unformatted: true`, cells come back as their stored
// values rather than the text the sheet displays, so real dates arrive as serial
// numbers (e.g. 46357 = 1 Dec 2026) whatever the sheet's locale or date format
async function readTab({ unformatted = false } = {}) {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.CALENDAR_SHEET_ID,
    range: `'${process.env.CALENDAR_SHEET_TAB}'`,
    ...(unformatted && {
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    }),
  });
  return data.values ?? [];
}

// An unformatted DATE cell → a Date, or null if it isn't a date.
// Real date cells are serial numbers. Dates typed as plain text (e.g. "15/11/2026"
// in a sheet that didn't recognise them) are read as UK dd/MM/yyyy as a fallback
function cellToDate(cell) {
  if (typeof cell === "number") return addDays(SHEETS_EPOCH, Math.floor(cell));
  const date = parse(String(cell ?? "").trim(), "dd/MM/yyyy", new Date());
  return isValid(date) ? date : null;
}

// Position of the DATE column, wherever it has been moved to
function dateColumnIndex(headers) {
  const index = headers.findIndex((h) => COLUMNS[String(h).trim()] === "date");
  if (index === -1) throw new Error("The calendar sheet has no DATE column");
  return index;
}

/*---------- Fetch calendar ----------------*/
export async function getCalendarRows() {
  // Displayed text for every column, plus stored values to get reliable dates.
  // Both requests run at the same time
  const [values, storedValues] = await Promise.all([
    readTab(),
    readTab({ unformatted: true }),
  ]);

  //get array of the tables headers and a second array of all other
  //rows
  const headers = values[0] ?? [];
  const rows = values.slice(1);
  const dateIndex = dateColumnIndex(headers);

  //Map over  rows variable to create a normalised Object for every row (row  = one social diary entry).
  //Object.fromEntries() to create this Object using key:value pairs taken fron
  //const headers (keys) and const rows (values)
  // e.g headers=['DATE', "CONTENT"...etc], rows[0] = ['12/11/2026', '']
  // becomes {date: 12/11/2026, content: 'some content'}
  //.trim() to remove accidental white spaces in the spreadsheet.

  return rows.map((row, r) => {
    const post = Object.fromEntries(
      headers.map((h, i) => [
        COLUMNS[h.trim()] ?? h.trim(),
        (row[i] ?? "").trim(),
      ]),
    );

    // Swap the displayed date for one rebuilt from the stored value, so it's
    // always dd/MM/yyyy however the sheet shows it. r + 1 skips the header row
    const date = cellToDate(storedValues[r + 1]?.[dateIndex]);
    if (date) post.date = format(date, "dd/MM/yyyy");

    return post;
  });
}

/*------------- Update Calendar -----------------------*/

// Add one post to the end of the calendar tab.
// `post` is an object keyed by code name, with the date already formatted for
// the sheet, e.g. { date: "2026-12-04", content: "..." }
export async function appendCalendarPost(post) {
  // Read just the header row, so values go in the right columns even if they've been reordered
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.CALENDAR_SHEET_ID,
    range: `'${process.env.CALENDAR_SHEET_TAB}'!1:1`,
  });
  const headers = data.values?.[0] ?? [];

  // e.g. ["DATE", "TEXT/VO"] → ["2026-12-04", "Coming soon!"]
  const row = headers.map((h) => post[COLUMNS[h.trim()]] ?? "");

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.CALENDAR_SHEET_ID,
    range: `'${process.env.CALENDAR_SHEET_TAB}'`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
  return res.data.updates;
}

// Insert a new post above the first post dated after it, so the sheet stays
// in date order. `post.date` is a Date
export async function insertCalendarRow(post) {
  const spreadsheetId = process.env.CALENDAR_SHEET_ID;
  const tab = process.env.CALENDAR_SHEET_TAB;

  // 1. Read the stored values: the header row (for column order) and the dates (for position)
  const values = await readTab({ unformatted: true });
  const headers = (values[0] ?? []).map(String);
  const dateIndex = dateColumnIndex(headers);

  // One entry per sheet row, in order: [null (header), Date, Date, null (blank row), ...]
  const dates = values.map((row) => cellToDate(row[dateIndex]));

  // 2. Write the date as yyyy-MM-dd: the one format Sheets reads the same way in
  //    every locale. The cell then displays it in the sheet's own date format
  const sheetPost = { ...post, date: format(post.date, "yyyy-MM-dd") };
  const row = headers.map((h) => sheetPost[COLUMNS[h.trim()]] ?? "");

  // 3. Find index of first date that is after the new date
  const insertAt = dates.findIndex(
    (rowDate) => rowDate && isAfter(rowDate, post.date),
  );

  // If no posts later than new post add to the end as before
  if (insertAt === -1) {
    return appendCalendarPost(sheetPost);
  }

  // 4. Look up the tab's numeric id, then insert one empty row at insertAt
  const { data: meta } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const tabInfo = meta.sheets.find((s) => s.properties.title === tab);
  if (!tabInfo) throw new Error(`No tab called "${tab}" in the calendar sheet`);
  const sheetId = tabInfo.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: insertAt,
              endIndex: insertAt + 1,
            },
            inheritFromBefore: insertAt > 1,
            // copy formatting (fonts, date format) from the row above unless new post is first row
            //otherwise it will get the Headers formatting style
          },
        },
      ],
    },
  });

  // 5. Fill the new empty row. Sheet rows are 1-based, so index insertAt is row insertAt + 1
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!A${insertAt + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}
