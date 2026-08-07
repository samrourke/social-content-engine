export const metadata = {
  title: "Circa Waves Content Engine",
  description: "Content discovery and review dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
