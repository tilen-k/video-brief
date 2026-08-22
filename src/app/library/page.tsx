import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AddVideoForm } from "@/components/library/add-video-form";
import { LibraryList } from "@/components/library/library-list";
import { Button } from "@/components/ui/button";
import { listLibraryForUser } from "@/domain/ingest/ingest-youtube-video";
import { getOnboardingCompleted } from "@/domain/onboarding";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  const t = await getTranslations("Library");
  const brand = await getTranslations("Brand");
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
    <main className="mx-auto flex min-h-full w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="font-heading text-xl tracking-tight">{brand("name")}</p>
          <h1 className="text-sm text-muted-foreground">{t("title")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.email}
          </span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              {t("logout")}
            </Button>
          </form>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl tracking-tight">{t("addTitle")}</h2>
        <AddVideoForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("yourVideos")}
        </h2>
        <LibraryList items={items} />
      </section>
    </main>
  );
}
