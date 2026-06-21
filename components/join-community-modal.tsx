"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Mail, HandHeart, Heart, IdCard, MessageCircle } from "lucide-react";
import { ExpandableTabs } from "@/components/expandable-tabs";

const NAVBAR_IMAGE_OPACITY = 0.95;

const navbarBackgroundStyle = {
  backgroundImage: "url(https://res.cloudinary.com/daldas2e7/image/upload/v1782010316/asosc/nav.png)",
  backgroundRepeat: "repeat" as const,
  opacity: NAVBAR_IMAGE_OPACITY,
};

const actionTabs = [
  { title: "Newsletter", icon: Mail },
  { title: "Volunteer", icon: Heart },
  { title: "Donate", icon: HandHeart },
  { title: "Membership", icon: IdCard },
  { title: "Contact", icon: MessageCircle },
];

const fieldLabelClassName = "mb-1.5 block text-sm font-semibold text-black";
const fieldInputClassName =
  "focus-ring-light w-full rounded-xl border border-(--brown-dark)/15 bg-white px-4 py-3 text-black placeholder:text-black/40 focus:outline-none";
const fieldTextareaClassName = `${fieldInputClassName} resize-none`;
const checkboxLabelClassName = "flex items-center gap-2 text-black";

const volunteerInterests = [
  "Event and Programs Planning",
  "Workshop/Seminar Facilitation",
  "Fundraising",
  "Community outreach or Advocacy",
  "Youth Mentorship",
  "Artist or Performer",
  "Others",
];

const donationAmounts = [10, 25, 50, 60, 75, 100];

const ageOptions = ["65 years and above", "18 - 64 years", "Under 18 years"];
const genderOptions = ["Male", "Female", "Prefer not to say"];
const yesNoOptions = ["Yes", "No"];
const childrenCountOptions = ["1", "2", "3", "4", "5+"];
const membershipParticipationOptions = [
  "Volunteering at Events and Programs",
  "Sponsorship",
  "Fundraising",
  "Lending or Donation of African artifacts",
  "Community outreach and/or Advocacy",
  "Partnership/Collaborations",
  "Youth Group",
];

function RadioGroup({ name, options }: { name: string; options: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {options.map((option) => (
        <label key={option} className={checkboxLabelClassName}>
          <input type="radio" name={name} value={option} className="accent-(--brown-dark)" />
          {option}
        </label>
      ))}
    </div>
  );
}

function CheckboxGroup({ name, options }: { name: string; options: string[] }) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label key={option} className={checkboxLabelClassName}>
          <input type="checkbox" name={name} value={option} className="accent-(--brown-dark)" />
          {option}
        </label>
      ))}
    </div>
  );
}

interface JoinCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAction?: string | null;
}

export function JoinCommunityModal({ isOpen, onClose, initialAction = null }: JoinCommunityModalProps) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const initialActionIndex = actionTabs.findIndex((tab) => tab.title === initialAction);
  const defaultActionIndex = initialActionIndex >= 0 ? initialActionIndex : 0;
  const [activeActionIndex, setActiveActionIndex] = useState<number | null>(defaultActionIndex);

  const [donationFrequency, setDonationFrequency] = useState<"once" | "monthly">("once");
  const [donationAmount, setDonationAmount] = useState<number | "custom" | null>(donationAmounts[2]);
  const [customAmount, setCustomAmount] = useState("");

  const [spouseConsent, setSpouseConsent] = useState<"Yes" | "No" | null>(null);
  const [registerChildren, setRegisterChildren] = useState<"Yes" | "No" | null>(null);

  const goToPreviousAction = () => {
    setActiveActionIndex((current) => {
      const activeIndex = current ?? 0;
      return (activeIndex - 1 + actionTabs.length) % actionTabs.length;
    });
  };

  const goToNextAction = () => {
    setActiveActionIndex((current) => {
      const activeIndex = current ?? 0;
      return (activeIndex + 1) % actionTabs.length;
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) setActiveActionIndex(defaultActionIndex);
  }, [isOpen, defaultActionIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const body = document.body;
    const prevHtml = root.style.overflow;
    const prevBody = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      root.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const overlay = overlayRef.current;
    const targets = [...document.body.children].filter(
      (el) => el !== overlay && el.tagName !== "SCRIPT",
    );
    targets.forEach((el) => el.classList.add("page-blur-target", "is-blurred"));
    return () => {
      targets.forEach((el) => el.classList.remove("is-blurred"));
    };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div ref={overlayRef} className="fixed inset-0 z-(--z-modal) flex items-center justify-center overflow-x-hidden p-4 sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-community-heading"
            className="join-modal relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl"
            style={{ backgroundColor: "var(--cream-light)" }}
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Navbar-style header */}
            <div className="join-modal__header relative flex shrink-0 flex-col">
              <div className="absolute inset-0" style={navbarBackgroundStyle} aria-hidden="true" />

              <div className="relative z-10 flex justify-end p-1.5 sm:p-2">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="join-modal__close focus-ring-light flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <h2
                id="join-community-heading"
                className="relative z-10 px-6 pb-3 text-center text-lg font-bold text-white sm:pb-4 sm:text-xl"
              >
                Join Our Community
              </h2>
            </div>

            {/* Body */}
            <div className="relative h-[60vh] overflow-x-hidden overflow-y-auto px-6 py-8 text-center sm:px-10 sm:py-10">
              <div className="join-modal__grain" aria-hidden="true" />
              {actionTabs[activeActionIndex ?? -1]?.title === "Newsletter" && (
                <div className="relative z-10 mx-auto max-w-md text-left">
                  <h2 className="mb-4 text-lg font-bold text-black sm:text-xl">
                    Join our newsletter
                  </h2>
                  <form className="space-y-4">
                    <div>
                      <label className={fieldLabelClassName}>
                        Name <span className="text-(--orange)">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          name="firstName"
                          placeholder="First"
                          autoComplete="given-name"
                          required
                          className={fieldInputClassName}
                        />
                        <input
                          type="text"
                          name="lastName"
                          placeholder="Last"
                          autoComplete="family-name"
                          required
                          className={fieldInputClassName}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="newsletter-email" className={fieldLabelClassName}>
                        Email <span className="text-(--orange)">*</span>
                      </label>
                      <input
                        id="newsletter-email"
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <span className={fieldLabelClassName}>
                        Do you reside or own a business in Strathcona County?
                      </span>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 text-black">
                          <input
                            type="radio"
                            name="strathconaResident"
                            value="yes"
                            className="accent-(--brown-dark)"
                          />
                          Yes
                        </label>
                        <label className="flex items-center gap-2 text-black">
                          <input
                            type="radio"
                            name="strathconaResident"
                            value="no"
                            className="accent-(--brown-dark)"
                          />
                          No
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="hero-cta-btn focus-ring-light inline-flex min-h-14 w-full cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out sm:w-auto"
                    >
                      Subscribe
                    </button>
                  </form>
                </div>
              )}
              {actionTabs[activeActionIndex ?? -1]?.title === "Volunteer" && (
                <div className="relative z-10 mx-auto max-w-md text-left">
                  <h2 className="mb-4 text-lg font-bold text-black sm:text-xl">
                    Volunteer Form
                  </h2>
                  <form className="space-y-4">
                    <div>
                      <label className={fieldLabelClassName}>
                        Name <span className="text-(--orange)">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          name="firstName"
                          placeholder="First"
                          autoComplete="given-name"
                          required
                          className={fieldInputClassName}
                        />
                        <input
                          type="text"
                          name="lastName"
                          placeholder="Last"
                          autoComplete="family-name"
                          required
                          className={fieldInputClassName}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="volunteer-email" className={fieldLabelClassName}>
                        Email <span className="text-(--orange)">*</span>
                      </label>
                      <input
                        id="volunteer-email"
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="volunteer-phone" className={fieldLabelClassName}>
                        Phone Number <span className="text-(--orange)">*</span>
                      </label>
                      <input
                        id="volunteer-phone"
                        type="tel"
                        name="phone"
                        placeholder="123-456-7890"
                        autoComplete="tel"
                        required
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <span className={fieldLabelClassName}>
                        How would you like to participate in ASOSC activities?{" "}
                        <span className="text-(--orange)">*</span>
                      </span>
                      <div className="space-y-2">
                        {volunteerInterests.map((interest) => (
                          <label key={interest} className={checkboxLabelClassName}>
                            <input
                              type="checkbox"
                              name="volunteerInterests"
                              value={interest}
                              className="accent-(--brown-dark)"
                            />
                            {interest}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="volunteer-comments" className={fieldLabelClassName}>
                        Comments or Questions
                      </label>
                      <textarea
                        id="volunteer-comments"
                        name="comments"
                        rows={4}
                        className={fieldTextareaClassName}
                      />
                    </div>

                    <div>
                      <span className={fieldLabelClassName}>Get Notified of Future Events</span>
                      <label className={checkboxLabelClassName}>
                        <input
                          type="checkbox"
                          name="futureEventsOptIn"
                          className="accent-(--brown-dark)"
                        />
                        I would like to receive email updates regarding future conferences
                      </label>
                    </div>
                  </form>
                </div>
              )}
              {actionTabs[activeActionIndex ?? -1]?.title === "Donate" && (
                <div className="relative z-10 mx-auto max-w-md text-left">
                  <h2 className="mb-2 text-lg font-bold text-black sm:text-xl">
                    Donate Now!
                  </h2>
                  <p className="mb-6 text-sm text-black/70">
                    Your generosity helps us build programs that uplift and empower the African
                    community in Strathcona County.
                  </p>

                  <form className="space-y-4">
                    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-(--brown-dark)/15">
                      <button
                        type="button"
                        onClick={() => setDonationFrequency("once")}
                        className={`px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors duration-200 ${
                          donationFrequency === "once"
                            ? "bg-(--hero-cta) text-black"
                            : "bg-white text-black/75 hover:bg-(--brown-dark)/5"
                        }`}
                      >
                        One Time
                      </button>
                      <button
                        type="button"
                        onClick={() => setDonationFrequency("monthly")}
                        className={`px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors duration-200 ${
                          donationFrequency === "monthly"
                            ? "bg-(--hero-cta) text-black"
                            : "bg-white text-black/75 hover:bg-(--brown-dark)/5"
                        }`}
                      >
                        Monthly
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {donationAmounts.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setDonationAmount(amount)}
                          className={`rounded-xl border px-4 py-3 text-center font-semibold transition-colors duration-200 ${
                            donationAmount === amount
                              ? "border-(--hero-cta) bg-(--hero-cta)/10 text-black"
                              : "border-(--brown-dark)/15 bg-white text-black hover:bg-(--brown-dark)/5"
                          }`}
                        >
                          ${amount}
                        </button>
                      ))}
                    </div>

                    <div
                      className={`flex items-center rounded-xl border px-4 py-3 transition-colors duration-200 ${
                        donationAmount === "custom"
                          ? "border-(--hero-cta) bg-(--hero-cta)/10"
                          : "border-(--brown-dark)/15 bg-white"
                      }`}
                    >
                      <span className="mr-1 font-semibold text-black">$</span>
                      <input
                        type="number"
                        name="customAmount"
                        min="1"
                        placeholder="Other amount"
                        value={customAmount}
                        onChange={(event) => {
                          setCustomAmount(event.target.value);
                          setDonationAmount("custom");
                        }}
                        onFocus={() => setDonationAmount("custom")}
                        className="w-full bg-transparent text-black placeholder:text-black/40 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="hero-cta-btn focus-ring-light inline-flex min-h-14 w-full cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out"
                    >
                      Donate Now
                    </button>
                  </form>
                </div>
              )}
              {actionTabs[activeActionIndex ?? -1]?.title === "Membership" && (
                <div className="relative z-10 mx-auto max-w-md text-left">
                  <h2 className="mb-4 text-lg font-bold text-black sm:text-xl">
                    Membership Form
                  </h2>
                  <form className="space-y-4">
                    <div>
                      <label className={fieldLabelClassName}>
                        Name <span className="text-(--orange)">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          name="firstName"
                          placeholder="First"
                          autoComplete="given-name"
                          required
                          className={fieldInputClassName}
                        />
                        <input
                          type="text"
                          name="lastName"
                          placeholder="Last"
                          autoComplete="family-name"
                          required
                          className={fieldInputClassName}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="membership-email" className={fieldLabelClassName}>
                        Email <span className="text-(--orange)">*</span>
                      </label>
                      <input
                        id="membership-email"
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="membership-phone" className={fieldLabelClassName}>
                        Phone Number <span className="text-(--orange)">*</span>
                      </label>
                      <input
                        id="membership-phone"
                        type="tel"
                        name="phone"
                        placeholder="123-456-7890"
                        autoComplete="tel"
                        required
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="membership-address" className={fieldLabelClassName}>
                        Residential Address <span className="text-(--orange)">*</span>
                      </label>
                      <input
                        id="membership-address"
                        type="text"
                        name="address"
                        autoComplete="street-address"
                        required
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <span className={fieldLabelClassName}>
                        Age <span className="text-(--orange)">*</span>
                      </span>
                      <RadioGroup name="age" options={ageOptions} />
                    </div>

                    <div>
                      <span className={fieldLabelClassName}>
                        Gender <span className="text-(--orange)">*</span>
                      </span>
                      <RadioGroup name="gender" options={genderOptions} />
                    </div>

                    <div>
                      <label htmlFor="membership-country" className={fieldLabelClassName}>
                        Country of Origin <span className="text-(--orange)">*</span>
                      </label>
                      <input
                        id="membership-country"
                        type="text"
                        name="countryOfOrigin"
                        required
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="membership-category" className={fieldLabelClassName}>
                        Membership Category <span className="text-(--orange)">*</span>
                      </label>
                      <select
                        id="membership-category"
                        name="membershipCategory"
                        required
                        defaultValue=""
                        className={fieldInputClassName}
                      >
                        <option value="" disabled>
                          --- Select Choice ---
                        </option>
                        <option value="individual">Individual Membership</option>
                        <option value="family">Family Membership</option>
                        <option value="student">Student Membership</option>
                        <option value="senior">Senior Membership</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="spouse-name" className={fieldLabelClassName}>
                        Spouse&apos;s Full Name
                      </label>
                      <input
                        id="spouse-name"
                        type="text"
                        name="spouseName"
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="spouse-email" className={fieldLabelClassName}>
                        Spouse&apos;s email address
                      </label>
                      <input
                        id="spouse-email"
                        type="email"
                        name="spouseEmail"
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="spouse-phone" className={fieldLabelClassName}>
                        Spouse&apos;s phone number
                      </label>
                      <input
                        id="spouse-phone"
                        type="tel"
                        name="spousePhone"
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="spouse-address" className={fieldLabelClassName}>
                        Spouse&apos;s residential address, if different from yours
                      </label>
                      <input
                        id="spouse-address"
                        type="text"
                        name="spouseAddress"
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <span className={fieldLabelClassName}>
                        Does your spouse consent to receive emails and text messages on updates
                        about ASOSC activities?
                      </span>
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {yesNoOptions.map((option) => (
                          <label key={option} className={checkboxLabelClassName}>
                            <input
                              type="radio"
                              name="spouseConsent"
                              value={option}
                              checked={spouseConsent === option}
                              onChange={() => setSpouseConsent(option as "Yes" | "No")}
                              className="accent-(--brown-dark)"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </div>

                    {spouseConsent === "Yes" && (
                      <div>
                        <label htmlFor="spouse-text-number" className={fieldLabelClassName}>
                          Receive text to
                        </label>
                        <input
                          id="spouse-text-number"
                          type="tel"
                          name="spouseTextNumber"
                          placeholder="123-456-7890"
                          className={fieldInputClassName}
                        />
                      </div>
                    )}

                    <div>
                      <span className={fieldLabelClassName}>
                        Do you want to register your children?
                      </span>
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {yesNoOptions.map((option) => (
                          <label key={option} className={checkboxLabelClassName}>
                            <input
                              type="radio"
                              name="registerChildren"
                              value={option}
                              checked={registerChildren === option}
                              onChange={() => setRegisterChildren(option as "Yes" | "No")}
                              className="accent-(--brown-dark)"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </div>

                    {registerChildren === "Yes" && (
                      <>
                        <div>
                          <label htmlFor="children-count" className={fieldLabelClassName}>
                            Number of children
                          </label>
                          <select
                            id="children-count"
                            name="childrenCount"
                            defaultValue=""
                            className={fieldInputClassName}
                          >
                            <option value="" disabled>
                              --- Select Choice ---
                            </option>
                            {childrenCountOptions.map((count) => (
                              <option key={count} value={count}>
                                {count}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="children-ages" className={fieldLabelClassName}>
                            Ages of your children
                          </label>
                          <input
                            id="children-ages"
                            type="text"
                            name="childrenAges"
                            placeholder="e.g. 5, 7, 9, 10"
                            className={fieldInputClassName}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <span className={fieldLabelClassName}>
                        How would you like to participate in ASOSC activities
                      </span>
                      <CheckboxGroup
                        name="membershipParticipation"
                        options={membershipParticipationOptions}
                      />
                    </div>

                    <div>
                      <span className={fieldLabelClassName}>
                        Do you consent to receive emails and text messages on updates about ASOSC
                        activities? <span className="text-(--orange)">*</span>
                      </span>
                      <RadioGroup name="consent" options={yesNoOptions} />
                    </div>

                    <div>
                      <label htmlFor="membership-comments" className={fieldLabelClassName}>
                        Comments
                      </label>
                      <p className="mb-1.5 text-xs text-black/60">
                        Any concerns you desire our feedback on?
                      </p>
                      <textarea
                        id="membership-comments"
                        name="comments"
                        rows={4}
                        className={fieldTextareaClassName}
                      />
                    </div>

                    <p className="text-xs text-black/60">
                      The personal information collected is for ASOSC membership administration
                      and communication and ASOSC may use automated tools for this purpose.
                    </p>
                    <p className="text-xs text-black/60">
                      Information is collected under the requirement&apos;s of the Society&apos;s
                      Act of Alberta.
                    </p>
                    <p className="text-xs text-black/60">
                      Questions about this collection may be directed to: info@asosc.ca
                    </p>

                    <button
                      type="submit"
                      className="hero-cta-btn focus-ring-light inline-flex min-h-14 w-full cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out sm:w-auto"
                    >
                      Submit
                    </button>
                  </form>
                </div>
              )}
              {actionTabs[activeActionIndex ?? -1]?.title === "Contact" && (
                <div className="relative z-10 mx-auto max-w-md text-left">
                  <h2 className="mb-4 text-lg font-bold text-black sm:text-xl">
                    We would love to hear from you!
                  </h2>
                  <form className="space-y-4">
                    <div>
                      <label className={fieldLabelClassName}>
                        Name <span className="text-(--orange)">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          name="firstName"
                          placeholder="First"
                          autoComplete="given-name"
                          required
                          className={fieldInputClassName}
                        />
                        <input
                          type="text"
                          name="lastName"
                          placeholder="Last"
                          autoComplete="family-name"
                          required
                          className={fieldInputClassName}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="contact-phone" className={fieldLabelClassName}>
                        Phone (Optional)
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        name="phone"
                        placeholder="123-456-7890"
                        autoComplete="tel"
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="contact-email" className={fieldLabelClassName}>
                        Email <span className="text-(--orange)">*</span>
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        className={fieldInputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="contact-message" className={fieldLabelClassName}>
                        Comment or Message <span className="text-(--orange)">*</span>
                      </label>
                      <textarea
                        id="contact-message"
                        name="message"
                        rows={4}
                        required
                        className={fieldTextareaClassName}
                      />
                    </div>

                    <button
                      type="submit"
                      className="hero-cta-btn focus-ring-light inline-flex min-h-14 w-full cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out sm:w-auto"
                    >
                      Send Message
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-center border-t border-(--brown-dark)/10 px-6 py-10 sm:px-10 sm:py-12">
              <div className="grid w-full max-w-full grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2 sm:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] sm:gap-3">
                <button
                  type="button"
                  onClick={goToPreviousAction}
                  aria-label="Previous community action"
                  className="focus-ring-light flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#2a2a2a] text-(--orange) transition-colors hover:bg-[#343434] sm:h-11 sm:w-11"
                >
                  <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>

                <ExpandableTabs
                  tabs={actionTabs}
                  selected={activeActionIndex}
                  onChange={(index) => {
                    if (index !== null) setActiveActionIndex(index);
                  }}
                  className="w-full"
                />

                <button
                  type="button"
                  onClick={goToNextAction}
                  aria-label="Next community action"
                  className="focus-ring-light flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#2a2a2a] text-(--orange) transition-colors hover:bg-[#343434] sm:h-11 sm:w-11"
                >
                  <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
