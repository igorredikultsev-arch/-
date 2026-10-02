"use server";

import { revalidatePath } from "next/cache";
import { BookingError, cancelByClient } from "@/lib/booking";

export async function cancelAction(token: string, _prev: string | null): Promise<string | null> {
  try {
    await cancelByClient(token);
  } catch (e) {
    if (e instanceof BookingError) return e.message;
    throw e;
  }
  revalidatePath("/s/[slug]/b/[token]", "page");
  return null;
}
