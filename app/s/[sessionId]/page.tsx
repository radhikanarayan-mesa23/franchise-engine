import { redirect } from "next/navigation";

export default async function SessionHome({ params }: { params: Promise<{ sessionId: string }> }) {
  redirect(`/s/${(await params).sessionId}/applications`);
}
