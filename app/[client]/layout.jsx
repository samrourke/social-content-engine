import { requireClient } from "@/lib/tenant";

export default async function Layout({ params, children }) {
  const { client: slug } = await params;

  await requireClient(slug);

  return children;
}
