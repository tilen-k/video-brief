import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { getOnboardingCompleted } from "@/domain/onboarding";
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

      <section className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <p className="text-muted-foreground">{t("empty")}</p>
      </section>
    </main>
  );
}
