/**
 * Database row types shared by both backends (Supabase and the local runtime).
 * These mirror `supabase/migrations/*.sql` exactly.
 */

export type UserRole =
  | "farmer"
  | "seller"
  | "buyer"
  | "distributor"
  | "machine_owner"
  | "admin";

export const USER_ROLES: UserRole[] = [
  "farmer",
  "seller",
  "buyer",
  "distributor",
  "machine_owner",
  "admin",
];

/** Roles a user may pick for themselves at signup (admin is never self-assigned). */
export const SELF_ASSIGNABLE_ROLES: Exclude<UserRole, "admin">[] = [
  "farmer",
  "seller",
  "buyer",
  "distributor",
  "machine_owner",
];

export type Language = "en" | "te" | "hi";
export const LANGUAGES: Language[] = ["en", "te", "hi"];

export type ListingKind = "produce" | "input" | "machinery" | "service";
export type ListingStatus = "draft" | "active" | "sold" | "archived" | "removed";
export type CategoryKind = ListingKind;

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  preferred_language: Language;
  role: UserRole;
  avatar_url: string | null;
  bio: string | null;
  simple_mode: boolean;
  is_blocked: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Projection returned by the `public_profiles` view (never email/phone). */
export interface PublicProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  role: UserRole;
  bio: string | null;
  created_at: string;
}

export interface Farm {
  id: string;
  user_id: string;
  name: string;
  size_acres: number | string | null;
  soil_type: string | null;
  irrigation_source: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Crop {
  id: string;
  slug: string;
  name_en: string;
  name_te: string | null;
  name_hi: string | null;
  category: string | null;
  seasons: string[];
  duration_days: number | null;
  water_need: string | null;
  soil_types: string[];
  sowing_months: number[];
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CropRecord {
  id: string;
  user_id: string;
  farm_id: string | null;
  crop_id: string | null;
  crop_name: string;
  season: "kharif" | "rabi" | "zaid" | "perennial" | "other";
  variety: string | null;
  area_acres: number | string | null;
  sowing_date: string | null;
  expected_harvest_date: string | null;
  actual_harvest_date: string | null;
  status: "planned" | "sown" | "growing" | "harvested" | "failed";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoilRecord {
  id: string;
  user_id: string;
  farm_id: string | null;
  soil_type: string | null;
  ph: number | string | null;
  nitrogen: number | string | null;
  phosphorus: number | string | null;
  potassium: number | string | null;
  moisture_pct: number | string | null;
  organic_matter_pct: number | string | null;
  electrical_conductivity: number | string | null;
  source: "manual" | "lab_report" | "dataset" | "estimate";
  dataset_name: string | null;
  dataset_reference: string | null;
  measured_at: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeatherRecord {
  id: string;
  user_id: string | null;
  farm_id: string | null;
  latitude: number;
  longitude: number;
  observed_at: string;
  temperature_c: number | string | null;
  humidity_pct: number | string | null;
  wind_kph: number | string | null;
  wind_direction_deg: number | null;
  rain_probability_pct: number | string | null;
  precipitation_mm: number | string | null;
  condition_code: string | null;
  condition_text: string | null;
  source: string;
  alerts: unknown;
  raw: unknown;
  created_at: string;
}

export interface MarketPrice {
  id: string;
  crop_name: string;
  variety: string | null;
  market_name: string;
  district: string | null;
  state: string | null;
  price_per_quintal: number | string;
  min_price: number | string | null;
  max_price: number | string | null;
  unit: string;
  price_date: string;
  source: string;
  source_url: string | null;
  is_verified: boolean;
  imported_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_te: string | null;
  name_hi: string | null;
  kind: CategoryKind;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  kind: ListingKind;
  category_id: string | null;
  title: string;
  description: string | null;
  crop_name: string | null;
  quantity: number | string | null;
  unit: string | null;
  price_per_unit: number | string | null;
  is_negotiable: boolean;
  min_order_quantity: number | string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  harvest_date: string | null;
  available_from: string | null;
  available_until: string | null;
  status: ListingStatus;
  is_featured: boolean;
  views_count: number;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  url: string;
  storage_path: string | null;
  alt: string | null;
  sort_order: number;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
}

export type MachineType =
  | "tractor"
  | "harvester"
  | "power_tiller"
  | "sprayer"
  | "seeder"
  | "thresher"
  | "rotavator"
  | "trailer"
  | "irrigation_pump"
  | "other";

export interface Machinery {
  id: string;
  owner_id: string;
  listing_id: string;
  machine_type: MachineType;
  brand: string | null;
  model: string | null;
  manufacture_year: number | null;
  horsepower: number | string | null;
  rental_price_per_day: number | string | null;
  rental_price_per_hour: number | string | null;
  rental_price_per_acre: number | string | null;
  with_operator: boolean;
  service_radius_km: number | string | null;
  availability_start: string | null;
  availability_end: string | null;
  status: "available" | "booked" | "maintenance" | "inactive";
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  listing_id: string | null;
  buyer_id: string;
  seller_id: string;
  subject: string | null;
  last_message_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "weather_alert" | "marketplace" | "message" | "listing" | "reminder" | "system" | "admin";
  title: string;
  body: string | null;
  link: string | null;
  severity: "info" | "success" | "warning" | "critical";
  is_read: boolean;
  dedupe_key: string | null;
  created_at: string;
  read_at: string | null;
}

export interface Report {
  id: string;
  reporter_id: string;
  listing_id: string | null;
  reported_user_id: string | null;
  reason: "spam" | "fake_listing" | "wrong_price" | "abusive" | "prohibited_item" | "other";
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiConversation {
  id: string;
  user_id: string;
  farm_id: string | null;
  title: string;
  language: Language;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface CropAnalysis {
  id: string;
  user_id: string;
  farm_id: string | null;
  crop_record_id: string | null;
  crop_name: string | null;
  image_url: string | null;
  storage_path: string | null;
  status: "pending" | "completed" | "failed";
  possible_problem: string | null;
  severity: "low" | "moderate" | "high" | "unknown" | null;
  confidence: "low" | "medium" | "high" | null;
  visible_symptoms: unknown;
  next_steps: unknown;
  prevention: unknown;
  uncertainty_note: string | null;
  model: string | null;
  raw: unknown;
  error_message: string | null;
  created_at: string;
}

export interface UsageEvent {
  id: string;
  user_id: string;
  kind: "ai_chat" | "ai_vision" | "ai_recommendation" | "weather_fetch" | "soil_lookup";
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  meta: unknown;
  created_at: string;
}

export interface MarketPriceImport {
  id: string;
  imported_by: string | null;
  source: string;
  source_url: string | null;
  price_date: string | null;
  row_count: number;
  status: "success" | "partial" | "failed";
  message: string | null;
  created_at: string;
}

/** Convenience alias used across the UI layer. */
export interface ListingWithRelations extends Listing {
  category?: Category | null;
  images?: ListingImage[];
  machinery?: Machinery | null;
  seller?: PublicProfile | null;
  is_favorite?: boolean;
}
