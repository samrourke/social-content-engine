"use server";

import { revalidatePath } from "next/cache";
import { insertCalendarRow } from "@/lib/calendarSheet";
import { parse, isValid } from "date-fns";

// Called by the Add Post form. formData holds the form's fields by their `name`
//Turn this into a mutable Object with Object.fromEntries and send to appendCalendarPost()

export async function addPost(previousState, formData) {
  const post = Object.fromEntries(formData);

  // Expected problems: tell the user what to fix
  const date = parse(post.date, "yyyy-MM-dd", new Date());
  if (!isValid(date)) {
    return { status: "error", message: "Please choose a valid date." };
  }
  if (!post.content && !post.text) {
    return { status: "error", message: "Add some content or text/VO." };
  }

  // Unexpected problems: something outside the user's control
  try {
    await insertCalendarRow({ ...post, date });
  } catch (error) {
    console.error("addPost failed:", error); // full details stay in the server log
    return {
      status: "error",
      message: "Couldn't save to the Google Sheet. Please try again.",
    };
  }

  revalidatePath("/calendar");
  return { status: "success", message: "New Post Added" };
}
