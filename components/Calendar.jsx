"use client";

import { useState } from "react";
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

export default function Calendar() {
  //returns 1st date of the month for the current view date
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));

  // Every day shown in the grid, including the days from the previous and
  // next months that fill the first and last weeks
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate), WEEK_OPTIONS),
    end: endOfWeek(endOfMonth(viewDate), WEEK_OPTIONS),
  });

  // Centred on the viewed year, so the select always contains it
  const viewYear = viewDate.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => viewYear - 2 + i);

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
              <time dateTime={format(day, "yyyy-MM-dd")}>
                {format(day, "d")}
              </time>
              {/* posts for this day go here */}
            </div>
          );
        })}
      </div>
    </div>
  );
}
