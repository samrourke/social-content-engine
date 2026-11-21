import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: firstClient } = await supabase
    .from("clients")
    .select("slug")
    .order("name")
    .limit(1)
    .maybeSingle();

  if (firstClient) {
    redirect(`/${firstClient.slug}/youtube-review`);
  }

  return (
    <div className={styles.main}>
      <h1>Almost There</h1>
      <p>Your account is not currently linked to a client page</p>
      <p>Ask a member of the team to rectify.</p>
      <Link className={styles.link} href="/auth/login">
        Back to log in
      </Link>
    </div>
  );
}
