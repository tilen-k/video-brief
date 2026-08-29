import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { needsOnboarding } from "@/domain/auth/needs-onboarding";
import { getWorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import { createClient } from "@/lib/supabase/server";
import { userVideoIdSchema } from "@/lib/validations/workspace";

type WorkspacePageProps = {
  params: Promise<{ userVideoId: string }>;
  searchParams: Promise<{ notice?: string }>;
};

const resolveWorkspace = cache(async (userVideoId: string) => {
  const parsed = userVideoIdSchema.safeParse(userVideoId);
  if (!parsed.success) {
    return { kind: "invalid" as const };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { kind: "unauthenticated" as const, userVideoId: parsed.data };
  }

  if (await needsOnboarding(user)) {
    return { kind: "onboarding" as const };
  }

  const video = await getWorkspaceVideo(user.id, parsed.data);
  if (!video) {
    return { kind: "missing" as const };
  }

  return { kind: "ok" as const, video };
});

export async function generateMetadata({
  params,
}: WorkspacePageProps): Promise<Metadata> {
  const { userVideoId } = await params;
  const result = await resolveWorkspace(userVideoId);
  if (result.kind !== "ok") {
    return { title: "Video" };
  }
  return { title: result.video.title };
}

export default async function WorkspacePage({
  params,
  searchParams,
}: WorkspacePageProps) {
  const { userVideoId } = await params;
  const { notice } = await searchParams;
  const result = await resolveWorkspace(userVideoId);

  if (result.kind === "unauthenticated") {
    // Don't mint a guest per shared / scraped workspace URL — send home.
    redirect("/auth/guest?next=/");
  }

  if (result.kind === "onboarding") {
    redirect("/onboarding");
  }

  if (result.kind === "invalid" || result.kind === "missing") {
    notFound();
  }

  return <WorkspaceShell initial={result.video} notice={notice} />;
}
