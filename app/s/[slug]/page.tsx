import StudyFlow from "@/components/StudyFlow";

export default async function StudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StudyFlow slug={slug} />;
}
