import Link from "next/link";
import styles from "./page.module.css";

// /auth/confirm sends people here with ?error=<message> when a link is invalid or expired
export default async function AuthErrorPage({ searchParams }) {
  const { error } = await searchParams;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sorry, something went wrong</h1>
        <p>{error ?? "An unspecified error occurred."}</p>
        <Link href="/auth/login">Back to log in</Link>
      </div>
    </main>
  );
}
