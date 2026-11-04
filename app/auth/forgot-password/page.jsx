import styles from "./page.module.css";
import PasswordResetForm from "@/components/PasswordReset";

export default function ForgotPassword() {
  return (
    <main className={styles.page}>
      <PasswordResetForm />
    </main>
  );
}
