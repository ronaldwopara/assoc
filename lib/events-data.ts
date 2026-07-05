import {
  AFRICAN_FESTIVAL_VOLUNTEER_FORM_URL,
  BLACK_HISTORY_MONTH_VOLUNTEER_FORM_URL,
  END_OF_YEAR_FORM_URL,
  FAMILY_WELLNESS_FORM_URL,
  YOUTH_CREATIVE_LAB_FORM_URL,
} from "@/lib/external-links";
import { SETTLEMENT_WELLBEING_TITLE } from "@/lib/program-names";

export interface UpcomingEvent {
  title: string;
  badge: string;
  location: string;
  when: string;
  videoSrc: string;
  href: string;
}

export const upcomingEvents: UpcomingEvent[] = [
  {
    title: "African Festival",
    badge: "AUG",
    location: "Strathcona County, AB",
    when: "Annual — August",
    videoSrc:
      "https://res.cloudinary.com/daldas2e7/video/upload/v1782756282/asosc/videos/african-festival-optimized.mp4",
    href: "#festival",
  },
  {
    title: "Black History Month",
    badge: "FEB",
    location: "Strathcona County, AB",
    when: "Annual — February",
    videoSrc:
      "https://res.cloudinary.com/daldas2e7/video/upload/v1782761786/asosc/videos/black-history-month-optimized.mp4",
    href: "#bhm",
  },
  {
    title: "End-of-Year/Volunteer Appreciation Party",
    badge: "DEC",
    location: "Strathcona County, AB",
    when: "Annual — December",
    videoSrc:
      "https://res.cloudinary.com/daldas2e7/video/upload/v1782758139/asosc/videos/annual-end-of-year-celebration-optimized.mp4",
    href: "#celebration",
  },
  {
    title: SETTLEMENT_WELLBEING_TITLE,
    badge: "ALL YEAR",
    location: "Strathcona County, AB",
    when: "Seasonal sessions",
    videoSrc:
      "https://res.cloudinary.com/daldas2e7/video/upload/v1782758607/asosc/videos/family-wellness-seminars-optimized.mp4",
    href: "#wellness",
  },
  {
    title: "Youth Creative Lab",
    badge: "ALL YEAR",
    location: "Strathcona County, AB",
    when: "Ongoing program",
    videoSrc:
      "https://res.cloudinary.com/daldas2e7/video/upload/v1782760767/asosc/videos/youth-creative-media-lab-optimized-20260629.mp4",
    href: "#youth-lab",
  },
];

export const eventActionLinks: Partial<
  Record<string, { label: "Register" | "Volunteer"; href: string }>
> = {
  "African Festival": {
    label: "Volunteer",
    href: AFRICAN_FESTIVAL_VOLUNTEER_FORM_URL,
  },
  "Black History Month": {
    label: "Volunteer",
    href: BLACK_HISTORY_MONTH_VOLUNTEER_FORM_URL,
  },
  "End-of-Year/Volunteer Appreciation Party": {
    label: "Register",
    href: END_OF_YEAR_FORM_URL,
  },
  [SETTLEMENT_WELLBEING_TITLE]: {
    label: "Register",
    href: FAMILY_WELLNESS_FORM_URL,
  },
  "Youth Creative Lab": {
    label: "Register",
    href: YOUTH_CREATIVE_LAB_FORM_URL,
  },
};
