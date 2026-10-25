"use server";
import { format } from "date-fns";

import { revalidatePath } from "next/cache";
import { appendCalendarRow } from "@/lib/calendarSheet";

// Called by the Add Post form. formData holds the form's fields by their `name`
export async function addPost(formData) {
  const post = Object.fromEntries(formData);
  await appendCalendarPost(post);
  revalidatePath("/calendar");
}
