"use client";

import { useState, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  setMonth,
  setYear,
} from "date-fns";

import styles from "./Calendar.module.css";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2000, i, 1), "MMMM"),
);
const WEEK_OPTIONS = { weekStartsOn: 1 }; // Monday

export default function Calendar({ rows = [] }) {
  //returns 1st date of the selected month for the current view date (defaults to current month)
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));

  //Create object of every day in the month, including days from previous and
  // next months that fill the first and last weeks. Using date-fns package

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate), WEEK_OPTIONS),
    end: endOfWeek(endOfMonth(viewDate), WEEK_OPTIONS),

    //add 1 (WEEK_OPTIONS) to start and end days so that the calendar will start on Monday instead of Sunday
    //remove Week_OPTIONS to display Sun - Sat instead
  });

  // Centered on the viewed year, so the select always contains it
  const viewYear = viewDate.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => viewYear - 2 + i);

  // Group posts by their date, e.g. { "04/12/2026": [post, post, post] }
  //see Object.groupBy docs
  //filter out empty rows that have a date but no contet or text

  const newRows = rows.filter((row) => row.content);
  const postsByDate = Object.groupBy(
    rows.filter((row) => row.content || row.text),
    (row) => row.date,
  );

  return (
    <div className={styles.calendarContainer}>
      <h1>Calendar</h1>
      <p>Today: {format(new Date(), "EEEE d MMMM yyyy")}</p>

      <div className={styles.calendarNav}>
        <button onClick={() => setViewDate((d) => subMonths(d, 1))}>‹</button>

        <select
          className={`${styles.month} ${styles.select}`}
          value={viewDate.getMonth()}
          onChange={(e) =>
            setViewDate((d) => setMonth(d, Number(e.target.value)))
          }
        >
          {MONTHS.map((name, index) => (
            <option key={name} value={index}>
              {name}
            </option>
          ))}
        </select>

        <select
          className={`${styles.year} ${styles.select}`}
          value={viewYear}
          onChange={(e) =>
            setViewDate((d) => setYear(d, Number(e.target.value)))
          }
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <button onClick={() => setViewDate((d) => addMonths(d, 1))}>›</button>
        <button onClick={() => setViewDate(startOfMonth(new Date()))}>
          Today
        </button>
      </div>

      <div className={styles.calendarHeader}>
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className={styles.calendarDay}>
            {day}
          </div>
        ))}
      </div>

      <div className={styles.calendarGrid}>
        {days.map((day) => {
          const classes = [
            styles.calendarCell,
            !isSameMonth(day, viewDate) && styles.outsideMonth,
            isToday(day) && styles.today,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={day.toISOString()} className={classes}>
              <time dateTime={format(day, "dd/MM/yyyy")}>
                {format(day, "d")}
              </time>
              {(postsByDate[format(day, "dd/MM/yyyy")] ?? []).map((post, i) => (
                <div key={i} className={styles.post}>
                  {post.content}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
