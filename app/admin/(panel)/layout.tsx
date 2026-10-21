import { AdminNav } from "@/components/admin/bits";
import { loadAdminCtx } from "@/lib/admin-ctx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await loadAdminCtx();
  const slugs = ctx.ok ? ctx.studies.map((s) => ({ slug: s.slug, name: s.name })) : [];
  return (
    <>
      <AdminNav slugs={slugs} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
