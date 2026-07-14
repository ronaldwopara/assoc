import type { FormValues, GuidedStep } from "@/components/guided-form";

export const volunteerInterests = [
  "Event and Programs Planning",
  "Workshop/Seminar Facilitation",
  "Fundraising",
  "Community outreach or Advocacy",
  "Youth Mentorship",
  "Artist or Performer",
  "Others",
];

export const donationAmounts = [10, 25, 50, 60, 75, 100];

export const ageOptions = ["65 years and above", "18 - 64 years", "Under 18 years"];
export const genderOptions = ["Male", "Female", "Prefer not to say"];
export const yesNoOptions = ["Yes", "No"];
export const childrenCountOptions = ["1", "2", "3", "4", "5+"];

export const membershipParticipationOptions = [
  "Volunteering at Events and Programs",
  "Sponsorship",
  "Fundraising",
  "Lending or Donation of African artifacts",
  "Community outreach and/or Advocacy",
  "Partnership/Collaborations",
  "Youth Group",
];

export const membershipCategoryOptions = [
  {
    value: "organizational",
    title: "Organizational Membership",
    price: "$100CAD",
    label: "Organizational Membership ($100CAD)",
  },
  {
    value: "single_student",
    title: "Single/Student Membership",
    price: "$15CAD",
    label: "Single/Student Membership ($15CAD)",
  },
  {
    value: "family",
    title: "Family Membership",
    price: "$30CAD",
    label: "Family Membership ($30CAD)",
  },
  {
    value: "senior",
    title: "Senior's Membership",
    price: "$10CAD",
    label: "Senior's Membership ($10CAD)",
  },
];

export const vendorTypeOptions = [
  "Art & Craft Vendor",
  "Fashion/Clothing Vendor",
  "Jewelry/Accessories Vendor",
  "Books & Literature",
  "Cultural Items/Artifacts",
  "Other (please specify)",
];

export const vendorBoothOptions = ["Yes", "No, I will bring my own"];

export const vendorBoothEquipmentOptions = [
  "Open flame or grill",
  "Sound or music equipment",
  "Refrigeration",
  "None of the above",
];

export const vendorHearAboutOptions = [
  "ASOSC website",
  "Social Media",
  "Word of Mouth",
  "Other (please specify)",
];

const emailStep = (id = "email", helper = "We'll send updates and confirmations here."): GuidedStep => ({
  id,
  title: "What's your email?",
  helper,
  fields: [
    {
      type: "text",
      name: "email",
      inputType: "email",
      placeholder: "you@example.com",
      autoComplete: "email",
    },
  ],
});

const phoneStep = (id = "phone", optional = false, helper = "For urgent updates and event reminders."): GuidedStep => ({
  id,
  title: optional ? "Phone number (optional)" : "What's your phone number?",
  helper,
  optional,
  fields: [
    {
      type: "text",
      name: "phone",
      inputType: "tel",
      placeholder: "123-456-7890",
      autoComplete: "tel",
    },
  ],
});

const nameStep = (title = "What's your name?", helper = "We'll use this to personalize your experience."): GuidedStep => ({
  id: "name",
  title,
  helper,
  fields: [{ type: "name" }],
});

export const newsletterSteps: GuidedStep[] = [
  nameStep(),
  emailStep(),
  {
    id: "strathcona",
    title: "Do you reside or own a business in Strathcona County?",
    helper: "Helps us share region-specific programs and events.",
    fields: [
      {
        type: "choice",
        name: "strathconaResident",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
];

export const volunteerSteps: GuidedStep[] = [
  nameStep(),
  emailStep(),
  phoneStep(),
  {
    id: "interests-a",
    title: "How would you like to participate?",
    helper: "Select all that apply.",
    fields: [
      {
        type: "choice",
        name: "volunteerInterests",
        options: volunteerInterests.slice(0, 4),
        multiple: true,
      },
    ],
    validate: (values) =>
      Array.isArray(values.volunteerInterests) && values.volunteerInterests.length > 0
        ? null
        : "Select at least one option.",
  },
  {
    id: "interests-b",
    title: "Any other ways to participate?",
    helper: "Optional — select all that apply.",
    optional: true,
    fields: [
      {
        type: "choice",
        name: "volunteerInterests",
        options: volunteerInterests.slice(4),
        multiple: true,
      },
    ],
  },
  {
    id: "comments",
    title: "Anything else you'd like to share?",
    helper: "Share your skills, availability, or any questions you have.",
    optional: true,
    fields: [
      {
        type: "textarea",
        name: "comments",
        rows: 2,
      },
    ],
  },
  {
    id: "updates",
    title: "Get notified of future events?",
    helper: "Stay in the loop about upcoming ASOSC conferences and gatherings.",
    fields: [
      {
        type: "choice",
        name: "futureEventsOptIn",
        options: [
          { value: "yes", label: "Yes, email me about future conferences" },
          { value: "no", label: "No thanks" },
        ],
      },
    ],
  },
];

export const donateSteps: GuidedStep[] = [
  {
    id: "amount",
    title: "Choose an amount",
    helper: "Every dollar supports African community programs in Strathcona County.",
    fields: [
      {
        type: "donation-amount",
        amounts: donationAmounts,
      },
    ],
  },
  {
    id: "payment",
    title: "How would you like to pay?",
    helper:
      "Card is instant through Stripe. Prefer banking from home? Send an e-transfer — include your name in the memo so we can thank you.",
    fields: [{ type: "payment", kind: "donate" }],
  },
];

export const membershipSteps: GuidedStep[] = [
  nameStep("What's your name?", "Required for official ASOSC membership records."),
  emailStep("email", "We'll send your membership confirmation and updates here."),
  phoneStep("phone", false, "For membership verification and urgent community alerts."),
  {
    id: "address",
    title: "What's your residential address?",
    helper: "Required for membership records and mailing physical materials.",
    fields: [
      {
        type: "text",
        name: "address",
        autoComplete: "street-address",
      },
    ],
  },
  {
    id: "age",
    title: "What's your age range?",
    helper: "Helps us design age-appropriate programs and activities.",
    fields: [{ type: "choice", name: "age", options: ageOptions }],
  },
  {
    id: "gender",
    title: "Gender",
    helper: "Optional demographic info for program planning.",
    fields: [{ type: "choice", name: "gender", options: genderOptions }],
  },
  {
    id: "country",
    title: "Country of origin",
    helper: "Celebrates the diversity within our African community.",
    fields: [{ type: "text", name: "countryOfOrigin" }],
  },
  {
    id: "category",
    title: "Membership category",
    helper: "Choose the tier that best fits your household or organization.",
    fields: [
      {
        type: "priced-select",
        name: "membershipCategory",
        options: membershipCategoryOptions,
        placeholder: "Select a category",
      },
    ],
  },
  {
    id: "spouse-name",
    title: "Spouse's full name",
    helper: "Include your spouse in your family membership.",
    optional: true,
    fields: [{ type: "text", name: "spouseName" }],
  },
  {
    id: "spouse-email",
    title: "Spouse's email address",
    helper: "We'll send event invites and updates to both of you.",
    optional: true,
    when: (values) => Boolean(String(values.spouseName ?? "").trim()),
    fields: [
      {
        type: "text",
        name: "spouseEmail",
        inputType: "email",
      },
    ],
  },
  {
    id: "spouse-phone",
    title: "Spouse's phone number",
    helper: "For direct contact with your spouse about ASOSC activities.",
    optional: true,
    when: (values) => Boolean(String(values.spouseName ?? "").trim()),
    fields: [
      {
        type: "text",
        name: "spousePhone",
        inputType: "tel",
      },
    ],
  },
  {
    id: "spouse-address",
    title: "Spouse's address (if different)",
    helper: "Only needed if your spouse lives at a different address.",
    optional: true,
    when: (values) => Boolean(String(values.spouseName ?? "").trim()),
    fields: [{ type: "text", name: "spouseAddress" }],
  },
  {
    id: "spouse-consent",
    title: "May we email and text your spouse about ASOSC activities?",
    helper: "We respect your family's communication preferences.",
    when: (values) => Boolean(String(values.spouseName ?? "").trim()),
    fields: [{ type: "choice", name: "spouseConsent", options: yesNoOptions }],
  },
  {
    id: "spouse-text",
    title: "Receive spouse text messages at",
    helper: "Confirm the best number for text reminders.",
    when: (values) =>
      Boolean(String(values.spouseName ?? "").trim()) && values.spouseConsent === "Yes",
    fields: [
      {
        type: "text",
        name: "spouseTextNumber",
        inputType: "tel",
        placeholder: "123-456-7890",
      },
    ],
  },
  {
    id: "register-children",
    title: "Do you want to register your children?",
    helper: "Kids under 18 can join ASOSC youth programs at no extra cost.",
    fields: [{ type: "choice", name: "registerChildren", options: yesNoOptions }],
  },
  {
    id: "children-count",
    title: "How many children?",
    helper: "Include all children you'd like to register for youth activities.",
    when: (values) => values.registerChildren === "Yes",
    fields: [
      {
        type: "select",
        name: "childrenCount",
        options: childrenCountOptions,
      },
    ],
  },
  {
    id: "children-ages",
    title: "Ages of your children",
    helper: "Helps us plan age-appropriate youth programming.",
    when: (values) => values.registerChildren === "Yes",
    fields: [
      {
        type: "text",
        name: "childrenAges",
        placeholder: "e.g. 5, 7, 9, 10",
      },
    ],
  },
  {
    id: "participation-a",
    title: "How would you like to participate?",
    optional: true,
    helper: "Select all that apply.",
    fields: [
      {
        type: "choice",
        name: "membershipParticipation",
        options: membershipParticipationOptions.slice(0, 4),
        multiple: true,
      },
    ],
  },
  {
    id: "participation-b",
    title: "Any other ways to get involved?",
    optional: true,
    helper: "Select all that apply.",
    fields: [
      {
        type: "choice",
        name: "membershipParticipation",
        options: membershipParticipationOptions.slice(4),
        multiple: true,
      },
    ],
  },
  {
    id: "consent",
    title: "May we email and text you about ASOSC activities?",
    helper: "Stay connected with event announcements and community news.",
    fields: [{ type: "choice", name: "consent", options: yesNoOptions }],
  },
  {
    id: "comments",
    title: "Any comments or concerns?",
    helper: "Questions or feedback? We're here to help.",
    optional: true,
    fields: [
      {
        type: "textarea",
        name: "comments",
        rows: 2,
      },
      {
        type: "note",
        paragraphs: [
          "Personal information is for ASOSC membership administration. Questions: info@asosc.ca",
        ],
      },
    ],
  },
  {
    id: "payment",
    title: "How would you like to pay?",
    helper:
      "Card is instant through Stripe. Prefer banking from home? Send an e-transfer — include your name in the memo so we can thank you.",
    fields: [{ type: "payment", kind: "membership" }],
  },
];

export const vendorSteps: GuidedStep[] = [
  nameStep("What's your full name?", "Your full legal name for vendor registration."),
  {
    id: "business",
    title: "Business or organization name",
    helper: "Your official business name, if you have one.",
    optional: true,
    fields: [{ type: "text", name: "businessName" }],
  },
  emailStep("email", "Primary contact for vendor coordination and approvals."),
  phoneStep("phone", false, "For last-minute updates and day-of-event communication."),
  {
    id: "website",
    title: "Website or social media handle",
    helper: "Helps us promote your booth to event attendees.",
    optional: true,
    fields: [
      {
        type: "text",
        name: "website",
        placeholder: "https:// or @handle",
      },
    ],
  },
  {
    id: "vendor-type",
    title: "What type of vendor are you?",
    helper: "Helps us organize vendors into themed areas at the event.",
    fields: [
      {
        type: "choice-with-other",
        name: "vendorType",
        otherName: "vendorTypeOther",
        options: vendorTypeOptions,
        otherTrigger: "Other (please specify)",
      },
    ],
  },
  {
    id: "products",
    title: "Describe your products or services",
    helper: "A brief overview of what you'll be selling or showcasing.",
    fields: [
      {
        type: "textarea",
        name: "productsServices",
        rows: 2,
      },
    ],
  },
  {
    id: "culture",
    title: "Do your offerings represent a specific African culture or region?",
    optional: true,
    helper: "If yes, please specify.",
    fields: [
      {
        type: "textarea",
        name: "africanCultureRegion",
        rows: 2,
      },
    ],
  },
  {
    id: "booth",
    title: "Do you need a booth or table from ASOSC?",
    helper: "Free booth space is available on a first-come basis.",
    fields: [{ type: "choice", name: "boothRequired", options: vendorBoothOptions }],
  },
  {
    id: "electricity",
    title: "Do you need access to electricity?",
    helper: "Let us know so we can assign you a booth near an outlet.",
    fields: [{ type: "choice", name: "electricityRequired", options: yesNoOptions }],
  },
  {
    id: "equipment",
    title: "Will you use any of the following at your booth?",
    helper: "Select all that apply.",
    fields: [
      {
        type: "choice",
        name: "boothEquipment",
        options: vendorBoothEquipmentOptions,
        multiple: true,
        exclusiveOption: "None of the above",
      },
    ],
  },
  {
    id: "water",
    title: "Do you need access to water?",
    helper: "Required for food prep or certain crafts — we'll arrange it.",
    fields: [{ type: "choice", name: "waterRequired", options: yesNoOptions }],
  },
  {
    id: "license",
    title: "Do you have a business license?",
    helper: "Not required, but helpful for insurance and record-keeping.",
    fields: [{ type: "choice", name: "businessLicense", options: yesNoOptions }],
  },
  {
    id: "insurance",
    title: "Do you carry liability insurance?",
    helper: "Recommended but not mandatory for vendor participation.",
    fields: [{ type: "choice", name: "liabilityInsurance", options: yesNoOptions }],
  },
  {
    id: "hear-about",
    title: "How did you hear about this opportunity?",
    helper: "Helps us understand which outreach efforts work best.",
    optional: true,
    fields: [
      {
        type: "choice-with-other",
        name: "hearAbout",
        otherName: "hearAboutOther",
        options: vendorHearAboutOptions,
        otherTrigger: "Other (please specify)",
      },
    ],
  },
  {
    id: "comments",
    title: "Additional comments or special requests",
    helper: "Dietary restrictions, accessibility needs, or setup questions.",
    optional: true,
    fields: [
      {
        type: "textarea",
        name: "comments",
        rows: 2,
      },
    ],
  },
  {
    id: "approval",
    title: "I understand this form does not guarantee vendor approval",
    helper: "ASOSC will contact selected vendors with next steps.",
    fields: [
      {
        type: "choice",
        name: "vendorApprovalUnderstanding",
        options: ["Yes, I understand"],
      },
    ],
  },
  {
    id: "guidelines",
    title: "I agree to follow event guidelines and respect ASOSC's mission",
    helper: "Vendors must uphold ASOSC values and community standards.",
    fields: [
      {
        type: "choice",
        name: "vendorGuidelinesAgreement",
        options: ["Yes, I agree"],
      },
      {
        type: "note",
        paragraphs: [
          "Personal information is for ASOSC vendor coordination. Questions: info@asosc.ca",
        ],
      },
    ],
  },
];

export const contactSteps: GuidedStep[] = [
  nameStep("What's your name?", "So we know who to address in our reply."),
  phoneStep("phone", true, "Optional — in case we need to follow up by phone."),
  emailStep("email", "We'll respond to your message at this address."),
  {
    id: "message",
    title: "How can we help?",
    helper: "Share your question, feedback, or partnership inquiry.",
    fields: [
      {
        type: "textarea",
        name: "message",
        rows: 2,
        placeholder: "Comment or message",
      },
    ],
  },
];

export function valuesToPayload(values: FormValues): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    payload[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return payload;
}
