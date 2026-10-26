"use server";

import { revalidatePath } from "next/cache";
import { insertCalendarRow } from "@/lib/calendarSheet";
import { parse, isValid } from "date-fns";

// Called by the Add Post form. formData holds the form's fields by their `name`
//Turn this into a mutable Object with Object.fromEntries and send to appendCalendarPost()

export async function addPost(formData) {
  const post = Object.fromEntries(formData);

  // The date input always sends "2026-10-31"
  const date = parse(post.date, "yyyy-MM-dd", new Date());
  if (!isValid(date)) {
    throw new Error(`Invalid date: ${post.date}`);
  }

  await insertCalendarRow({ ...post, date }); // date is now a real Date
  revalidatePath("/calendar");
}
