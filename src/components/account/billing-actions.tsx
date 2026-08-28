"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  openBillingPortal,
  startProCheckout,
  type BillingActionState,
} from "@/lib/actions/billing";

const initial: BillingActionState = {};

type UpgradeButtonProps = {
  label: string;
  pendingLabel: string;
};

export function UpgradeToProButton({ label, pendingLabel }: UpgradeButtonProps) {
  const [state, action, pending] = useActionState(startProCheckout, initial);

  return (
    <form action={action} className="space-y-2">
      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

type PortalButtonProps = {
  label: string;
  pendingLabel: string;
};

export function ManageBillingButton({
  label,
  pendingLabel,
}: PortalButtonProps) {
  const [state, action, pending] = useActionState(openBillingPortal, initial);

  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function CompletePaymentButton({
  label,
  pendingLabel,
}: PortalButtonProps) {
  const [state, action, pending] = useActionState(openBillingPortal, initial);

  return (
    <form action={action} className="space-y-2">
      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
