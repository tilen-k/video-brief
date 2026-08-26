import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { LibraryComposer } from "@/components/library/library-composer";
import { AppShell } from "@/components/shared/layout/app-shell";
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
      <h1 className="sr-only">{t("title")}</h1>
      <LibraryComposer
        initialItems={items}
        defaultLength={profile?.summaryLength ?? DEFAULT_LENGTH_SCORE}
        defaultTone={profile?.summaryTone ?? DEFAULT_TONE_SCORE}
      />
    </AppShell>
  );
}
