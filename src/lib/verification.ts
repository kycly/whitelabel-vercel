import { z } from "zod";

export const VERIFICATION_TYPE_OPTIONS = [
  { label: "Onboarding", value: "onboarding" },
  { label: "Mise a jour dossier", value: "profile_update" },
  { label: "Verification ponctuelle", value: "one_off_check" },
  { label: "Autre", value: "other" },
] as const;

export const COUNTRY_OPTIONS = [
  { label: "Senegal", value: "SN" },
  { label: "France", value: "FR" },
  { label: "Etats-Unis", value: "US" },
  { label: "Canada", value: "CA" },
  { label: "Royaume-Uni", value: "GB" },
  { label: "Allemagne", value: "DE" },
  { label: "Italie", value: "IT" },
  { label: "Espagne", value: "ES" },
  { label: "Suisse", value: "CH" },
  { label: "Belgique", value: "BE" },
  { label: "Maroc", value: "MA" },
  { label: "Algerie", value: "DZ" },
  { label: "Tunisie", value: "TN" },
  { label: "Cote d'Ivoire", value: "CI" },
  { label: "Autre", value: "OTHER" },
] as const;

export const SEGMENT_OPTIONS = [
  { label: "Particulier", value: "retail" },
  { label: "Independant / TPE", value: "micro_business" },
  { label: "PME", value: "smb" },
  { label: "Grande entreprise", value: "enterprise" },
] as const;

export const PRIORITY_OPTIONS = [
  { label: "Standard", value: "standard" },
  { label: "Prioritaire", value: "high" },
  { label: "Urgent", value: "urgent" },
] as const;

export const PRODUCT_OPTIONS = [
  { label: "Compte Standard", value: "standard_account" },
  { label: "Compte Premium", value: "premium_account" },
  { label: "Pret / Credit", value: "credit" },
  { label: "Paiement / Wallet", value: "payments" },
  { label: "Autre", value: "other" },
] as const;

export const NOTIFICATION_CHANNEL_OPTIONS = [
  { label: "SMS", value: "sms" },
  { label: "Email", value: "email" },
  { label: "Push", value: "push" },
] as const;

export const MAX_CUSTOM_CONTEXT_ENTRIES = 4;

const CUSTOM_CONTEXT_BLACKLIST = [
  "businesscontext",
  "compliancecontext",
  "customcontext",
  "customerid",
  "externalid",
  "journey",
  "metadataversion",
  "notificationcontext",
  "priority",
  "routingcontext",
  "verificationtype",
] as const;

const verificationTypeValues = VERIFICATION_TYPE_OPTIONS.map((option) => option.value) as [
  (typeof VERIFICATION_TYPE_OPTIONS)[number]["value"],
  ...(typeof VERIFICATION_TYPE_OPTIONS)[number]["value"][],
];
const countryValues = COUNTRY_OPTIONS.map((option) => option.value) as [
  (typeof COUNTRY_OPTIONS)[number]["value"],
  ...(typeof COUNTRY_OPTIONS)[number]["value"][],
];
const segmentValues = SEGMENT_OPTIONS.map((option) => option.value) as [
  (typeof SEGMENT_OPTIONS)[number]["value"],
  ...(typeof SEGMENT_OPTIONS)[number]["value"][],
];
const priorityValues = PRIORITY_OPTIONS.map((option) => option.value) as [
  (typeof PRIORITY_OPTIONS)[number]["value"],
  ...(typeof PRIORITY_OPTIONS)[number]["value"][],
];
const productValues = PRODUCT_OPTIONS.map((option) => option.value) as [
  (typeof PRODUCT_OPTIONS)[number]["value"],
  ...(typeof PRODUCT_OPTIONS)[number]["value"][],
];
const notificationChannelValues = NOTIFICATION_CHANNEL_OPTIONS.map((option) => option.value) as [
  (typeof NOTIFICATION_CHANNEL_OPTIONS)[number]["value"],
  ...(typeof NOTIFICATION_CHANNEL_OPTIONS)[number]["value"][],
];

const customContextKeyPattern = /^[a-zA-Z][a-zA-Z0-9_-]{1,31}$/;

const customContextEntrySchema = z.object({
  key: z.string().trim().max(32).optional().or(z.literal("")),
  value: z.string().trim().max(120).optional().or(z.literal("")),
});

function emptyToUndefined(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const sessionContextSchema = z
  .object({
    scenario: z.enum(verificationTypeValues),
    verificationType: z.enum(verificationTypeValues),
    referenceClient: z.string().trim().min(1).max(128),
    country: z.enum(countryValues).optional().or(z.literal("")),
    countryOther: z.string().trim().max(80).optional().or(z.literal("")),
    product: z.enum(productValues).optional().or(z.literal("")),
    productOther: z.string().trim().max(80).optional().or(z.literal("")),
    segment: z.enum(segmentValues).optional().or(z.literal("")),
    priority: z.enum(priorityValues).optional().or(z.literal("")),
    notificationEmail: z.string().trim().email().optional().or(z.literal("")),
    notificationPhone: z.string().trim().regex(/^\+[1-9]\d{5,14}$/).optional().or(z.literal("")),
    notificationChannel: z.enum(notificationChannelValues).optional().or(z.literal("")),
    customContextEntries: z.array(customContextEntrySchema).max(MAX_CUSTOM_CONTEXT_ENTRIES).default([]),
  })
  .superRefine((value, ctx) => {
    const country = emptyToUndefined(value.country);
    const countryOther = emptyToUndefined(value.countryOther);
    const product = emptyToUndefined(value.product);
    const productOther = emptyToUndefined(value.productOther);
    const notificationChannel = emptyToUndefined(value.notificationChannel);
    const notificationEmail = emptyToUndefined(value.notificationEmail);
    const notificationPhone = emptyToUndefined(value.notificationPhone);

    if (country === "OTHER" && !countryOther) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countryOther"],
        message: "Precisez le pays si vous choisissez Autre.",
      });
    }

    if (product === "other" && !productOther) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productOther"],
        message: "Precisez le produit si vous choisissez Autre.",
      });
    }

    if (notificationChannel === "sms" && !notificationPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notificationPhone"],
        message: "Un numero E.164 est requis pour le canal SMS.",
      });
    }

    if (notificationChannel === "email" && !notificationEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notificationEmail"],
        message: "Une adresse email est requise pour le canal Email.",
      });
    }

    if (notificationChannel === "push") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notificationChannel"],
        message: "Le canal Push n'est pas disponible dans cette demo.",
      });
    }

    const seenKeys = new Set<string>();

    value.customContextEntries.forEach((entry, index) => {
      const key = emptyToUndefined(entry.key);
      const entryValue = emptyToUndefined(entry.value);

      if (!key && !entryValue) {
        return;
      }

      if (!key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customContextEntries", index, "key"],
          message: "Ajoutez une cle pour cette option avancee.",
        });
      }

      if (!entryValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customContextEntries", index, "value"],
          message: "Ajoutez une valeur pour cette option avancee.",
        });
      }

      if (!key || !entryValue) {
        return;
      }

      const normalizedKey = key.toLowerCase();

      if (CUSTOM_CONTEXT_BLACKLIST.includes(normalizedKey as (typeof CUSTOM_CONTEXT_BLACKLIST)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customContextEntries", index, "key"],
          message: "Cette cle est reservee par l'application.",
        });
      }

      if (!customContextKeyPattern.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customContextEntries", index, "key"],
          message: "Utilisez une cle simple: lettres, chiffres, tirets ou underscores.",
        });
      }

      if (seenKeys.has(normalizedKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customContextEntries", index, "key"],
          message: "Cette cle est deja utilisee.",
        });
      }

      seenKeys.add(normalizedKey);
    });
  });

export type SessionContextInput = z.infer<typeof sessionContextSchema>;

export const defaultSessionContext: SessionContextInput = {
  scenario: "onboarding",
  verificationType: "onboarding",
  referenceClient: "",
  country: "",
  countryOther: "",
  product: "",
  productOther: "",
  segment: "",
  priority: "standard",
  notificationEmail: "",
  notificationPhone: "",
  notificationChannel: "",
  customContextEntries: [],
};

export function normalizeExternalId(referenceClient: string): string {
  return referenceClient.trim().replace(/\s+/g, "_");
}

function buildCustomContext(
  entries: SessionContextInput["customContextEntries"],
): Record<string, string> | undefined {
  const customContext = Object.fromEntries(
    entries.flatMap((entry) => {
      const key = emptyToUndefined(entry.key);
      const value = emptyToUndefined(entry.value);

      if (!key || !value) {
        return [];
      }

      return [[key, value]];
    }),
  );

  return Object.keys(customContext).length > 0 ? customContext : undefined;
}

export function buildSessionMetadata(input: SessionContextInput) {
  const country = emptyToUndefined(input.country);
  const countryOther = emptyToUndefined(input.countryOther);
  const product = emptyToUndefined(input.product);
  const productOther = emptyToUndefined(input.productOther);
  const segment = emptyToUndefined(input.segment);
  const priority = emptyToUndefined(input.priority);
  const notificationEmail = emptyToUndefined(input.notificationEmail);
  const notificationPhone = emptyToUndefined(input.notificationPhone);
  const notificationChannel = emptyToUndefined(input.notificationChannel);
  const customContext = buildCustomContext(input.customContextEntries);

  const businessContext: Record<string, string> = {
    customerId: input.referenceClient.trim(),
  };

  if (country && country !== "OTHER") {
    businessContext.country = country;
  }

  if (country === "OTHER" && countryOther) {
    businessContext.country = countryOther;
  }

  if (product) {
    businessContext.product = product === "other" ? (productOther ?? "other") : product;
  }

  if (segment) {
    businessContext.segment = segment;
  }

  const metadata: {
    metadataVersion: 1;
    businessContext: Record<string, string>;
    routingContext: Record<string, string>;
    notificationContext?: Record<string, string>;
    customContext?: Record<string, string>;
  } = {
    metadataVersion: 1,
    businessContext,
    routingContext: {
      journey: input.verificationType,
    },
  };

  if (priority) {
    metadata.routingContext.priority = priority;
  }

  const notificationContext: Record<string, string> = {};

  if (notificationEmail) {
    notificationContext.email = notificationEmail;
  }

  if (notificationPhone) {
    notificationContext.phone = notificationPhone;
  }

  if (notificationChannel) {
    notificationContext.preferredChannel = notificationChannel;
  }

  if (Object.keys(notificationContext).length > 0) {
    metadata.notificationContext = notificationContext;
  }

  if (customContext) {
    metadata.customContext = customContext;
  }

  return metadata;
}