import { Mic } from "lucide-react";
import { LoginForm } from "@/components/admin/bits";

export const metadata = { title: "Admin login · Voices" };

export default function LoginPage() {
  return (
    <main className="backdrop grid min-h-screen flex-1 place-items-center px-4">
      <div className="surface rise w-full max-w-sm rounded-3xl p-7 sm:p-8">
        <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-brand-ink shadow-lg"><Mic size={22} /></span>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Manage recordings, questions and responses.</p>
        <LoginForm />
      </div>
    </main>
  );
}
