"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/access";
import { actionContext } from "@/lib/action-context";
import type { TablesUpdate } from "@/lib/database.types";
import { bool, cents, dateTime, FormError, int, must, oneOf, reqStr, runAction, str } from "@/lib/forms";
import { ok, type ActionResult } from "@/lib/result";

const manage = (a: Parameters<typeof can>[0]) => can(a, "store.manage");

// Order status moves forward one step at a time (or is cancelled).
const NEXT: Record<string, string[]> = {
  placed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["picked_up"],
};

export async function moveOrder(orderId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("store.moveOrder", "update the order", async () => {
    const { supabase, viewer } = await actionContext((a) => can(a, "store.manage", "store.pickup"), "Only store volunteers can update orders.");
    const to = oneOf(fd, "to", ["preparing", "ready", "picked_up", "cancelled"] as const, "Status");
    const order = must(await supabase.from("store_orders").select("status").eq("id", orderId).maybeSingle(), "load the order");
    if (!order) throw new FormError("That order no longer exists or you can't see it.");
    if (!(NEXT[order.status] ?? []).includes(to)) {
      throw new FormError(`This order is ${order.status.replace("_", " ")}; it can't move to ${to.replace("_", " ")}. Refresh to see the latest.`);
    }
    const now = new Date().toISOString();
    const patch: TablesUpdate<"store_orders"> = { status: to };
    if (to === "ready") patch.ready_at = now;
    if (to === "picked_up") {
      patch.picked_up_at = now;
      patch.picked_up_by = viewer.userId;
    }
    if (to === "cancelled") patch.cancelled_at = now;
    const res = must(await supabase.from("store_orders").update(patch).eq("id", orderId).eq("status", order.status).select("id"), "update the order");
    if (!res?.length) throw new FormError("Someone else just changed this order. Refresh to see the latest.");
    refresh();
    return ok(`Order ${to.replace("_", " ")}.`);
  });
}

export async function saveCategory(fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("store.saveCategory", "add the category", async () => {
    const { supabase, centerId } = await actionContext(manage, "Only the store lead can change the menu.");
    must(
      await supabase.from("store_categories").insert({ center_id: centerId, name: reqStr(fd, "name", "Category"), sort_order: int(fd, "sort_order", "Order") ?? 0 }),
      "add the category",
    );
    refresh();
    return ok("Category added.");
  });
}

export async function saveItem(itemId: string | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("store.saveItem", "save the item", async () => {
    const { supabase, centerId } = await actionContext(manage, "Only the store lead can change the menu.");
    const price = cents(fd, "price", "Price");
    if (price === null) throw new FormError("Price is required.");
    const values = {
      name: reqStr(fd, "name", "Item name"),
      category_id: str(fd, "category_id"),
      sku: str(fd, "sku"),
      description: str(fd, "description"),
      price_cents: price,
      pack_size: str(fd, "pack_size"),
      taxable: bool(fd, "taxable"),
      track_inventory: bool(fd, "track_inventory"),
      low_stock_threshold: int(fd, "low_stock_threshold", "Low-stock alert", { min: 0 }),
      status: oneOf(fd, "status", ["active", "paused", "retired"] as const, "Status", "active"),
    };
    if (itemId) must(await supabase.from("store_items").update(values).eq("id", itemId), "save the item");
    else must(await supabase.from("store_items").insert({ ...values, center_id: centerId }), "add the item");
    refresh();
    return ok(itemId ? "Item saved." : "Item added.");
  });
}

export async function saveWindow(windowId: string | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("store.saveWindow", "save the pickup window", async () => {
    const { supabase, centerId, tz } = await actionContext(manage, "Only the store lead can set pickup windows.");
    const starts = dateTime(fd, "starts_at", "Pickup starts", tz);
    const ends = dateTime(fd, "ends_at", "Pickup ends", tz);
    const cutoff = dateTime(fd, "order_cutoff_at", "Order cutoff", tz);
    if (!starts || !ends || !cutoff) throw new FormError("Pickup start, end and order cutoff are required.");
    if (ends <= starts) throw new FormError("Pickup must end after it starts.");
    if (cutoff > starts) throw new FormError("The order cutoff must be before pickup starts.");
    const values = {
      starts_at: starts,
      ends_at: ends,
      order_cutoff_at: cutoff,
      capacity: int(fd, "capacity", "Capacity", { min: 1 }),
      location: str(fd, "location"),
      event_id: str(fd, "event_id"),
      status: oneOf(fd, "status", ["open", "closed", "fulfilled"] as const, "Status", "open"),
    };
    if (windowId) must(await supabase.from("pickup_windows").update(values).eq("id", windowId), "save the pickup window");
    else must(await supabase.from("pickup_windows").insert({ ...values, center_id: centerId }), "add the pickup window");
    refresh();
    return ok(windowId ? "Window saved." : "Window added.");
  });
}

/**
 * Record a stock movement and keep stock_on_hand in step. The schema has no
 * trigger for this, so it is two writes; if the second fails we say so.
 */
export async function recordMovement(fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("store.recordMovement", "record the stock change", async () => {
    const { supabase, centerId, viewer } = await actionContext(manage, "Only the store lead can record stock.");
    const itemId = reqStr(fd, "item_id", "Item");
    const reason = oneOf(fd, "reason", ["received", "waste", "adjustment", "returned"] as const, "Reason");
    let delta = int(fd, "quantity", "Quantity");
    if (!delta) throw new FormError("Enter a quantity other than zero.");
    if (reason === "waste" && delta > 0) delta = -delta;
    if ((reason === "received" || reason === "returned") && delta < 0) delta = -delta;
    const item = must(await supabase.from("store_items").select("stock_on_hand").eq("id", itemId).maybeSingle(), "load the item");
    if (!item) throw new FormError("That item no longer exists.");
    must(
      await supabase.from("inventory_movements").insert({ center_id: centerId, item_id: itemId, delta, reason, recorded_by: viewer.userId }),
      "record the stock change",
    );
    const upd = await supabase.from("store_items").update({ stock_on_hand: item.stock_on_hand + delta }).eq("id", itemId);
    if (upd.error) {
      console.error("[store] movement recorded but stock count not updated", upd.error);
      throw new FormError("The movement was recorded, but the item's stock count couldn't be updated. Adjust it on the item.");
    }
    refresh();
    return ok(`Stock ${delta > 0 ? "+" : ""}${delta}. Now ${item.stock_on_hand + delta}.`);
  });
}
