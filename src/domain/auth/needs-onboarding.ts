import { getOnboardingCompleted } from "@/domain/onboarding";
import { isGuestUser } from "@/domain/auth/is-anonymous";

/**
 * Guests skip onboarding until they convert (attach email / Google).
 * Email attached but still `is_anonymous` (soft confirm) may onboard.
 */
export async function needsOnboarding(user: {
  id: string;
  is_anonymous?: boolean;
  email?: string | null;
}): Promise<boolean> {
  if (isGuestUser(user)) {
    return false;
  }
  return !(await getOnboardingCompleted(user.id));
}
