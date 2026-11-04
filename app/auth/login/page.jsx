import LoginForm from "@/components/LoginForm";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <h1>Welcome to Content Farm</h1>

      <LoginForm />
    </main>
  );
}
