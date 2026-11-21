import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getNextDiscovery,
  reviewYoutubeDiscovery,
} from "@/lib/youtubeDiscoveries";

export async function POST(request) {
  const { id, status, archiveCategory } = await request.json();

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error, clientId } = await reviewYoutubeDiscovery(
    supabase,
    id,
    status,
    archiveCategory,
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: nextDiscovery, error: nextError } = await getNextDiscovery(
    supabase,
    clientId,
  );
  if (nextError) {
    return NextResponse.json({ error: nextError.message }, { status: 500 });
  }

  return NextResponse.json({ nextDiscovery });
}
