import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import StorefrontHeader from "../components/StorefrontHeader";
import { apiFetch } from "../lib/api";
import { getOrderStatusDisplay } from "../lib/orderStatus";

type TrackedOrder = {
  id: string;
  status: string;
  createdAt: string;
  statusUpdatedAt?: string;
};

function isTrackedOrder(value: unknown): value is TrackedOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  return typeof order.id === "string"
    && typeof order.status === "string"
    && typeof order.createdAt === "string"
    && (order.statusUpdatedAt === undefined || typeof order.statusUpdatedAt === "string");
}

const orderProgressLabels = ["Order Placed", "Processing", "Shipped", "Delivered"];

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);

    try {
      const response = await apiFetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim(), customerName: customerName.trim() }),
      });
      const payload = await response.json() as { order?: unknown; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to look up this order.");
      if (!isTrackedOrder(payload.order)) throw new Error("Order status could not be read. Please try again.");
      setOrder(payload.order);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to look up this order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const statusDisplay = order ? getOrderStatusDisplay(order.status) : null;
  const currentStep = statusDisplay?.progressStatus
    ? orderProgressLabels.indexOf(statusDisplay.progressStatus)
    : -1;

  return (
    <>
      <StorefrontHeader />
      <main className="track-order">
        <div className="track-order__content">
          <Link className="track-order__back" href="/">Back to home</Link>
          <p className="track-order__eyebrow">TRIBULL SUPPORT</p>
          <h1>Track Your Order</h1>
          <p className="track-order__intro">
            Enter the order ID and the name used for the order to check its latest status.
          </p>

          <form className="track-order__form" onSubmit={handleSubmit}>
            <label>
              <span>Order ID</span>
              <input
                type="text"
                name="orderId"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="e.g. TB-20261017-1234ABCD"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={80}
                required
              />
            </label>
            <label>
              <span>Name used for the order</span>
              <input
                type="text"
                name="customerName"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                autoComplete="name"
                maxLength={80}
                required
              />
            </label>
            {error && <p className="track-order__error" role="alert">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "Checking order…" : "Check order status"}
            </button>
          </form>

          {order && statusDisplay && (
            <section className="track-order__result" aria-live="polite" aria-label="Order status">
              <div className="track-order__result-heading">
                <div>
                  <span>Order ID</span>
                  <strong>{order.id}</strong>
                </div>
                <span className={`track-order__status track-order__status--${statusDisplay.tone}`}>
                  {statusDisplay.label}
                </span>
              </div>
              <p className="track-order__placed">
                Placed {new Date(order.createdAt).toLocaleDateString("en-IN")}
                {order.statusUpdatedAt && ` · Status updated ${new Date(order.statusUpdatedAt).toLocaleDateString("en-IN")}`}
              </p>
              {statusDisplay.tone === "cancelled" ? (
                <p className="track-order__cancelled">This order was cancelled. Contact support if you need help.</p>
              ) : statusDisplay.progressStatus ? (
                <ol className="track-order__progress" aria-label="Order progress">
                  {orderProgressLabels.map((label, index) => (
                    <li
                      className={index <= currentStep ? "track-order__step track-order__step--complete" : "track-order__step"}
                      key={label}
                      aria-current={index === currentStep ? "step" : undefined}
                    >
                      <span>{index < currentStep ? "✓" : index + 1}</span>
                      {label}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="track-order__cancelled">Order progress is currently unavailable. Please contact support.</p>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
