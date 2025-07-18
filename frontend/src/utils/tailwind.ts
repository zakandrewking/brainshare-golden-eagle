import { type ClassValue, clsx } from "clsx";
import { customAlphabet } from "nanoid";
import { twMerge } from "tailwind-merge";

export const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  10
); // 10-character random string

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
