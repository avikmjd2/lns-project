import { LoginForm } from "@/components/admin/bits";

export const metadata = { title: "Admin login · Voices" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen flex-1 place-items-center px-5">
      <div className="rise w-full max-w-sm">
        <div className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 bg-signal" aria-hidden /><span className="text-[1.6rem] font-medium leading-none tracking-[-0.02em]">Voices</span></div>
        <h1 className="mt-8 border-t-2 border-ink pt-5 text-[2.2rem] font-medium leading-[1.05] tracking-[-0.02em]">Admin sign in</h1>
        <p className="mb-8 mt-2 text-muted">Recordings, questions and responses.</p>
        <LoginForm />
      </div>
    </main>
  );
}
