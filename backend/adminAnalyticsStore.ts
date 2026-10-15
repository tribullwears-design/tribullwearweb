import { getDashboardMetrics, getDashboardRangeBounds, type DashboardMetrics, type DashboardOrder, type DashboardRange } from "../shared/adminAnalytics.js";
import { getDatabase } from "./database.js";

export function isDashboardRange(value: unknown): value is DashboardRange {
  return value === "Today" || value === "Yesterday" || value === "Last 7 days" || value === "Last 30 days";
}

export async function getAdminAnalytics(range: DashboardRange, now = new Date()): Promise<DashboardMetrics> {
  const { start, end } = getDashboardRangeBounds(range, now);
  const orders = await (await getDatabase()).collection<DashboardOrder>("orders")
    .find(
      { createdAt: { $gte: start.toISOString(), $lte: end.toISOString() } },
      { projection: { _id: 0, id: 1, createdAt: 1, status: 1, total: 1, payment: 1, paymentMode: 1, "customer.email": 1, items: 1 } },
    )
    .toArray();
  return getDashboardMetrics(orders, range, now);
}
