"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  signIn,
  signInWithGoogle,
  signUp,
  type AuthActionState,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthActionState = {};

export function LoginForm({
  copy,
}: {
  copy: {
    email: string;
    password: string;
    login: string;
    google: string;
    or: string;
    noAccount: string;
    signup: string;
  };
}) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">{copy.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{copy.password}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
          />
        </div>
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {copy.login}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {copy.or}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          {copy.google}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {copy.noAccount}{" "}
        <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
          {copy.signup}
        </Link>
      </p>
    </div>
  );
}

export function SignupForm({
  copy,
}: {
  copy: {
    email: string;
    password: string;
    signup: string;
    google: string;
    or: string;
    hasAccount: string;
    login: string;
    softConfirm: string;
  };
}) {
  const [state, action, pending] = useActionState(signUp, initial);

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">{copy.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{copy.password}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {copy.signup}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">{copy.softConfirm}</p>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {copy.or}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          {copy.google}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {copy.hasAccount}{" "}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          {copy.login}
        </Link>
      </p>
    </div>
  );
}
