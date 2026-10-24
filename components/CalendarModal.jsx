"use client";

import { useEffect, useRef } from "react";
import { parse, isValid, format } from "date-fns";
import styles from "./CalendarModal.module.css";

// Fields shown in the details list, in order. The title, date and purpose
// are shown in the header instead
const FIELDS = [
  { key: "content", label: "Content" },
  { key: "text", label: "Text / VO" },
  { key: "cta", label: "CTA / Link / Sound" },
  { key: "tags", label: "Tags" },
  { key: "hashtags", label: "Hashtags" },
  { key: "niche", label: "Niche" },
  { key: "boostCode", label: "Code for boosting", mono: true },
];

// "04/12/2026" → "Friday 4 December 2026", or the original text if it isn't a date
function formatDate(dateText) {
  const date = parse(dateText, "dd/MM/yyyy", new Date());
  return isValid(date) ? format(date, "EEEE d MMMM yyyy") : dateText;
}

// Turn any URLs in a cell into clickable links, leaving the rest as text
function withLinks(text) {
  return text.split(/(https?:\/\/\S+)/).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export default function CalendarModal({ post, onClose }) {
  const dialogRef = useRef(null);

  // Open or close the real <dialog> whenever the selected post changes
  useEffect(() => {
    const dialog = dialogRef.current;
    if (post && !dialog.open) dialog.showModal();
    if (!post && dialog.open) dialog.close();
  }, [post]);

  // Only list the fields this post actually has
  const fields = post ? FIELDS.filter((field) => post[field.key]) : [];

  return (
    // onClose also fires when the user presses Escape
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose}>
      {post && (
        <>
          <header className={styles.header}>
            <h2 className={styles.title}>{post.content || post.text}</h2>

            <div className={styles.meta}>
              <span>{formatDate(post.date)}</span>
              {post.time && <span>· {post.time}</span>}
              {post.purpose && (
                <span className={styles.pill} data-purpose={post.purpose}>
                  {post.purpose}
                </span>
              )}
            </div>

            <button
              className={styles.close}
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div className={styles.body}>
            {fields.length > 0 ? (
              <dl className={styles.fields}>
                {fields.map((field) => (
                  <div key={field.key} className={styles.field}>
                    <dt className={styles.label}>{field.label}</dt>
                    <dd
                      className={`${styles.value} ${field.mono ? styles.mono : ""}`}
                    >
                      {withLinks(post[field.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.empty}>No details added yet.</p>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
