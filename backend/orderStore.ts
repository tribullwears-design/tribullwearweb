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
  originalPrice?: number;
};

export type OrderDocument = {
  id: string;
  customerId?: string;
  customer: { name: string; email: string; phone: string };
  shippingAddress: {
    address: string;
    apartment: string;
    city: string;
    state: string;
    pinCode: string;
    country: string;
    recipientName?: string;
    phone?: string;
  };
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  couponCode?: string;
  total: number;
  payment: { method: string; status: string };
  paymentMode?: "test" | "razorpay" | "cod";
  idempotencyKey?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: OrderStatus;
  createdAt: string;
  statusUpdatedAt?: string;
};

let indexesPromise: Promise<void> | undefined;

async function getCollection(): Promise<Collection<OrderDocument>> {
  const db = await getDatabase();
  const collection = db.collection<OrderDocument>("orders");
  indexesPromise ||= Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true }),
    collection.createIndex({ status: 1, createdAt: -1 }),
    collection.createIndex({ customerId: 1, createdAt: -1 }),
  ]).then(() => undefined).catch((error: unknown) => {
    indexesPromise = undefined;
    throw error;
  });
  await indexesPromise;
  return collection;
}

export async function listOrders(status?: string) {
  const collection = await getCollection();
  const filter = status && orderStatuses.includes(status as OrderStatus) ? { status: status as OrderStatus } : {};
  return collection.find(filter, { projection: { _id: 0, customerId: 0 } }).sort({ createdAt: -1 }).toArray();
}

export async function listCustomerOrders(customerId: string, page = 1, limit = 20) {
  const collection = await getCollection();
  const filter = { customerId };
  const total = await collection.countDocuments(filter);
  const orders = await collection.find(filter, { projection: { _id: 0, customerId: 0 } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();
  return { orders, total, page, limit };
}

export async function createOrder(order: Omit<OrderDocument, "createdAt" | "status"> & { status?: OrderStatus }) {
  const collection = await getCollection();
  if (!order.id || !order.customer?.name || !order.customer?.email || !order.items?.length) throw new Error("Order details are incomplete");
  const document: OrderDocument = { ...order, status: order.status || "Pending", createdAt: new Date().toISOString() };
  await collection.insertOne(document);
  return document;
}

export async function findOrderByIdempotencyKey(idempotencyKey: string) {
  return (await getCollection()).findOne({ idempotencyKey }, { projection: { _id: 0 } });
}

export async function findOrderByRazorpayOrderId(razorpayOrderId: string) {
  return (await getCollection()).findOne({ razorpayOrderId }, { projection: { _id: 0 } });
}

export async function updateRazorpayPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  paymentStatus: "Authorized" | "Paid" | "Failed",
  paymentMethod?: string,
) {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    {
      razorpayOrderId,
      $or: [
        { "payment.status": "Pending" },
        { "payment.status": "Authorized", razorpayPaymentId },
      ],
    },
    {
      $set: {
        "payment.status": paymentStatus,
        razorpayPaymentId,
        ...(paymentMethod ? { "payment.method": paymentMethod } : {}),
      },
    },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  return result;
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const collection = await getCollection();
  return collection.findOneAndUpdate(
    { id },
    { $set: { status, statusUpdatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
}
