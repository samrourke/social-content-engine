import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request) {
  const { id, status, archiveCategory } = await request.json();

  const { error } = await supabaseAdmin
    .from("content_discoveries")
    .update({
      review_status: status,
      archive_category: archiveCategory ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: nextDiscovery, error: nextError } = await supabaseAdmin
    .from("content_discoveries")
    .select("*")
    .eq("review_status", "pending")
    .order("discovered_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (nextError) {
    return NextResponse.json({ error: nextError.message }, { status: 500 });
  }

  return NextResponse.json({
    nextDiscovery,
  });
}
