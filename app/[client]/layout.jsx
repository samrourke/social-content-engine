import { requireClient } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import MobileNav from "@/components/Nav/MobileNav";

export default async function Layout({ params, children }) {
  const { client: slug } = await params;

  const { client } = await requireClient(slug);

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("slug, name")
    .order("name");

  return (
    <>
      <MobileNav client={client} clients={clients} />
      {children}
    </>
  );
}
