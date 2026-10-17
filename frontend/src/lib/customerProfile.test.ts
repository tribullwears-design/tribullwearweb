import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCustomerProfile,
  readProfilePhotoFile,
  saveCustomerProfile,
  validateProfilePhotoFile,
} from "./customerProfile.js";

afterEach(() => vi.unstubAllGlobals());

describe("customer profile photo handling", () => {
  it("accepts JPEG, PNG, and WebP within the size limit and rejects invalid files", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateProfilePhotoFile({ type, size: 1 })).toBeNull();
    }
    expect(validateProfilePhotoFile({ type: "image/gif", size: 1 })).toContain("JPEG, PNG, or WebP");
    expect(validateProfilePhotoFile({ type: "image/png", size: 0 })).toContain("larger than 0 bytes");
    expect(validateProfilePhotoFile({ type: "image/png", size: 4_000_001 })).toContain("4 MB");
  });

  it("reports a file-reader failure without producing a temporary URL", async () => {
    class FailedReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      readAsDataURL() {
        this.onerror?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
      abort() {}
      addEventListener() {}
      dispatchEvent() { return false; }
      removeEventListener() {}
    }
    vi.stubGlobal("FileReader", FailedReader);
    const file = new File(["image"], "profile.png", { type: "image/png" });

    await expect(readProfilePhotoFile(file)).rejects.toThrow("could not be read");
  });

  it("creates a stable data image representation for the preview instead of a blob URL", async () => {
    class SuccessfulReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      readAsDataURL(file: Blob) {
        this.result = `data:${file.type};base64,${Buffer.from("image-data").toString("base64")}`;
        this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
      abort() {}
      addEventListener() {}
      dispatchEvent() { return false; }
      removeEventListener() {}
    }
    vi.stubGlobal("FileReader", SuccessfulReader);
    const file = new File(["image"], "profile.webp", { type: "image/webp" });

    const photo = await readProfilePhotoFile(file);
    expect(photo).toMatch(/^data:image\/webp;base64,/);
    expect(photo).not.toContain("blob:");
  });

  it("saves the image through the authenticated profile API then reloads the persisted profile", async () => {
    const photo = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64")}`;
    const savedProfile = { name: "Customer", email: "customer@example.com", phone: "9876543210", photo };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile: savedProfile }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile: savedProfile }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile: savedProfile }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveCustomerProfile({ name: "Customer", phone: "9876543210", photo })).resolves.toEqual(savedProfile);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/customer/profile");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).photo).toBe(photo);
    await expect(fetchCustomerProfile()).resolves.toEqual(savedProfile);
  });

  it("does not reload or change the displayed profile when the upload request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Upload failed" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveCustomerProfile({ name: "Customer", phone: "", photo: "data:image/png;base64,AA==" }))
      .rejects.toThrow("Upload failed");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("preserves the saved photo when the profile update does not change it", async () => {
    const savedProfile = { name: "Customer", email: "customer@example.com", phone: "", photo: "https://example.com/photo.png" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile: savedProfile }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile: savedProfile }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile: savedProfile }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await saveCustomerProfile({ name: "Customer", phone: "" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).not.toHaveProperty("photo");
    expect((await fetchCustomerProfile()).photo).toBe(savedProfile.photo);
  });
});
