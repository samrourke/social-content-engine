import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { undoYoutubeReview } from "@/lib/youtubeDiscoveries";

export async function POST(request) {
  const supabase = await createClient();
  const { id } = await request.json();

  const { error } = await undoYoutubeReview(supabase, id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
