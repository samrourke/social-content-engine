import { NextResponse } from "next/server";
import { undoInstagramReview } from "../../../../lib/instagramDiscoveries";

export async function POST(request) {
  const { id } = await request.json();

  const { error } = await undoInstagramReview(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
