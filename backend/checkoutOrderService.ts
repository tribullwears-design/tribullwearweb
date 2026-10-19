import { randomUUID } from "node:crypto";
import { isValidCustomerEmail, isValidCustomerMobile, normalizeCustomerEmail } from "./authStore.js";
import { listCategories } from "./categoryStore.js";
import { getProduct } from "./productStore.js";
import type { OrderDocument, OrderItem } from "./orderStore.js";
import { isIndianState, normalizeIndianState } from "../shared/checkout.js";
import { findCustomerAddress } from "./customerDataStore.js";
import { calculateOfferDiscount, findActiveCoupon } from "./marketingStore.js";

export class CheckoutValidationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

type CheckoutRequest = {
  idempotencyKey: string;
  customerId?: string;
  customer: OrderDocument["customer"];
  shippingAddress: OrderDocument["shippingAddress"];
  items: Array<{ id: string; quantity: number; variant?: { size?: string; color?: string } }>;
  couponCode?: string;
};

export async function prepareCheckoutOrder(
  input: unknown,
  identity?: { id: string; email: string },
): Promise<CheckoutRequest & { orderItems: OrderItem[]; subtotal: number; discount: number; total: number }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CheckoutValidationError("Checkout details are required");
  const body = input as Record<string, unknown>;
  const { idempotencyKey, customer, shippingAddress, items, savedAddressId, couponCode } = body;

  if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) {
    throw new CheckoutValidationError("A valid checkout request key is required");
  }
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) {
    throw new CheckoutValidationError("Enter a valid name, email address, and mobile number");
  }
  const customerInput = customer as Record<string, unknown>;
  let savedAddress: Awaited<ReturnType<typeof findCustomerAddress>> = null;
  if (savedAddressId !== undefined) {
    if (!identity || typeof savedAddressId !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(savedAddressId)) {
      throw new CheckoutValidationError("Sign in and choose one of your saved addresses", 401);
    }
    savedAddress = await findCustomerAddress(identity.id, savedAddressId);
    if (!savedAddress) throw new CheckoutValidationError("The selected saved address was not found", 404);
  }
  const checkoutName = savedAddress?.fullName || customerInput.name;
  const checkoutEmail = identity?.email || customerInput.email;
  const checkoutPhone = savedAddress?.phone || customerInput.phone;
  if (typeof checkoutName !== "string" || checkoutName.trim().length < 2 || checkoutName.trim().length > 80
    || typeof checkoutEmail !== "string" || !isValidCustomerEmail(normalizeCustomerEmail(checkoutEmail))
    || typeof checkoutPhone !== "string" || !isValidCustomerMobile(checkoutPhone)) {
    throw new CheckoutValidationError("Enter a valid name, email address, and mobile number");
  }
  if (!shippingAddress || typeof shippingAddress !== "object" || Array.isArray(shippingAddress)) {
    throw new CheckoutValidationError("Enter a complete Indian delivery address with a valid 6-digit PIN code");
  }
  const address: Record<string, unknown> = savedAddress
    ? { ...savedAddress, apartment: savedAddress.apartment || "", country: "India" }
    : shippingAddress as Record<string, unknown>;
  if (typeof address.address !== "string" || address.address.trim().length < 5
    || typeof address.apartment !== "string" || typeof address.city !== "string" || !address.city.trim()
    || !isIndianState(address.state)
    || typeof address.pinCode !== "string" || !/^\d{6}$/.test(address.pinCode)
    || address.country !== "India") {
    throw new CheckoutValidationError("Enter a complete Indian delivery address with a valid 6-digit PIN code");
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    throw new CheckoutValidationError("The cart must contain between 1 and 50 items");
  }

  const categories = await listCategories();
  const orderItems: OrderItem[] = [];
  const requestedByProduct = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new CheckoutValidationError("Cart contains an invalid product or quantity");
    const requested = item as Record<string, unknown>;
    if (typeof requested.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(requested.id)
      || !Number.isInteger(requested.quantity) || (requested.quantity as number) < 1 || (requested.quantity as number) > 99
      || (requested.variant !== undefined && (!requested.variant || typeof requested.variant !== "object" || Array.isArray(requested.variant)))) {
      throw new CheckoutValidationError("Cart contains an invalid product or quantity");
    }

    const product = await getProduct(requested.id);
    if (!product) throw new CheckoutValidationError(`Product ${requested.id} was not found`, 404);
    if (product.status !== "Active") throw new CheckoutValidationError(`${product.name} is not currently available`, 409);
    const category = categories.find((entry) => entry.value === product.mainCategoryId);
    const subcategory = category?.subcategories.find((entry) => entry.value === product.subcategoryId);
    if (!category || category.isVisible === false || !subcategory || subcategory.isVisible === false) {
      throw new CheckoutValidationError(`${product.name} is no longer available`, 409);
    }
    const variant = requested.variant as Record<string, unknown> | undefined;
    const size = variant?.size;
    const color = variant?.color;
    if (size !== undefined && (typeof size !== "string" || !product.sizes.includes(size))) {
      throw new CheckoutValidationError(`The selected size for ${product.name} is not available`);
    }
    if (product.sizes.length > 0 && !size) throw new CheckoutValidationError(`Select a size for ${product.name}`);
    if (color !== undefined && (typeof color !== "string" || !product.colors.some((entry) => entry.toLowerCase() === color.toLowerCase()))) {
      throw new CheckoutValidationError(`The selected colour for ${product.name} is not available`);
    }
    if (product.colors.length > 0 && !color) throw new CheckoutValidationError(`Select a colour for ${product.name}`);

    const quantity = requested.quantity as number;
    const requestedQuantity = (requestedByProduct.get(product.id) || 0) + quantity;
    requestedByProduct.set(product.id, requestedQuantity);
    if (requestedQuantity > product.stock) throw new CheckoutValidationError(`Only ${product.stock} units of ${product.name} are available`, 409);

    const variantLabel = [size ? `Size: ${size}` : "", color ? `Colour: ${color}` : ""].filter(Boolean).join(" / ");
    orderItems.push({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.compareAt ?? undefined,
      image: product.image,
      quantity,
      ...(variantLabel ? { variant: variantLabel } : {}),
      lineTotal: product.price * quantity,
    });
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  let discount = 0;
  let appliedCouponCode: string | undefined;
  if (couponCode !== undefined) {
    if (typeof couponCode !== "string" || !couponCode.trim()) throw new CheckoutValidationError("Coupon code is invalid");
    const coupon = await findActiveCoupon(couponCode);
    if (!coupon) throw new CheckoutValidationError("Coupon is invalid, inactive, or expired");
    if (subtotal < coupon.minimumOrderAmount) throw new CheckoutValidationError(`This coupon requires a minimum order of ₹${coupon.minimumOrderAmount.toLocaleString("en-IN")}`);
    discount = calculateOfferDiscount(coupon, subtotal);
    appliedCouponCode = coupon.code;
  }
  const total = subtotal - discount;
  if (!Number.isFinite(total) || !Number.isSafeInteger(Math.round(total * 100))) {
    throw new CheckoutValidationError("The order total is invalid");
  }
  return {
    idempotencyKey,
    ...(identity ? { customerId: identity.id } : {}),
    customer: {
      name: (checkoutName as string).trim(),
      email: normalizeCustomerEmail(checkoutEmail as string),
      phone: (checkoutPhone as string).trim(),
    },
    shippingAddress: {
      address: (address.address as string).trim(),
      apartment: typeof address.apartment === "string" ? address.apartment.trim() : "",
      city: address.city.trim(),
      state: normalizeIndianState(address.state),
      pinCode: address.pinCode,
      country: "India",
      recipientName: (checkoutName as string).trim(),
      phone: (checkoutPhone as string).trim(),
    },
    items: items as CheckoutRequest["items"],
    ...(appliedCouponCode ? { couponCode: appliedCouponCode } : {}),
    orderItems,
    subtotal,
    discount,
    total,
  };
}

export function buildCheckoutOrder(
  checkout: Awaited<ReturnType<typeof prepareCheckoutOrder>>,
  payment: OrderDocument["payment"],
  paymentMode: NonNullable<OrderDocument["paymentMode"]>,
  razorpayOrderId?: string,
) {
  return {
    id: `TB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
    idempotencyKey: checkout.idempotencyKey,
    ...(checkout.customerId ? { customerId: checkout.customerId } : {}),
    customer: checkout.customer,
    shippingAddress: checkout.shippingAddress,
    items: checkout.orderItems,
    subtotal: checkout.subtotal,
    shipping: 0,
    discount: checkout.discount,
    ...(checkout.couponCode ? { couponCode: checkout.couponCode } : {}),
    total: checkout.total,
    payment,
    paymentMode,
    ...(razorpayOrderId ? { razorpayOrderId } : {}),
    status: "Pending" as const,
  };
}
