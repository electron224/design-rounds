import ProgressList from "@/components/ProgressList";
import { getSessionUser } from "@/lib/auth";

export default async function ProgressPage() {
  const user = await getSessionUser().catch(() => null);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">My progress</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {user
          ? `Signed in as ${user.name} — attempts follow your account across devices.`
          : "Guest progress lives in this browser. Log in to keep it everywhere."}
      </p>
      <ProgressList loggedIn={!!user} />
    </main>
  );
}
