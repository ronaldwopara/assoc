import { membershipCategoryOptions } from "@/lib/join-community-forms";

export const E_TRANSFER_EMAIL = "payment@asosc.ca";

export const STRIPE_DONATE =
  "https://buy.stripe.com/7sYfZhbLfg4DbNMexxeAg09";

export const STRIPE_MEMBERSHIP = {
  organizational: "https://buy.stripe.com/bIY8xFalR6947lKcMR",
  single_student: "https://buy.stripe.com/fZecNV65B7d8gWk148",
  family: "https://buy.stripe.com/00gcNV0LhcxscG4bIK",
  senior: "https://buy.stripe.com/5kA15ddy32WScG47ss",
} as const;

type PaymentValues = Record<string, string | string[] | undefined>;

function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function getDonationDisplayAmount(values: PaymentValues): string {
  const amount = asString(values.donationAmount);
  if (amount === "custom") {
    const custom = asString(values.customAmount).trim();
    return custom ? `$${custom}` : "$—";
  }
  if (amount) return `$${amount}`;
  return "$—";
}

export function getMembershipDisplayAmount(values: PaymentValues): string {
  const category = asString(values.membershipCategory);
  const match = membershipCategoryOptions.find((option) => option.value === category);
  return match?.price ?? "$—";
}

export function getPaymentDisplayAmount(
  kind: "donate" | "membership",
  values: PaymentValues,
): string {
  return kind === "donate"
    ? getDonationDisplayAmount(values)
    : getMembershipDisplayAmount(values);
}

export function getStripeCheckoutUrl(
  kind: "donate" | "membership",
  values: PaymentValues,
): string | null {
  if (kind === "donate") return STRIPE_DONATE;

  const category = asString(values.membershipCategory) as keyof typeof STRIPE_MEMBERSHIP;
  return STRIPE_MEMBERSHIP[category] ?? null;
}
