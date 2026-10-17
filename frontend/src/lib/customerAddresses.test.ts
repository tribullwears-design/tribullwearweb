import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyCustomerAddressFields,
  deleteSavedCustomerAddress,
  saveCustomerAddress,
  type SavedCustomerAddress,
} from "./customerAddresses.js";

const address = {
  fullName: "Test Customer",
  phone: "9876543210",
  address: "10 Test Street",
  apartment: "",
  city: "Chennai",
  state: "Tamil Nadu",
  pinCode: "600001",
};

const saved: SavedCustomerAddress = { ...address, id: "address-1", isDefault: true };

afterEach(() => vi.unstubAllGlobals());

describe("customer address API helpers", () => {
  it("creates an address, refetches it from the backend, and supports resetting the add form", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(saved), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([saved]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveCustomerAddress(address, null, "address-request-id-001");

    expect(result).toEqual({ saved, addresses: [saved] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/customer/addresses");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      ...address,
      requestId: "address-request-id-001",
    });
    expect(createEmptyCustomerAddressFields()).toEqual({
      fullName: "",
      phone: "",
      address: "",
      apartment: "",
      city: "",
      state: "",
      pinCode: "",
    });
  });

  it("updates the selected address and verifies the refreshed record", async () => {
    const updated = { ...saved, city: "Pune" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(updated), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([updated]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveCustomerAddress({ ...address, city: "Pune" }, saved.id, "unused-request-id")).resolves.toMatchObject({
      saved: updated,
      addresses: [updated],
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/customer/addresses/address-1");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  });

  it("deletes an address only after backend confirmation and refetches the list", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onConfirmed = vi.fn();

    await expect(deleteSavedCustomerAddress(saved.id, onConfirmed)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(onConfirmed).toHaveBeenCalledOnce();
  });

  it("does not refetch or report success when an address mutation fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Save failed" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveCustomerAddress(address, null, "address-request-id-001")).rejects.toThrow("Save failed");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
