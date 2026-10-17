import { describe, expect, it, vi } from "vitest";
import { deleteAdminUserAndRefresh, saveAdminUserAndRefresh } from "./adminUsers.js";

describe("saveAdminUserAndRefresh", () => {
  it("refreshes the Admin Users list after a confirmed grant", async () => {
    const saved = { id: "admin-1", role: "Manager" };
    const save = vi.fn().mockResolvedValue(saved);
    const refresh = vi.fn().mockResolvedValue(undefined);
    await expect(saveAdminUserAndRefresh(save, refresh)).resolves.toEqual(saved);
    expect(save).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  describe("deleteAdminUserAndRefresh", () => {
    it("does not call the API or refresh when deletion is cancelled", async () => {
      const remove = vi.fn().mockResolvedValue(undefined);
      const refresh = vi.fn().mockResolvedValue(undefined);

      await expect(deleteAdminUserAndRefresh(false, remove, refresh)).resolves.toBe(false);
      expect(remove).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("refreshes the account list only after the server confirms deletion", async () => {
      const remove = vi.fn().mockResolvedValue(undefined);
      const refresh = vi.fn().mockResolvedValue(undefined);

      await expect(deleteAdminUserAndRefresh(true, remove, refresh)).resolves.toBe(true);
      expect(remove).toHaveBeenCalledOnce();
      expect(refresh).toHaveBeenCalledOnce();
    });

    it("does not refresh when deletion fails", async () => {
      const remove = vi.fn().mockRejectedValue(new Error("Account deletion failed"));
      const refresh = vi.fn().mockResolvedValue(undefined);

      await expect(deleteAdminUserAndRefresh(true, remove, refresh)).rejects.toThrow("Account deletion failed");
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  it("does not refresh or report success when the server rejects a grant", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Forbidden"));
    const refresh = vi.fn();
    await expect(saveAdminUserAndRefresh(save, refresh)).rejects.toThrow("Forbidden");
    expect(refresh).not.toHaveBeenCalled();
  });
});
