import { z } from "zod";

/**
 * Input validation for every write path.
 *
 * The database enforces the same rules (see supabase/migrations) — this layer
 * exists so users get a helpful message instead of a Postgres error string.
 * Nothing from a form is trusted: role, ownership and moderation fields are
 * always set server-side.
 */

export const LANGUAGE = z.enum(["en", "te", "hi"]);
export const USER_ROLE = z.enum(["farmer", "seller", "buyer", "distributor", "machine_owner"]);
export const LISTING_KIND = z.enum(["produce", "input", "machinery", "service"]);
export const LISTING_STATUS = z.enum(["draft", "active", "sold", "archived"]);
export const SEASON = z.enum(["kharif", "rabi", "zaid", "perennial", "other"]);
export const CROP_STATUS = z.enum(["planned", "sown", "growing", "harvested", "failed"]);
export const MACHINE_TYPE = z.enum([
  "tractor",
  "harvester",
  "power_tiller",
  "sprayer",
  "seeder",
  "thresher",
  "rotavator",
  "trailer",
  "irrigation_pump",
  "other",
]);

const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "That password is too long.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{6,20}$/, "Enter a valid mobile number.")
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === "" ? undefined : value));

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password,
  confirmPassword: z.string(),
  fullName: z.string().trim().min(2, "Please enter your name.").max(120),
  phone: phoneSchema,
  village: optionalText(80),
  district: optionalText(80),
  state: optionalText(80),
  role: USER_ROLE,
  preferredLanguage: LANGUAGE,
  simpleMode: z.boolean(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "The two passwords do not match.",
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "That reset link is not valid."),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords do not match.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords do not match.",
  });

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter your name.").max(120),
  phone: phoneSchema,
  village: optionalText(80),
  district: optionalText(80),
  state: optionalText(80),
  bio: optionalText(400),
  preferred_language: LANGUAGE,
});

export const farmSchema = z.object({
  name: z.string().trim().min(2, "Give this farm a name.").max(120),
  size_acres: z.coerce.number().min(0).max(100000).optional(),
  soil_type: optionalText(80),
  irrigation_source: optionalText(80),
  village: optionalText(80),
  district: optionalText(80),
  state: optionalText(80),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "Enter a 6-digit PIN code.")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  is_primary: z.boolean().optional(),
  notes: optionalText(500),
});

export const cropRecordSchema = z.object({
  crop_name: z.string().trim().min(2, "Enter the crop name.").max(80),
  crop_id: z.string().uuid().optional().nullable(),
  farm_id: z.string().uuid().optional().nullable(),
  season: SEASON,
  variety: optionalText(80),
  area_acres: z.coerce.number().min(0).max(100000).optional(),
  sowing_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  expected_harvest_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  status: CROP_STATUS,
  notes: optionalText(500),
});

export const soilSchema = z
  .object({
    soil_type: optionalText(80),
    farm_id: z.string().uuid().optional().nullable(),
    ph: z.coerce.number().min(0, "pH is between 0 and 14.").max(14, "pH is between 0 and 14.").optional(),
    nitrogen: z.coerce.number().min(0).max(10000).optional(),
    phosphorus: z.coerce.number().min(0).max(10000).optional(),
    potassium: z.coerce.number().min(0).max(10000).optional(),
    moisture_pct: z.coerce.number().min(0).max(100).optional(),
    organic_matter_pct: z.coerce.number().min(0).max(100).optional(),
    electrical_conductivity: z.coerce.number().min(0).max(1000).optional(),
    source: z.enum(["manual", "lab_report", "dataset", "estimate"]),
    dataset_name: optionalText(120),
    dataset_reference: optionalText(300),
    measured_at: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
    village: optionalText(80),
    district: optionalText(80),
    state: optionalText(80),
    notes: optionalText(500),
  })
  .refine((data) => data.source !== "dataset" || Boolean(data.dataset_name), {
    path: ["dataset_name"],
    message: "Name the dataset this value came from.",
  });

export const listingSchema = z.object({
  kind: LISTING_KIND,
  title: z.string().trim().min(5, "Write a clear title.").max(140),
  description: optionalText(4000),
  crop_name: optionalText(80),
  category_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  quantity: z.coerce.number().min(0).max(1000000).optional(),
  unit: optionalText(20),
  price_per_unit: z.coerce.number().min(0).max(10000000).optional(),
  is_negotiable: z.boolean().optional(),
  min_order_quantity: z.coerce.number().min(0).max(1000000).optional(),
  village: optionalText(80),
  district: optionalText(80),
  state: optionalText(80),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  harvest_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  available_from: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  available_until: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  status: LISTING_STATUS.default("active"),
  contact_phone: phoneSchema,
});

export const machinerySchema = z.object({
  machine_type: MACHINE_TYPE,
  brand: optionalText(60),
  model: optionalText(60),
  manufacture_year: z.coerce.number().min(1950).max(2100).optional(),
  horsepower: z.coerce.number().min(0).max(2000).optional(),
  rental_price_per_day: z.coerce.number().min(0).max(1000000).optional(),
  rental_price_per_hour: z.coerce.number().min(0).max(1000000).optional(),
  rental_price_per_acre: z.coerce.number().min(0).max(1000000).optional(),
  with_operator: z.boolean().optional(),
  service_radius_km: z.coerce.number().min(0).max(2000).optional(),
  availability_start: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  availability_end: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  status: z.enum(["available", "booked", "maintenance", "inactive"]).default("available"),
  description: optionalText(1000),
});

export const messageSchema = z.object({
  conversationId: z.string().uuid("That conversation is not valid."),
  body: z.string().trim().min(1, "Write a message.").max(4000, "That message is too long."),
});

export const startConversationSchema = z.object({
  listingId: z.string().uuid("That listing is not valid."),
  message: z.string().trim().max(4000).optional(),
});

export const reportSchema = z.object({
  listingId: z.string().uuid("That listing is not valid."),
  reason: z.enum(["spam", "fake_listing", "wrong_price", "abusive", "prohibited_item", "other"]),
  details: optionalText(2000),
});

export const recommendationSchema = z.object({
  location: z.string().trim().min(2, "Enter your location.").max(120),
  season: z.enum(["kharif", "rabi", "zaid", "perennial"]),
  soil_type: optionalText(80),
  ph: z.coerce.number().min(0).max(14).optional(),
  water_availability: z.enum(["low", "medium", "high"]),
  farm_size_acres: z.coerce.number().min(0).max(100000).optional(),
  previous_crop: optionalText(80),
  preference: z.enum(["food", "cash", "pulse", "oilseed", "any"]),
  language: LANGUAGE,
  notes: optionalText(400),
});

export const assistantQuestionSchema = z.object({
  question: z.string().trim().min(3, "Please write your question.").max(1500, "Please shorten your question."),
  conversationId: z.string().uuid().optional(),
  language: LANGUAGE,
  farmId: z.string().uuid().optional(),
});

export const cropAnalysisFormSchema = z.object({
  cropName: optionalText(80),
  farmId: z.string().uuid().optional(),
  notes: optionalText(300),
});

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "Use lowercase letters, numbers and dashes."),
  name_en: z.string().trim().min(2, "Enter the English name.").max(60),
  name_te: optionalText(60),
  name_hi: optionalText(60),
  kind: LISTING_KIND,
  icon: optionalText(40),
  sort_order: z.coerce.number().min(0).max(9999).default(100),
  is_active: z.boolean().optional(),
});
