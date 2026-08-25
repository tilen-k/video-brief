import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AddVideoForm } from "@/components/library/add-video-form";
import { LibraryList } from "@/components/library/library-list";
import { AppShell } from "@/components/shared/layout/app-shell";
import { Panel } from "@/components/shared/list/panel";
import { getUserProfile } from "@/domain/analysis/get-user-profile";
import {
  DEFAULT_LENGTH_SCORE,
  DEFAULT_TONE_SCORE,
} from "@/domain/analysis/prefs";
import { listLibraryForUser } from "@/domain/ingest/ingest-youtube-video";
import { getOnboardingCompleted } from "@/domain/onboarding";
import { createClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  const t = await getTranslations("Library");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/library");
  }

  if (!(await getOnboardingCompleted(user.id))) {
    redirect("/onboarding");
  }

  const [items, profile] = await Promise.all([
    listLibraryForUser(user.id),
    getUserProfile(user.id),
  ]);

  return (
    <AppShell userEmail={user.email} userEmailHref="/account">
      <div className="flex flex-col gap-8">
        <Panel>
          <AddVideoForm
            defaultLength={profile?.summaryLength ?? DEFAULT_LENGTH_SCORE}
            defaultTone={profile?.summaryTone ?? DEFAULT_TONE_SCORE}
          />
        </Panel>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">
            {t("yourVideos")}
          </h2>
          <LibraryList initialItems={items} />
        </section>
      </div>
    </AppShell>
  );
}
