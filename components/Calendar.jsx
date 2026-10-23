import styles from "./Calendar.module.css";

export default function Calendar() {
  const currentDate = new Date();
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const monthsOfYear = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const currentMonth = monthsOfYear[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();
  const currentDay = currentDate.getDate();

  return (
    <div className={styles.calendarContainer}>
      <h1>Calendar</h1>

      <p>
        {" "}
        <span>Today's Date</span>
        <span> {currentMonth}</span>
        <span> {currentDay}</span>
        <span> {currentYear}</span>
      </p>
      <div className={styles.calendarHeader}>
        {daysOfWeek.map((day) => (
          <div key={day} className={styles.calendarDay}>
            {day}
          </div>
        ))}
      </div>

      <div className={styles.calendarGrid}></div>
    </div>
  );
}
