/* This is where merging with aria components can happen but tried that and it sucked. Don't try to use both radix and aria at the same time*/
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
