import { NextResponse } from "next/server";
import { undoInstagramReview } from "@/lib/instagramDiscoveries";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const { id } = await request.json();
  const supabase = await createClient();

  const { error } = await undoInstagramReview(supabase, id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
