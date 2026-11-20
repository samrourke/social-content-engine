// lib/tenant.js
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/auth";
import { cache } from "react";

export const requireClient = cache(async (slug) => {
  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!client || error) {
    notFound();
  }

  const isAdmin = await isPlatformAdmin();

  return { client, isAdmin };
});
