import { requireClient } from "@/lib/tenant";

export default async function DashboardPage({ params }) {
  const { client: slug } = await params;
  const { client, isAdmin } = await requireClient(slug);

  return (
    <main>
      <h1>{client.name}</h1>
      <p>{isAdmin ? "You're an admin" : "You're a member"}</p>
    </main>
  );
}
