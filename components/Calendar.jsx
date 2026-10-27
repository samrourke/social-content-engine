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
import CalendarModal from "./CalendarModal";
import AddEventModal from "./AddEventModal";

//date-fns library for calculating days and weeks in the month

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2000, i, 1), "MMMM"),
);

const WEEK_OPTIONS = { weekStartsOn: 1 }; // Monday

const calendarIcons = ["Awareness", "Engagement", "Conversion", "Community"];

export default function Calendar({ rows = [] }) {
  const [modalState, setModalState] = useState(false);
  const [modalPost, setModalPost] = useState(null);

  const [addEvent, setAddEvent] = useState(false);

  //returns 1st date of the selected month for the current view date (defaults to current month)
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));

  //Create object of every day in the month, including days from previous and
  // next months that fill the first and last weeks. Using date-fns package

  const days = eachDayOfInterval({
    //find start of the week that includes the first day of the month, going back to
    //the nearet Monday

    start: startOfWeek(startOfMonth(viewDate), WEEK_OPTIONS),

    //find end of the last week that includes the last day of the month
    //to the next Sunday
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

  const postsByDate = useMemo(
    () =>
      Object.groupBy(
        rows.filter((row) => row.content || row.text),
        (row) => row.date,
      ),
    [rows],
  );

  // Days of the viewed month that have posts, for the phone list view
  const monthDays = days.filter(
    (day) =>
      isSameMonth(day, viewDate) && postsByDate[format(day, "dd/MM/yyyy")],
  );

  function handleModalOpen(selectedPost) {
    setModalPost(selectedPost);

    setModalState((prev) => !prev);
    document.body.style.overflow = "hidden";
  }

  function addEventOpen() {
    setAddEvent(true);
    document.body.style.overflow = "hidden";
  }

  function handleModalClose() {
    setModalState(false);
    document.body.style.overflow = "auto";
  }

  function closeEventModal() {
    setAddEvent(false);
    document.body.style.overflow = "auto";
  }

  return (
    <>
      <div className={styles.calendarContainer}>
        <h1>Calendar</h1>
        <p>Today: {format(new Date(), "EEEE d MMMM yyyy")}</p>

        <div className={styles.calendarNav}>
          {/* ‹ [Month] [Year] › */}
          <div className={styles.monthControls}>
            <button
              className={styles.monthNavBtn}
              onClick={() => setViewDate((d) => subMonths(d, 1))}
              aria-label="Previous month"
            >
              ‹
            </button>

            <select
              className={`${styles.month} ${styles.select}`}
              value={viewDate.getMonth()}
              onChange={(e) =>
                setViewDate((d) => setMonth(d, Number(e.target.value)))
              }
              aria-label="Month"
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
              aria-label="Year"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <button
              className={styles.monthNavBtn}
              onClick={() => setViewDate((d) => addMonths(d, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className={styles.navActions}>
            <button
              className={styles.secondaryBtn}
              onClick={() => setViewDate(startOfMonth(new Date()))}
            >
              Today
            </button>
            <button
              className={styles.primaryBtn}
              onClick={() => addEventOpen()}
            >
              Add post +
            </button>
          </div>
        </div>

        {/* Phones: the month as a list of days that have posts (hidden on wider screens) */}
        <ol className={styles.agenda}>
          {monthDays.length === 0 && (
            <li className={styles.agendaEmpty}>No posts planned this month.</li>
          )}
          {monthDays.map((day) => (
            <li
              key={day.toISOString()}
              className={`${styles.agendaDay} ${isToday(day) ? styles.today : ""}`}
            >
              <time
                className={styles.agendaDate}
                dateTime={format(day, "yyyy-MM-dd")}
              >
                {format(day, "EEE d MMM")}
              </time>
              {postsByDate[format(day, "dd/MM/yyyy")].map((post, i) => (
                <button
                  onClick={() => handleModalOpen(post)}
                  key={i}
                  className={`${styles.post} ${styles.agendaPost}`}
                  data-purpose={post.purpose}
                >
                  {post.content || post.text}
                </button>
              ))}
            </li>
          ))}
        </ol>

        {/* Tablets and desktops: the month grid (hidden on phones) */}
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
                {(postsByDate[format(day, "dd/MM/yyyy")] ?? []).map(
                  (post, i) => (
                    <button
                      onClick={() => handleModalOpen(post)}
                      key={i}
                      className={styles.post}
                      data-purpose={post.purpose}
                    >
                      {post.content || post.text}
                    </button>
                  ),
                )}
              </div>
            );
          })}
        </div>
        <ul className={styles.calendarIcons} aria-label="Post purposes">
          {calendarIcons.map((name) => (
            <li key={name} className={styles.icon} data-purpose={name}>
              {name}
            </li>
          ))}
        </ul>
      </div>

      {modalState && (
        <CalendarModal post={modalPost} onClose={handleModalClose} />
      )}
      {addEvent && (
        <AddEventModal addEvent={addEvent} onClose={closeEventModal} />
      )}
    </>
  );
}
