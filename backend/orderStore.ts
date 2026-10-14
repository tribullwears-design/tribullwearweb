import { type Collection } from "mongodb";
import { getDatabase } from "./database.js";

export const orderStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"] as const;
export type OrderStatus = typeof orderStatuses[number];

export type OrderItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  variant?: string;
  lineTotal: number;
};

export type OrderDocument = {
  id: string;
  customer: { name: string; email: string; phone: string };
  shippingAddress: { address: string; apartment: string; city: string; state: string; pinCode: string; country: string };
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  payment: { method: string; status: string };
  status: OrderStatus;
  createdAt: string;
};

async function getCollection(): Promise<Collection<OrderDocument>> {
  const db = await getDatabase();
  const collection = db.collection<OrderDocument>("orders");
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ status: 1, createdAt: -1 });
  return collection;
}

export async function listOrders(status?: string) {
  const collection = await getCollection();
  const filter = status && orderStatuses.includes(status as OrderStatus) ? { status: status as OrderStatus } : {};
  return collection.find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
}

export async function createOrder(order: Omit<OrderDocument, "createdAt" | "status"> & { status?: OrderStatus }) {
  const collection = await getCollection();
  if (!order.id || !order.customer?.name || !order.customer?.email || !order.items?.length) throw new Error("Order details are incomplete");
  const document: OrderDocument = { ...order, status: order.status || "Pending", createdAt: new Date().toISOString() };
  await collection.insertOne(document);
  return document;
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const collection = await getCollection();
  return collection.findOneAndUpdate({ id }, { $set: { status } }, { returnDocument: "after", projection: { _id: 0 } });
}
