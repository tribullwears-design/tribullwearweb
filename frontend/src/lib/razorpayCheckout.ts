export type RazorpayPaymentResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayPaymentMethod = "upi" | "card" | "netbanking";

export function getRazorpayPaymentConfig(method: RazorpayPaymentMethod) {
  const labels: Record<RazorpayPaymentMethod, string> = {
    upi: "UPI",
    card: "Debit / credit card",
    netbanking: "Net banking",
  };
  return {
    display: {
      blocks: {
        selected: {
          name: labels[method],
          instruments: [{ method }],
        },
      },
      sequence: ["block.selected"],
      preferences: { show_default_blocks: false },
    },
  };
}

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  config: ReturnType<typeof getRazorpayPaymentConfig>;
  handler: (response: RazorpayPaymentResponse) => void;
  modal: { ondismiss: () => void };
};

type RazorpayFailure = { error?: { description?: string } };

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailure) => void) => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayCheckout() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout is available only in a browser"));
  }
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="true"]');
    let appendScript = false;
    if (!script) {
      script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.razorpayCheckout = "true";
      appendScript = true;
    }
    script.addEventListener("load", () => {
      if (window.Razorpay) resolve();
      else {
        script?.remove();
        reject(new Error("Razorpay Checkout did not initialize"));
      }
    }, { once: true });
    script.addEventListener("error", () => {
      script?.remove();
      reject(new Error("Could not load Razorpay Checkout. Check your connection and try again."));
    }, { once: true });
    if (appendScript) document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(options: Omit<RazorpayOptions, "handler" | "modal">) {
  await loadRazorpayCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Razorpay Checkout is unavailable. Please try again.");

  return new Promise<RazorpayPaymentResponse>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };
    const checkout = new Razorpay({
      ...options,
      handler: (response) => finish(() => resolve(response)),
      modal: { ondismiss: () => finish(() => reject(new Error("Payment was cancelled. You can try again."))) },
    });
    checkout.on("payment.failed", (response) => finish(() => reject(
      new Error(response.error?.description || "Payment failed. Please try another payment method."),
    )));
    checkout.open();
  });
}
