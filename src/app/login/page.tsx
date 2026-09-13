import AuthForms from "@/components/AuthForms";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-xl border bg-white p-6 dark:bg-zinc-900">
        <h1 className="text-xl font-bold">Log in to LLD Practice</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Accounts keep your attempts in one place. Everything works as a
          guest too.
        </p>
        <div className="mt-4">
          <AuthForms />
        </div>
      </div>
    </main>
  );
}
