import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { adminHelpFaqs, filterAdminHelpFaqs } from "./adminHelp";
import AdminHelpCenter from "../pages/AdminHelpCenter";

describe("admin help center FAQ search", () => {
  it("returns all FAQs for an empty query and filters question and answer text case-insensitively", () => {
    expect(filterAdminHelpFaqs("")).toHaveLength(adminHelpFaqs.length);
    expect(filterAdminHelpFaqs("  RAZORPAY  ").map(({ id }) => id)).toEqual(["payments"]);
    expect(filterAdminHelpFaqs("current password").map(({ id }) => id)).toEqual(["account-settings"]);
  });

  it("returns no results when no FAQ matches", () => {
    expect(filterAdminHelpFaqs("shipping label printer")).toEqual([]);
  });

  it("renders FAQ questions and answers as native expandable disclosures", () => {
    const markup = renderToStaticMarkup(createElement(AdminHelpCenter));
    expect((markup.match(/<details\b[^>]*class="admin-help-faq"/g) || []).length).toBe(adminHelpFaqs.length);
    expect(markup).toContain("How do I add or edit a product?");
    expect(markup).toContain("Razorpay payments are confirmed by the backend verification flow");
    expect(markup).not.toMatch(/<details\b[^>]*\bopen(?:=|\s|>)/);
  });
});
