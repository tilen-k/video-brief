import { Play } from "lucide-react";
import { getTranslations } from "next-intl/server";

const SECTION_KEYS = ["s1", "s2", "s3"] as const;
const ACTIVE_INDEX = 1;

export async function SyncPreview() {
  const t = await getTranslations("Landing");

  return (
    <figure
      aria-label={t("previewLabel")}
      className="landing-preview-enter w-full max-w-lg"
    >
      <figcaption className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
        {t("previewLabel")}
      </figcaption>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/30">
        <div className="grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          {/* Video pane */}
          <div className="border-b border-border sm:border-r sm:border-b-0">
            <div className="relative aspect-video bg-muted/40">
              <div className="absolute inset-0 bg-[linear-gradient(145deg,oklch(0.22_0.03_260)_0%,oklch(0.16_0.02_260)_100%)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-11 items-center justify-center rounded-full border border-foreground/15 bg-background/20 backdrop-blur-sm">
                  <Play
                    className="ml-0.5 size-4 fill-foreground/80 text-foreground/80"
                    aria-hidden
                  />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-8">
                <p className="truncate text-xs text-foreground/90">
                  {t("previewVideoTitle")}
                </p>
                <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-foreground/15">
                  <div className="h-full w-[38%] rounded-full bg-primary" />
                </div>
                <p className="mt-1 font-mono text-[0.6rem] tabular-nums text-foreground/50">
                  4:12 / 11:04
                </p>
              </div>
            </div>
          </div>

          {/* Section pane */}
          <div className="relative flex flex-col">
            <div
              aria-hidden
              className="absolute bottom-4 left-3 top-4 w-px bg-border"
            />
            <ul className="flex flex-1 flex-col gap-0 py-3">
              {SECTION_KEYS.map((key, index) => {
                const isActive = index === ACTIVE_INDEX;
                const section = t.raw(`previewSections.${key}`) as {
                  time: string;
                  title: string;
                };

                return (
                  <li
                    key={key}
                    className={
                      isActive
                        ? "relative border-l-2 border-primary bg-primary/8 pl-4 pr-3 py-2.5"
                        : "relative pl-4 pr-3 py-2.5 text-muted-foreground"
                    }
                  >
                    <div
                      aria-hidden
                      className={
                        isActive
                          ? "absolute -left-[5px] top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
                          : "absolute -left-[3px] top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-border"
                      }
                    />
                    <p className="font-mono text-[0.6rem] tabular-nums tracking-wide">
                      {section.time}
                    </p>
                    <p
                      className={
                        isActive
                          ? "mt-0.5 text-sm leading-snug text-foreground"
                          : "mt-0.5 text-sm leading-snug"
                      }
                    >
                      {section.title}
                    </p>
                    {isActive ? (
                      <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-wider text-primary">
                        {t("previewActive")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </figure>
  );
}
