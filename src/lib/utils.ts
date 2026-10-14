// Adapted from beUI. Copyright (c) 2026 Saurabh Chauhan. MIT; see THIRD_PARTY_NOTICES.md.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
