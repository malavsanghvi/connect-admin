import type { Metadata } from "next";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Details, EmptyState, Field, FormGrid, LoadProblem, NoAccess, PageHeader, Select, TableWrap, Tabs, td, th } from "@/components/ui";
import { areas, can } from "@/lib/access";
import type { Tables } from "@/lib/database.types";
import { centsToDollarsInput, formatCents, formatDateTime, formatTime, humanize, toDateTimeLocal } from "@/lib/format";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { moveOrder, recordMovement, saveCategory, saveItem, saveWindow } from "./actions";

export const metadata: Metadata = { title: "Satvik Store" };

const TABS = ["orders", "menu", "windows", "inventory"] as const;
const NEXT_LABEL: Record<string, { to: string; label: string; cls: string }[]> = {
  placed: [{ to: "preparing", label: "Start preparing", cls: "btn btn-secondary" }],
  preparing: [{ to: "ready", label: "Ready for pickup", cls: "btn btn-success" }],
  ready: [{ to: "picked_up", label: "Picked up", cls: "btn btn-primary" }],
};

function ItemFields({ item, categories }: { item: Tables<"store_items"> | null; categories: { id: string; name: string }[] }) {
  return (
    <>
      <FormGrid>
        <Field label="Name">
          <input name="name" required defaultValue={item?.name ?? ""} className="field-input" />
        </Field>
        <Field label="Category">
          <Select name="category_id" defaultValue={item?.category_id ?? ""} placeholder="None" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="Price ($)">
          <input name="price" inputMode="decimal" required defaultValue={centsToDollarsInput(item?.price_cents)} className="field-input" />
        </Field>
        <Field label="Pack size">
          <input name="pack_size" defaultValue={item?.pack_size ?? ""} placeholder="e.g. 500 g" className="field-input" />
        </Field>
        <Field label="SKU">
          <input name="sku" defaultValue={item?.sku ?? ""} className="field-input" />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            defaultValue={item?.status ?? "active"}
            options={[
              { value: "active", label: "Active (on the menu)" },
              { value: "paused", label: "Paused" },
              { value: "retired", label: "Retired" },
            ]}
          />
        </Field>
        <Field label="Low-stock alert at">
          <input type="number" name="low_stock_threshold" min={0} defaultValue={item?.low_stock_threshold ?? ""} className="field-input" />
        </Field>
        <Field label="Description">
          <input name="description" defaultValue={item?.description ?? ""} className="field-input" />
        </Field>
      </FormGrid>
      <div className="flex flex-wrap gap-x-6">
        <Checkbox name="taxable" label="Taxable" defaultChecked={item?.taxable ?? true} />
        <Checkbox name="track_inventory" label="Track stock" defaultChecked={item?.track_inventory ?? false} />
      </div>
    </>
  );
}

export default async function StorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!areas.store(v.access)) return <NoAccess area="the Satvik Store" />;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? String(sp.tab) : "orders";
  const windowFilter = typeof sp.window === "string" ? sp.window : null;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const manage = can(v.access, "store.manage");

  const res = await load(async () => {
    const [categories, items, windows, events] = await Promise.all([
      supabase.from("store_categories").select("id, name, sort_order").eq("center_id", v.center.id).order("sort_order"),
      supabase.from("store_items").select("*").eq("center_id", v.center.id).order("name"),
      supabase.from("pickup_windows").select("*").eq("center_id", v.center.id).order("starts_at", { ascending: false }).limit(50),
      supabase.from("events").select("id, name").eq("center_id", v.center.id).order("starts_at", { ascending: false, nullsFirst: true }).limit(50),
    ]);
    const w = rows(windows, "pickup windows");
    let orders: Tables<"store_orders">[] = [];
    let lines: Tables<"store_order_lines">[] = [];
    let movements: Tables<"inventory_movements">[] = [];
    if (tab === "orders") {
      const selected = windowFilter ?? w.find((x) => x.status === "open")?.id ?? w[0]?.id ?? null;
      let q = supabase.from("store_orders").select("*").eq("center_id", v.center.id).neq("status", "cart").order("placed_at", { ascending: true }).limit(300);
      if (selected) q = q.eq("pickup_window_id", selected);
      orders = rows(await q, "orders");
      lines = orders.length ? rows(await supabase.from("store_order_lines").select("*").in("order_id", orders.map((o) => o.id)), "order lines") : [];
    }
    if (tab === "inventory") {
      movements = rows(await supabase.from("inventory_movements").select("*").eq("center_id", v.center.id).order("recorded_at", { ascending: false }).limit(100), "stock movements");
    }
    return { categories: rows(categories, "categories"), items: rows(items, "menu items"), windows: w, events: rows(events, "events"), orders, lines, movements };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { categories, items, windows, events, orders, lines, movements } = res.data;
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "Item";
  const selectedWindow = windowFilter ?? windows.find((x) => x.status === "open")?.id ?? windows[0]?.id ?? null;

  return (
    <>
      <PageHeader title="Satvik Store" description="Sales, not giving: menu, pickup windows, orders and stock." />
      <Tabs active={tab} tabs={TABS.map((t) => ({ key: t, label: humanize(t), href: `/store?tab=${t}` }))} />

      {tab === "orders" && (
        <>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="tab" value="orders" />
            <label className="block min-w-[16rem] flex-1">
              <span className="mb-1 block text-sm font-semibold">Pickup window</span>
              <select name="window" defaultValue={selectedWindow ?? ""} className="field-input">
                {windows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatDateTime(w.starts_at, tz)} {w.location ? `· ${w.location}` : ""} · {w.status}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-secondary">
              Show
            </button>
          </form>
          {orders.length === 0 ? (
            <EmptyState title="No orders for this window" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {(["placed", "preparing", "ready"] as const).map((status) => (
                <section key={status}>
                  <h2 className="mb-2 font-display text-lg font-semibold">
                    {humanize(status)} ({orders.filter((o) => o.status === status).length})
                  </h2>
                  <ul className="space-y-3">
                    {orders
                      .filter((o) => o.status === status)
                      .map((o) => (
                        <li key={o.id}>
                          <Card>
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold">#{o.order_number}</p>
                              <span className="font-semibold">{formatCents(o.total_cents)}</span>
                            </div>
                            <p className="text-xs text-muted">
                              {o.guest_name ?? "Member order"}
                              {o.placed_at ? ` · placed ${formatTime(o.placed_at, tz)}` : ""}
                            </p>
                            <ul className="mt-2 text-sm">
                              {lines
                                .filter((l) => l.order_id === o.id)
                                .map((l) => (
                                  <li key={l.id}>
                                    {l.quantity}× {itemName(l.item_id)}
                                    {l.is_gift ? " (gift pack)" : ""}
                                  </li>
                                ))}
                            </ul>
                            {o.gift_message && <p className="mt-1 text-xs italic">“{o.gift_message}”</p>}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(NEXT_LABEL[o.status] ?? []).map((n) => (
                                <ActionButton key={n.to} action={moveOrder.bind(null, o.id)} fields={{ to: n.to }} label={n.label} className={n.cls} />
                              ))}
                              {(o.status === "placed" || o.status === "preparing") && (
                                <ActionButton action={moveOrder.bind(null, o.id)} fields={{ to: "cancelled" }} label="Cancel" className="btn btn-danger" confirm={`Cancel order #${o.order_number}?`} />
                              )}
                            </div>
                          </Card>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {orders.some((o) => o.status === "picked_up" || o.status === "cancelled") && (
            <p className="mt-4 text-sm text-muted">
              Also in this window: {orders.filter((o) => o.status === "picked_up").length} picked up · {orders.filter((o) => o.status === "cancelled").length} cancelled.
            </p>
          )}
        </>
      )}

      {tab === "menu" && (
        <div className="space-y-6">
          {categories.map((c) => (
            <Card key={c.id} title={c.name}>
              <ItemList items={items.filter((i) => i.category_id === c.id)} categories={categories} manage={manage} />
            </Card>
          ))}
          {items.some((i) => !i.category_id) && (
            <Card title="No category">
              <ItemList items={items.filter((i) => !i.category_id)} categories={categories} manage={manage} />
            </Card>
          )}
          {manage && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Add an item">
                <ActionForm action={saveItem.bind(null, null)} submitLabel="Add item" resetOnSuccess>
                  <ItemFields item={null} categories={categories} />
                </ActionForm>
              </Card>
              <Card title="Add a category">
                <ActionForm action={saveCategory} submitLabel="Add category" resetOnSuccess>
                  <FormGrid>
                    <Field label="Name">
                      <input name="name" required className="field-input" />
                    </Field>
                    <Field label="Order">
                      <input name="sort_order" type="number" defaultValue={categories.length + 1} className="field-input" />
                    </Field>
                  </FormGrid>
                </ActionForm>
              </Card>
            </div>
          )}
        </div>
      )}

      {tab === "windows" && (
        <div className="space-y-6">
          <Card>
            {windows.length === 0 ? (
              <EmptyState title="No pickup windows" />
            ) : (
              <ul className="divide-y divide-line">
                {windows.map((w) => (
                  <li key={w.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {formatDateTime(w.starts_at, tz)} – {formatTime(w.ends_at, tz)}
                          {w.location ? ` · ${w.location}` : ""}
                        </p>
                        <p className="text-xs text-muted">
                          Order by {formatDateTime(w.order_cutoff_at, tz)} · {w.orders_count}
                          {w.capacity ? ` of ${w.capacity}` : ""} orders
                          {w.event_id ? ` · ${events.find((e) => e.id === w.event_id)?.name ?? "event"}` : ""}
                        </p>
                      </div>
                      <Badge tone={w.status === "open" ? "success" : "muted"}>{w.status}</Badge>
                    </div>
                    {manage && (
                      <div className="mt-2">
                        <Details summary="Edit window">
                          <WindowForm w={w} events={events} tz={tz} />
                        </Details>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {manage && (
            <Card title="New pickup window">
              <WindowForm w={null} events={events} tz={tz} />
            </Card>
          )}
        </div>
      )}

      {tab === "inventory" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Stock" className="lg:col-span-2">
            <TableWrap>
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    <th className={th}>Item</th>
                    <th className={th}>On hand</th>
                    <th className={th}>Recent changes</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter((i) => i.track_inventory)
                    .map((i) => {
                      const low = i.low_stock_threshold !== null && i.stock_on_hand <= i.low_stock_threshold;
                      return (
                        <tr key={i.id}>
                          <td className={td}>{i.name}</td>
                          <td className={td}>
                            <span className="font-semibold">{i.stock_on_hand}</span> {low && <Badge tone="warning">Low</Badge>}
                          </td>
                          <td className={td}>
                            {movements
                              .filter((m) => m.item_id === i.id)
                              .slice(0, 3)
                              .map((m) => `${m.delta > 0 ? "+" : ""}${m.delta} ${m.reason}`)
                              .join(" · ") || "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </TableWrap>
            {!items.some((i) => i.track_inventory) && <p className="text-sm text-muted">No items track stock. Turn on “Track stock” for an item on the Menu tab.</p>}
          </Card>
          {manage && (
            <Card title="Record a stock change">
              <ActionForm action={recordMovement} submitLabel="Record" resetOnSuccess>
                <div className="space-y-3">
                  <Field label="Item">
                    <Select name="item_id" required placeholder="Choose" options={items.filter((i) => i.track_inventory).map((i) => ({ value: i.id, label: i.name }))} />
                  </Field>
                  <Field label="Reason">
                    <Select
                      name="reason"
                      defaultValue="received"
                      options={[
                        { value: "received", label: "Received (add)" },
                        { value: "waste", label: "Waste (remove)" },
                        { value: "returned", label: "Returned (add)" },
                        { value: "adjustment", label: "Adjustment (+/−)" },
                      ]}
                    />
                  </Field>
                  <Field label="Quantity">
                    <input name="quantity" type="number" required className="field-input" />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function ItemList({ items, categories, manage }: { items: Tables<"store_items">[]; categories: { id: string; name: string }[]; manage: boolean }) {
  if (!items.length) return <p className="text-sm text-muted">No items.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => (
        <li key={i.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              <span className="font-semibold">{i.name}</span>
              {i.pack_size ? <span className="text-muted"> · {i.pack_size}</span> : null}
            </p>
            <span className="flex items-center gap-2">
              <span className="font-semibold">{formatCents(i.price_cents)}</span>
              <Badge tone={i.status === "active" ? "success" : "muted"}>{i.status}</Badge>
            </span>
          </div>
          {manage && (
            <div className="mt-2">
              <Details summary="Edit">
                <ActionForm action={saveItem.bind(null, i.id)} submitLabel="Save item">
                  <ItemFields item={i} categories={categories} />
                </ActionForm>
              </Details>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function WindowForm({ w, events, tz }: { w: Tables<"pickup_windows"> | null; events: { id: string; name: string }[]; tz: string }) {
  return (
    <ActionForm action={saveWindow.bind(null, w?.id ?? null)} submitLabel={w ? "Save window" : "Add window"} resetOnSuccess={!w}>
      <FormGrid>
        <Field label="Pickup starts">
          <input type="datetime-local" name="starts_at" required defaultValue={toDateTimeLocal(w?.starts_at, tz)} className="field-input" />
        </Field>
        <Field label="Pickup ends">
          <input type="datetime-local" name="ends_at" required defaultValue={toDateTimeLocal(w?.ends_at, tz)} className="field-input" />
        </Field>
        <Field label="Order cutoff">
          <input type="datetime-local" name="order_cutoff_at" required defaultValue={toDateTimeLocal(w?.order_cutoff_at, tz)} className="field-input" />
        </Field>
        <Field label="Capacity (orders)">
          <input type="number" name="capacity" min={1} defaultValue={w?.capacity ?? ""} className="field-input" />
        </Field>
        <Field label="Location">
          <input name="location" defaultValue={w?.location ?? ""} className="field-input" />
        </Field>
        <Field label="Event">
          <Select name="event_id" defaultValue={w?.event_id ?? ""} placeholder="None" options={events.map((e) => ({ value: e.id, label: e.name }))} />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            defaultValue={w?.status ?? "open"}
            options={[
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
              { value: "fulfilled", label: "Fulfilled" },
            ]}
          />
        </Field>
      </FormGrid>
    </ActionForm>
  );
}
