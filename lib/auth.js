import { createClient } from "@/lib/supabase/server";

export async function isPlatformAdmin() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return false;
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError) {
    return false;
  }

  // double ! turns truthy and falsey values into proper boolean true/false

  return !!adminRow;
}
