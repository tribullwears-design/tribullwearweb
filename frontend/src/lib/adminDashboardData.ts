export { getDashboardMetrics } from "../../../shared/adminAnalytics";
export type { DashboardMetrics, DashboardOrder, DashboardRange } from "../../../shared/adminAnalytics";

export type OrderSearchRecord = {
  id: string;
  createdAt: string;
  status: string;
  payment: { status: string; method?: string };
  customer: { name: string; email: string; phone: string };
  items: { name: string; id: string }[];
};

export function paginate<T>(items: T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, totalPages, totalItems: items.length };
}

export function filterOrders<T extends OrderSearchRecord>(
  orders: T[],
  query: string,
  status: string,
  dateRange: "All time" | "Last 7 days" | "Last 30 days",
  now = Date.now(),
) {
  const normalizedQuery = query.trim().toLowerCase();
  const cutoff = dateRange === "All time"
    ? 0
    : now - (dateRange === "Last 7 days" ? 7 : 30) * 24 * 60 * 60 * 1000;

  return orders.filter((order) => {
    const createdAt = Date.parse(order.createdAt);
    const matchesStatus = !status || order.status.toLowerCase() === status.toLowerCase();
    const matchesDate = cutoff === 0 || (Number.isFinite(createdAt) && createdAt >= cutoff);
    const matchesSearch = !normalizedQuery || [
      order.id,
      order.customer.name,
      order.customer.email,
      order.customer.phone,
      order.status,
      order.payment.status,
      order.payment.method || "",
      ...order.items.flatMap((item) => [item.id, item.name]),
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesStatus && matchesDate && matchesSearch;
  });
}
