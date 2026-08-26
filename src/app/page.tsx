import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AddVideoForm } from "@/components/library/add-video-form";
import { LibraryList } from "@/components/library/library-list";
import { AppShell } from "@/components/shared/layout/app-shell";
import { Panel } from "@/components/shared/list/panel";
import { isGuestUser } from "@/domain/auth/is-anonymous";
import { needsOnboarding } from "@/domain/auth/needs-onboarding";
import { getUserProfile } from "@/domain/analysis/get-user-profile";
import {
  DEFAULT_LENGTH_SCORE,
  DEFAULT_TONE_SCORE,
} from "@/domain/analysis/prefs";
import { listLibraryForUser } from "@/domain/ingest/ingest-youtube-video";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const t = await getTranslations("Library");
  const guestT = await getTranslations("Guest");
  const auth = await getTranslations("Auth");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/guest?next=/");
  }

  if (await needsOnboarding(user)) {
    redirect("/onboarding");
  }

  const isGuest = isGuestUser(user);
  const [items, profile] = await Promise.all([
    listLibraryForUser(user.id),
    getUserProfile(user.id),
  ]);

  return (
    <AppShell
      userEmail={isGuest ? null : user.email}
      userEmailHref="/account"
      isGuest={isGuest}
      signUpLabel={auth("signup")}
      signInLabel={guestT("signIn")}
    >
      <div className="flex flex-col gap-8">
        <Panel>
          <AddVideoForm
            defaultLength={profile?.summaryLength ?? DEFAULT_LENGTH_SCORE}
            defaultTone={profile?.summaryTone ?? DEFAULT_TONE_SCORE}
          />
        </Panel>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">
            {t("yourVideos")}
          </h2>
          <LibraryList initialItems={items} />
          {isGuest ? (
            <p className="pt-1 text-center text-xs text-muted-foreground">
              <Link
                href="/signup"
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {guestT("persistCtaSignUp")}
              </Link>
              {guestT("persistCtaRest")}
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
