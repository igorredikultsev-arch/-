"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { BookingError, cancelByClient } from "@/lib/booking";
import { cancelledMessage, notifyBusiness } from "@/lib/push";

export async function cancelAction(token: string, _prev: string | null): Promise<string | null> {
  try {
    const b = await cancelByClient(token);
    if (b.business.status !== "demo") after(() => notifyBusiness(b.businessId, cancelledMessage(b, b.business.timezone)).then(() => {}));
  } catch (e) {
    if (e instanceof BookingError) return e.message;
    throw e;
  }
  revalidatePath("/s/[slug]/b/[token]", "page");
  return null;
}
