import { Router, type Request, type Response } from "express";
import { getSessionCustomer } from "./authService.js";
import {
  addCustomerAddress,
  addCustomerWishlistItem,
  deleteCustomerAddress,
  getCustomerProfile,
  getCustomerWishlist,
  listCustomerAddresses,
  mergeCustomerWishlist,
  removeCustomerWishlistItem,
  updateCustomerProfile,
  updateCustomerAddress,
  type CustomerAddress,
} from "./customerDataStore.js";
import { getProduct } from "./productStore.js";
import { listCustomerOrders } from "./orderStore.js";
import { isValidCustomerMobile } from "./authStore.js";
import { isIndianState, normalizeIndianState } from "../shared/checkout.js";

const cleanText = (value: unknown, maximum: number) => typeof value === "string"
  ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
  : "";

const maxProfilePhotoBytes = 4_000_000;

function isSupportedProfilePhotoData(value: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || value.length > 5_600_100) return false;
  const [, imageType, encoded] = match;
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > maxProfilePhotoBytes || bytes.toString("base64") !== encoded) return false;
  if (imageType === "jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (imageType === "png") return bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

function validateProfile(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (typeof value.name !== "string" || typeof value.phone !== "string"
    || (value.photo !== undefined && value.photo !== null && typeof value.photo !== "string")) return null;
  const name = cleanText(value.name, 80);
  const phone = cleanText(value.phone, 20);
  if (name.length < 2 || (phone !== "" && !isValidCustomerMobile(phone))) return null;
  let photo: string | null | undefined;
  if (value.photo === null) {
    photo = null;
  } else if (typeof value.photo === "string") {
    const candidate = value.photo.trim();
    const isSupportedImageData = isSupportedProfilePhotoData(candidate);
    let isHttpsUrl = false;
    if (candidate.length <= 2048) {
      try {
        const url = new URL(candidate);
        isHttpsUrl = url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
      } catch {
        isHttpsUrl = false;
      }
    }
    if (!isSupportedImageData && !isHttpsUrl) return null;
    photo = candidate;
  }
  return { name, phone, ...(photo !== undefined ? { photo } : {}) };
}

function validateAddress(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const limits: Array<[keyof typeof value, number, number]> = [
    ["fullName", 2, 80],
    ["phone", 10, 20],
    ["address", 5, 240],
    ["city", 2, 80],
    ["state", 2, 80],
    ["pinCode", 6, 6],
  ];
  if (limits.some(([field, minimum, maximum]) => typeof value[field] !== "string"
    || (value[field] as string).trim().length < minimum
    || (value[field] as string).trim().length > maximum)
    || (value.apartment !== undefined && (typeof value.apartment !== "string" || value.apartment.trim().length > 120))) return null;
  const address = {
    fullName: cleanText(value.fullName, 80),
    phone: cleanText(value.phone, 20),
    address: cleanText(value.address, 240),
    apartment: cleanText(value.apartment, 120),
    city: cleanText(value.city, 80),
    state: normalizeIndianState(cleanText(value.state, 80)),
    pinCode: cleanText(value.pinCode, 6),
  };
  if (address.fullName.length < 2 || !isValidCustomerMobile(address.phone)
    || address.address.length < 5 || (typeof value.apartment === "string" && value.apartment.length > 120)
    || address.city.length < 2
    || !isIndianState(address.state) || !/^\d{6}$/.test(address.pinCode)) return null;
  return address;
}

export function createCustomerRouter() {
  const router = Router();

  const withCustomer = async (req: Request, res: Response) => {
    const customer = await getSessionCustomer(req);
    if (!customer?._id) {
      res.status(401).json({ error: "Sign in to manage your account" });
      return null;
    }
    return customer;
  };

  router.get("/api/customer/profile", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      const profile = await getCustomerProfile(customer._id.toString(), {
        name: customer.name,
        email: customer.email,
        phone: customer.mobile,
      });
      const { userId: _userId, ...safeProfile } = profile;
      return res.json({ profile: safeProfile });
    } catch (error) {
      console.error("Customer profile could not be loaded", error);
      return res.status(500).json({ error: "Unable to load your profile" });
    }
  });

  router.patch("/api/customer/profile", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      const patch = validateProfile(req.body);
      if (!patch) return res.status(400).json({ error: "Enter a valid name, phone number, and profile photo" });
      const profile = await updateCustomerProfile(customer._id.toString(), customer.email, patch);
      if (!profile) return res.status(500).json({ error: "Unable to confirm your profile update" });
      const { userId: _userId, ...safeProfile } = profile;
      return res.json({ profile: safeProfile });
    } catch (error) {
      console.error("Customer profile could not be updated", error);
      return res.status(500).json({ error: "Unable to update your profile" });
    }
  });

  router.get("/api/customer/addresses", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      return res.json(await listCustomerAddresses(customer._id.toString()));
    } catch (error) {
      console.error("Customer addresses could not be loaded", error);
      return res.status(500).json({ error: "Unable to load saved addresses" });
    }
  });

  router.post("/api/customer/addresses", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      const address = validateAddress(req.body);
      const requestId = req.body?.requestId;
      if (!address || typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
        return res.status(400).json({ error: "Enter a valid address and request ID" });
      }
      const current = await listCustomerAddresses(customer._id.toString());
      const record: CustomerAddress = {
        id: requestId,
        ...address,
        isDefault: current.length === 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const saved = await addCustomerAddress(customer._id.toString(), record);
      if (!saved) return res.status(409).json({ error: "Unable to save the address. Please retry." });
      return res.status(201).json(saved);
    } catch (error) {
      console.error("Customer address could not be saved", error);
      return res.status(500).json({ error: "Unable to save this address" });
    }
  });

  router.patch("/api/customer/addresses/:id", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      const address = validateAddress(req.body);
      if (!address || (req.body?.isDefault !== undefined && typeof req.body.isDefault !== "boolean")) {
        return res.status(400).json({ error: "Enter a valid address" });
      }
      const updated = await updateCustomerAddress(customer._id.toString(), req.params.id, {
        ...address,
        isDefault: req.body.isDefault === true,
      });
      if (!updated) return res.status(404).json({ error: "Address not found" });
      return res.json(updated);
    } catch (error) {
      console.error("Customer address could not be updated", error);
      return res.status(500).json({ error: "Unable to update this address" });
    }
  });

  router.delete("/api/customer/addresses/:id", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      if (!await deleteCustomerAddress(customer._id.toString(), req.params.id)) {
        return res.status(404).json({ error: "Address not found" });
      }
      return res.sendStatus(204);
    } catch (error) {
      console.error("Customer address could not be deleted", error);
      return res.status(500).json({ error: "Unable to delete this address" });
    }
  });

  router.get("/api/customer/wishlist", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      return res.json({ productIds: await getCustomerWishlist(customer._id.toString()) });
    } catch (error) {
      console.error("Customer wishlist could not be loaded", error);
      return res.status(500).json({ error: "Unable to load your wishlist" });
    }
  });

  router.put("/api/customer/wishlist/:productId", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      const product = await getProduct(req.params.productId);
      if (!product) return res.status(404).json({ error: "Product not found" });
      return res.json({ productIds: await addCustomerWishlistItem(customer._id.toString(), product.id) });
    } catch (error) {
      console.error("Customer wishlist item could not be saved", error);
      return res.status(500).json({ error: "Unable to update your wishlist" });
    }
  });

  router.delete("/api/customer/wishlist/:productId", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      return res.json({ productIds: await removeCustomerWishlistItem(customer._id.toString(), req.params.productId) });
    } catch (error) {
      console.error("Customer wishlist item could not be removed", error);
      return res.status(500).json({ error: "Unable to update your wishlist" });
    }
  });

  router.post("/api/customer/wishlist/merge", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      const input = req.body?.productIds;
      if (!Array.isArray(input) || input.length > 100
        || input.some((id: unknown) => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id))) {
        return res.status(400).json({ error: "Wishlist contents are invalid" });
      }
      const uniqueInput = Array.from(new Set(input as string[]));
      const validIds: string[] = [];
      for (const id of uniqueInput) {
        if (await getProduct(id)) validIds.push(id);
      }
      const productIds = await mergeCustomerWishlist(customer._id.toString(), validIds);
      return res.json({ productIds, discardedCount: uniqueInput.length - validIds.length });
    } catch (error) {
      console.error("Customer wishlist could not be merged", error);
      return res.status(500).json({ error: "Unable to sync your wishlist" });
    }
  });

  router.get("/api/customer/orders", async (req, res) => {
    try {
      const customer = await withCustomer(req, res);
      if (!customer?._id) return;
      const page = typeof req.query.page === "string" && /^\d{1,6}$/.test(req.query.page) ? Math.max(1, Number(req.query.page)) : 1;
      return res.json(await listCustomerOrders(customer._id.toString(), page, 20));
    } catch (error) {
      console.error("Customer order history could not be loaded", error);
      return res.status(500).json({ error: "Unable to load your orders" });
    }
  });

  return router;
}
