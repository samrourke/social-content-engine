import SetPasswordForm from "@/components/SetPasswordForm";
import styles from "./page.module.css";

export default function SetPasswordPage() {
  return (
    <main className={styles.page}>
      <h1>Set Password</h1>
      <SetPasswordForm />
    </main>
  );
}
