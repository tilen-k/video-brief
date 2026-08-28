import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LibraryComposer } from "@/components/library/library-composer";
import { AppShell } from "@/components/shared/layout/app-shell";
import { isGuestUser } from "@/domain/auth/is-anonymous";
import { needsOnboarding } from "@/domain/auth/needs-onboarding";
import { getUserProfile } from "@/domain/analysis/get-user-profile";
import {
  DEFAULT_LENGTH_SCORE,
  DEFAULT_TONE_SCORE,
} from "@/domain/analysis/prefs";
import { isAdvancedModelEnabled } from "@/domain/analysis/model-tier";
import { DEFAULT_SUMMARY_LANGUAGE } from "@/domain/i18n/summary-languages";
import { listLibraryForUser } from "@/domain/ingest/ingest-youtube-video";
import { getPlanForUser } from "@/domain/usage/plan";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
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
  const acceptLanguage = (await headers()).get("accept-language");
  const [items, profile, plan] = await Promise.all([
    listLibraryForUser(user.id),
    getUserProfile(user.id, { acceptLanguage }),
    getPlanForUser(user.id),
  ]);

  return (
    <AppShell
      userEmail={isGuest ? null : user.email}
      userEmailHref="/account"
      isGuest={isGuest}
      signUpLabel={auth("signup")}
      signInLabel={guestT("signIn")}
    >
      <LibraryComposer
        initialItems={items}
        defaultLength={profile?.summaryLength ?? DEFAULT_LENGTH_SCORE}
        defaultTone={profile?.summaryTone ?? DEFAULT_TONE_SCORE}
        defaultSummaryLanguage={
          profile?.defaultSummaryLanguage ?? DEFAULT_SUMMARY_LANGUAGE
        }
        plan={plan}
        advancedModelEnabled={isAdvancedModelEnabled()}
      />
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
    </AppShell>
  );
}
