"use server";

// Re-export the heavy Gemini action behind a tiny module so client components
// import a small surface (keeps the browser bundle lean and the boundary clear).
export { analyseCropImageAction as analyzeActionGuard } from "./ai";
export type { ActionState } from "@/lib/actions/state";
