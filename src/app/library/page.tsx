import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AddVideoForm } from "@/components/library/add-video-form";
import { LibraryList } from "@/components/library/library-list";
import { AppShell } from "@/components/shared/layout/app-shell";
import { Panel } from "@/components/shared/list/panel";
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

  const items = await listLibraryForUser(user.id);

  return (
    <AppShell userEmail={user.email} userEmailHref="/account">
      <div className="flex flex-col gap-8">
        <Panel>
          <AddVideoForm />
        </Panel>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">
            {t("yourVideos")}
          </h2>
          <LibraryList items={items} />
        </section>
      </div>
    </AppShell>
  );
}
