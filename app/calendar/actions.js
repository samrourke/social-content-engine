"use server";

import { revalidatePath } from "next/cache";
import { insertCalendarRow } from "@/lib/calendarSheet";
import {
  parse,
  isValid,
  isBefore,
  isAfter,
  subYears,
  addYears,
} from "date-fns";

// Called by the Add Post form. formData holds the form's fields by their `name`
//Turn this into a mutable Object with Object.fromEntries and send to appendCalendarPost()

const FIELD_LIMITS = {
  date: 10,
  time: 5,
  content: 2000,
  text: 2000,
  cta: 500,
  tags: 500,
  hashtags: 500,
  purpose: 20,
  niche: 100,
  boostCode: 200,
};

const PURPOSES = ["Awareness", "Engagement", "Conversion", "Community"];

// Returns { post } when everything is valid, or { error } with a message for the user
function validatePost(formData) {
  const post = {};

  // Only the fields we expect - anything else in formData is ignored
  for (const [name, limit] of Object.entries(FIELD_LIMITS)) {
    const value = formData.get(name) ?? "";
    const nameString = name.charAt(0).toUpperCase() + name.slice(1);

    if (typeof value !== "string")
      return { error: "Files can't be added to a post." };
    post[name] = value.replace(/\r\n/g, "\n").trim();
    if (post[name].length > limit) {
      return {
        error: `${nameString} is too long (maximum ${limit} characters).`,
      };
    }
  }

  const date = parse(post.date, "yyyy-MM-dd", new Date());
  if (!isValid(date)) return { error: "Please choose a valid date." };

  // - content or text must be filled in (move your existing check here)
  // - time: empty, or one of the 15-minute values ("09:15") - a regular expression or a check on the minutes
  // - purpose:  one of PURPOSES
  // - the date must be within a year before or two years after today

  if (!post.content) {
    return { error: "Post must contain content" };
  }

  // Time: empty, or HH:mm on the quarter hour (matches the dropdown)
  if (post.time && !/^([01]\d|2[0-3]):(00|15|30|45)$/.test(post.time)) {
    return { error: "Please choose a time from the list." };
  }

  // Purpose: empty, or one of the four options
  if (post.purpose && !PURPOSES.includes(post.purpose)) {
    return { error: "Please choose a purpose from the list." };
  }

  // Date: within a sensible range, to catch typos like the year 20266
  const today = new Date();
  if (isBefore(date, subYears(today, 1)) || isAfter(date, addYears(today, 2))) {
    return { error: "Please choose a date within the next two years." };
  }

  return { post: { ...post, date } };
}

export async function addPost(previousState, formData) {
  // What the user typed, to refill the form if something goes wrong
  const submitted = Object.fromEntries(formData);

  // Expected problems: tell the user what to fix
  const { post, error } = validatePost(formData);
  if (error) {
    return { status: "error", message: error, fieldData: submitted };
  }

  // Unexpected problems: something outside the user's control
  try {
    await insertCalendarRow(post); // post.date is already a Date
  } catch (err) {
    console.error("addPost failed:", err); // full details stay in the server log
    return {
      status: "error",
      message: "Couldn't save to the Google Sheet. Please try again.",
      fieldData: submitted,
    };
  }

  revalidatePath("/calendar");
  return { status: "success", message: "New post added" };
}
