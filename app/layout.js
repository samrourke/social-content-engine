import "./globals.css";
import { sans, display } from "./fonts";

export const metadata = {
  title: "Circa Waves Content Engine",
  description: "Content discovery and review dashboard",
  verification: {
    google: "KZOexiz0uBvy0X5oroP9xTny3PmjEjlwRXBV5YCfNOY",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>{children}</body>
    </html>
  );
}
