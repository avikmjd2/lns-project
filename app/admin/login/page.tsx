import { LoginForm } from "@/components/admin/bits";

export const metadata = { title: "Admin login" };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 pt-24">
      <div className="rounded-3xl border border-line bg-card p-6">
        <h1 className="mb-4 text-xl font-semibold">Admin login</h1>
        <LoginForm />
      </div>
    </main>
  );
}
