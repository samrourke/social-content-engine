"use client";

import styles from "./AddEventModal.module.css";
import { addPost } from "@/app/calendar/actions";
import { useRef, useEffect } from "react";

// Every 15 minutes through the day: "00:00", "00:15" ... "23:45"
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const hours = String(Math.floor(i / 4)).padStart(2, "0");
  const minutes = String((i % 4) * 15).padStart(2, "0");
  return `${hours}:${minutes}`;
});

// `wide` fields span both columns of the form
const formInputFields = [
  { name: "date", label: "Date", type: "date", required: true },
  {
    name: "time",
    label: "Time",
    type: "select",
    options: TIME_OPTIONS,
    emptyLabel: "No set time",
  },
  {
    name: "content",
    label: "Content",
    type: "text",
    required: true,
    placeholder: "e.g. Single announce",
    wide: true,
  },
  {
    name: "text",
    label: "Text / VO",
    type: "textarea",
    placeholder: "Caption, voiceover or notes",
    wide: true,
  },
  {
    name: "cta",
    label: "CTA / Link / Sound",
    type: "text",
    placeholder: "https://...",
    wide: true,
  },
  { name: "tags", label: "Tags", type: "textarea", placeholder: "@handle" },
  {
    name: "hashtags",
    label: "Hashtags",
    type: "textarea",
    placeholder: "#newmusic",
  },
  {
    name: "purpose",
    label: "Purpose",
    type: "select",
    options: ["Awareness", "Engagement", "Conversion", "Community"],
  },
  { name: "niche", label: "Niche", type: "text", placeholder: "e.g. Gig-goers" },
  { name: "boostCode", label: "Code for boosting", type: "text", wide: true },
];

export default function AddEventModal({ addEvent, onClose }) {
  const dialogRef = useRef(null);

  // Open or close the real <dialog> whenever the selected post changes
  useEffect(() => {
    const dialog = dialogRef.current;
    if (addEvent && !dialog.open) dialog.showModal();
    if (!addEvent && dialog.open) dialog.close();
  }, [addEvent]);

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose}>
      <header className={styles.header}>
        <h2 className={styles.title}>Add new social post</h2>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <form className={styles.form} action={addPost}>
        <div className={styles.fields}>
          {formInputFields.map((input) => {
            const id = `post-${input.name}`;

            return (
              <div
                key={input.name}
                className={`${styles.formGroup} ${input.wide ? styles.wide : ""}`}
              >
                <label htmlFor={id} className={styles.label}>
                  {input.label}
                  {input.required && <span className={styles.required}> *</span>}
                </label>

                {input.type === "select" ? (
                  <select
                    id={id}
                    name={input.name}
                    required={input.required}
                    className={styles.formInput}
                  >
                    <option value="">{input.emptyLabel ?? "Choose..."}</option>
                    {input.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : input.type === "textarea" ? (
                  <textarea
                    id={id}
                    name={input.name}
                    required={input.required}
                    placeholder={input.placeholder}
                    rows={input.wide ? 4 : 2}
                    className={styles.formInput}
                  />
                ) : (
                  <input
                    id={id}
                    name={input.name}
                    type={input.type}
                    required={input.required}
                    placeholder={input.placeholder}
                    className={styles.formInput}
                  />
                )}
              </div>
            );
          })}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.primary}>
            Add post
          </button>
        </footer>
      </form>
    </dialog>
  );
}
