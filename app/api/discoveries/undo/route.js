import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(request) {
  const { id } = await request.json();

  const { error } = await supabaseAdmin
    .from("content_discoveries")
    .update({
      review_status: "pending",
      archive_category: null,
      reviewed_at: null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
