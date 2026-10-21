import { AdminShell } from "@/components/admin/bits";
import { loadAdminCtx } from "@/lib/admin-ctx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Voices" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await loadAdminCtx();
  const slugs = ctx.ok ? ctx.studies.map((s) => ({ slug: s.slug, name: s.name })) : [];
  return <AdminShell slugs={slugs}>{children}</AdminShell>;
}
