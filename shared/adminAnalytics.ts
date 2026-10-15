export type DashboardOrder = {
  id: string;
  createdAt: string;
  status: string;
  total: number;
  payment: { status: string };
  paymentMode?: string;
  customer: { email: string };
  items: { id: string; name: string; quantity: number; lineTotal: number }[];
};

export type DashboardRange = "Today" | "Yesterday" | "Last 7 days" | "Last 30 days";

export type DashboardMetrics = {
  orderCount: number;
  pendingOrders: number;
  customerCount: number;
  verifiedSales: number;
  salesByDay: { date: string; label: string; revenue: number; orders: number }[];
  bestSellers: { id: string; name: string; quantity: number; revenue: number }[];
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDashboardRangeBounds(range: DashboardRange, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "Yesterday") start.setDate(start.getDate() - 1);
  else if (range === "Last 7 days") start.setDate(start.getDate() - 6);
  else if (range === "Last 30 days") start.setDate(start.getDate() - 29);
  const end = range === "Yesterday" ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getDashboardMetrics(
  orders: DashboardOrder[],
  range: DashboardRange,
  now = new Date(),
): DashboardMetrics {
  const { start, end } = getDashboardRangeBounds(range, now);
  const days = range === "Today" || range === "Yesterday" ? 1 : range === "Last 7 days" ? 7 : 30;
  const salesByDay = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return {
      date: localDateKey(date),
      label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      revenue: 0,
      orders: 0,
    };
  });
  const bucketByDate = new Map(salesByDay.map((bucket) => [bucket.date, bucket]));
  const includedOrders = orders.filter((order) => {
    const created = new Date(order.createdAt);
    return Number.isFinite(created.getTime()) && created >= start && created <= end;
  });
  const paidOrders = includedOrders.filter((order) =>
    order.paymentMode !== "test"
    && order.status !== "Cancelled"
    && order.payment.status.trim().toLowerCase() === "paid",
  );
  const products = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();

  for (const order of includedOrders) {
    const bucket = bucketByDate.get(localDateKey(new Date(order.createdAt)));
    if (bucket) bucket.orders += 1;
  }
  for (const order of paidOrders) {
    const bucket = bucketByDate.get(localDateKey(new Date(order.createdAt)));
    if (bucket) bucket.revenue += order.total;
    for (const item of order.items) {
      const product = products.get(item.id) || { id: item.id, name: item.name, quantity: 0, revenue: 0 };
      product.quantity += item.quantity;
      product.revenue += item.lineTotal;
      products.set(item.id, product);
    }
  }

  return {
    orderCount: includedOrders.length,
    pendingOrders: includedOrders.filter((order) => order.status === "Pending").length,
    customerCount: new Set(includedOrders.map((order) => order.customer.email.trim().toLowerCase()).filter(Boolean)).size,
    verifiedSales: paidOrders.reduce((sum, order) => sum + order.total, 0),
    salesByDay,
    bestSellers: Array.from(products.values()).sort((left, right) =>
      right.quantity - left.quantity || right.revenue - left.revenue || left.name.localeCompare(right.name),
    ).slice(0, 5),
  };
}
