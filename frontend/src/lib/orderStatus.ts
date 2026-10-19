export type OrderStatusTone = "placed" | "processing" | "shipped" | "delivered" | "cancelled" | "unknown";

export type OrderStatusDisplay = {
  label: string;
  tone: OrderStatusTone;
  progressStatus: "Order Placed" | "Processing" | "Shipped" | "Delivered" | null;
};

export function getOrderStatusDisplay(status: string | null | undefined): OrderStatusDisplay {
  switch (status?.trim().toLowerCase()) {
    case "pending":
    case "order placed":
      return { label: "Order Placed", tone: "placed", progressStatus: "Order Placed" };
    case "processing":
      return { label: "Processing", tone: "processing", progressStatus: "Processing" };
    case "shipped":
      return { label: "Shipped", tone: "shipped", progressStatus: "Shipped" };
    case "delivered":
      return { label: "Delivered", tone: "delivered", progressStatus: "Delivered" };
    case "cancelled":
    case "canceled":
      return { label: "Cancelled", tone: "cancelled", progressStatus: null };
    default:
      return { label: "Status unavailable", tone: "unknown", progressStatus: null };
  }
}
