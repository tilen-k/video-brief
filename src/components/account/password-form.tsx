"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import {
  updateAccountPassword,
  type AccountPasswordState,
} from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AccountPasswordState = {};

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("Account");
  const [state, action, pending] = useActionState(
    updateAccountPassword,
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {hasPassword ? (
        <div className="space-y-2">
          <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("createPasswordHint")}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="newPassword">{t("newPassword")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-foreground">{t("passwordUpdated")}</p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending
          ? t("saving")
          : hasPassword
            ? t("changePassword")
            : t("createPassword")}
      </Button>
    </form>
  );
}
