"use client";

import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

const CARD_LOGO_URL =
  "https://res.cloudinary.com/daldas2e7/image/upload/v1782010314/asosc/logo.webp";

export type MembershipCardProps = {
  categoryTitle: string;
  price: string;
  memberName?: string;
  /** MM/YY. Defaults to one year from today. */
  expiresLabel?: string;
  className?: string;
};

export function membershipExpiryLabel(from = new Date()): string {
  const expiry = new Date(from);
  expiry.setFullYear(expiry.getFullYear() + 1);
  const month = String(expiry.getMonth() + 1).padStart(2, "0");
  const year = String(expiry.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

/** Deterministic 4-digit tail so the same member always sees the same masked number. */
function pseudoLast4(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return String(1000 + (hash % 9000));
}

export function MembershipCard({
  categoryTitle,
  price,
  memberName,
  expiresLabel,
  className,
}: MembershipCardProps) {
  const expiry = expiresLabel ?? membershipExpiryLabel();
  const last4 = pseudoLast4(memberName || categoryTitle);

  return (
    <div className={cn("mcard", className)}>
      <div className="mcard__surface">
        <div className="mcard__waves" aria-hidden="true">
          <span className="mcard__wave mcard__wave--1" />
          <span className="mcard__wave mcard__wave--2" />
          <span className="mcard__wave mcard__wave--3" />
        </div>
        <div className="mcard__sheen" aria-hidden="true" />
        <div className="mcard__grain" aria-hidden="true" />

        <div className="mcard__top">
          <span className="mcard__brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- exported to PNG via html-to-image, needs a plain img */}
            <img src={CARD_LOGO_URL} alt="" className="mcard__logo" crossOrigin="anonymous" />
            <span className="mcard__org">
              Africans Society of
              <br />
              Strathcona County
            </span>
          </span>
          <span className="mcard__price">{price}</span>
        </div>

        <div className="mcard__chip-row">
          <span className="mcard__chip" aria-hidden="true">
            <span className="mcard__chip-line mcard__chip-line--h1" />
            <span className="mcard__chip-line mcard__chip-line--h2" />
            <span className="mcard__chip-line mcard__chip-line--v" />
          </span>
          <Wifi className="mcard__contactless" aria-hidden="true" />
        </div>

        <span className="mcard__number">•••• •••• •••• •••• {last4}</span>

        <div className="mcard__footer">
          <span className="mcard__identity">
            {memberName && <span className="mcard__name">{memberName}</span>}
            <span className="mcard__type">{categoryTitle}</span>
          </span>
          <span className="mcard__meta">
            <span className="mcard__expiry">
              <span className="mcard__expiry-label">Valid thru</span>
              <span className="mcard__expiry-date">{expiry}</span>
            </span>
            <span className="mcard__brandmark">
              <span className="mcard__brandmark-label">Member</span>
              <span className="mcard__brandmark-word">ASOSC</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
