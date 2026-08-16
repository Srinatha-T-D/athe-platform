import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ordersCreatedTotal, revenueTotal } from "../metrics.js";
import { verifyRazorpaySignature } from "./payments.js";
import { validateCoupon } from "../coupons.js";

const router = Router();

const FLOW = {
  STALL: ["PLACED", "PRINTING", "READY", "DELIVERED"],
  HOME: ["PLACED", "PRINTING", "READY", "OUT", "DELIVERED"],
};

// Order items carry the colour NAME (what customers/staff read, e.g. "Jet
// Black"), but ProductVariant rows are keyed by colour ID (e.g. "black") -
// same palette every frontend app declares. This translates name -> id so
// checkout can find and decrement the right stock cell without changing
// what's stored on the order itself.
const COLOR_NAME_TO_ID = {
  "Bone White": "white",
  "Jet Black": "black",
  "Ink Navy": "navy",
  "Storm Grey": "grey",
  "Field Olive": "olive",
  "Rust Clay": "rust",
};
function toColorId(colorName) {
  return COLOR_NAME_TO_ID[colorName] || colorName;
}

const checkoutSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/),
  customerEmail: z.string().email(),
  deliveryType: z.enum(["STALL", "HOME"]),
  addressLine: z.string().optional(),
  pincode: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        designId: z.string(),
        color: z.string(),
        size: z.string(),
        qty: z.number().int().positive(),
        price: z.number().int().positive(),
      })
    )
    .min(1),
  // Present only if the customer paid via Razorpay before submitting the order
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
  // Coupon the customer typed in at checkout. We only trust the code itself —
  // the discount amount is always recomputed here, never taken from the client.
  discountCode: z.string().optional(),
});

router.post("/", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  let deliveryFee = 0;
  if (data.deliveryType === "HOME") {
    if (!data.pincode) return res.status(400).json({ error: "pincode required for home delivery" });
    const zone = await prisma.deliveryZone.findUnique({ where: { pincode: data.pincode } });
    if (!zone) return res.status(422).json({ error: "Pincode not mapped, confirm delivery fee manually" });
    deliveryFee = zone.fee;
  }

  const subtotal = data.items.reduce((s, i) => s + i.price * i.qty, 0);

  let discountAmount = 0;
  let discountCode = null;
  if (data.discountCode) {
    const result = await validateCoupon(data.discountCode, subtotal);
    if (!result.valid) return res.status(400).json({ error: result.error || "Invalid coupon code" });
    discountAmount = result.discountAmount;
    discountCode = result.code;
  }

  const total = Math.max(0, subtotal - discountAmount) + deliveryFee;

  // Home delivery must always be paid before we accept the order. Stall
  // pickup may optionally be paid up front too, if the customer chose "Pay
  // now" - in that case the same Razorpay fields will be present.
  let paid = false;
  if (data.razorpayOrderId) {
    const validSignature = verifyRazorpaySignature({
      razorpayOrderId: data.razorpayOrderId,
      razorpayPaymentId: data.razorpayPaymentId,
      razorpaySignature: data.razorpaySignature,
    });
    if (!validSignature) {
      return res.status(400).json({ error: "Payment verification failed. Please contact support before retrying." });
    }
    paid = true;
  } else if (data.deliveryType === "HOME") {
    return res.status(400).json({ error: "Home delivery orders must be paid before submitting." });
  }

  const count = await prisma.order.count();
  const code = `ATHE-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  // Stock is checked and decremented inside the same transaction as order
  // creation, so two customers racing for the last unit of a colour/size
  // can't both win - whichever transaction commits first wins, the other
  // sees the reduced count and fails cleanly instead of overselling.
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      for (const item of data.items) {
        const colorId = toColorId(item.color);
        const variant = await tx.productVariant.findUnique({
          where: { productId_color_size: { productId: item.productId, color: colorId, size: item.size } },
        });
        const available = variant?.stock ?? 0;
        if (available < item.qty) {
          const err = new Error(`${item.color} (size ${item.size}) just sold out.`);
          err.status = 409;
          throw err;
        }
      }
      for (const item of data.items) {
        await tx.productVariant.update({
          where: { productId_color_size: { productId: item.productId, color: toColorId(item.color), size: item.size } },
          data: { stock: { decrement: item.qty } },
        });
      }
      return tx.order.create({
        data: {
          code,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          deliveryType: data.deliveryType,
          addressLine: data.addressLine,
          pincode: data.pincode,
          subtotal,
          deliveryFee,
          discountCode,
          discountAmount,
          total,
          paid,
          razorpayOrderId: data.razorpayOrderId,
          razorpayPaymentId: data.razorpayPaymentId,
          items: { create: data.items },
        },
        include: { items: true },
      });
    });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    throw err;
  }

  ordersCreatedTotal.inc();
  if (paid) revenueTotal.inc(total);

  res.status(201).json(order);
});

router.get("/", requireAuth(["ADMIN", "STAFF"]), async (req, res) => {
  const { status } = req.query;
  const orders = await prisma.order.findMany({
    where: status ? { status: String(status) } : undefined,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
});

router.get("/track/:code", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { code: req.params.code }, include: { items: true } });
  if (!order) return res.status(404).json({ error: "Order not found" });
  // The storefront's poll compares this against lowercase "staff"/"customer".
  res.json({ ...order, cancelledBy: order.cancelledBy ? order.cancelledBy.toLowerCase() : null });
});

router.patch("/:id/advance", requireAuth(["ADMIN", "STAFF"]), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "Not found" });

  const flow = FLOW[order.deliveryType];
  const idx = flow.indexOf(order.status);
  const next = flow[Math.min(idx + 1, flow.length - 1)];

  const updated = await prisma.order.update({ where: { id: order.id }, data: { status: next } });
  res.json(updated);
});

const cancelSchema = z.object({
  reason: z.string().min(1),
  cancelledBy: z.enum(["customer", "staff"]),
});

// Public (not requireAuth): the customer's own tracking page calls this
// unauthenticated, using the order's human-readable `code` - staff also call
// it, with a bearer token that's simply not required here. `:id` accepts
// either the real id (what staff hold) or the code (all the customer has).
router.patch("/:id/cancel", async (req, res) => {
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { reason, cancelledBy } = parsed.data;

  const order = await prisma.order.findFirst({ where: { OR: [{ id: req.params.id }, { code: req.params.id }] } });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.cancelled) return res.status(409).json({ error: "This order is already cancelled." });
  if (order.status === "DELIVERED") return res.status(409).json({ error: "Delivered orders can't be cancelled." });

  // Same eligibility rule the storefront UI enforces, checked again here so
  // it can't be bypassed by calling the API directly: freely cancellable
  // before printing starts; once printing has begun, a paid (online) order
  // is locked in, but an unpaid (pay-at-pickup) order can still go through.
  if (cancelledBy === "customer") {
    const printingStarted = order.status !== "PLACED";
    if (printingStarted && order.paid) {
      return res.status(403).json({ error: "This order is paid and already printing, so it can't be cancelled here. Message us on WhatsApp." });
    }
  }
  // Staff may cancel at any point up to delivery - no extra check.

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      cancelled: true,
      cancelReason: reason,
      cancelledBy: cancelledBy.toUpperCase(),
      cancelledAt: new Date(),
    },
  });
  res.json({ ...updated, cancelledBy: cancelledBy });
});

// Powers the admin overview: today/this-month revenue, order counts, avg order value
router.get("/stats/summary", requireAuth(["ADMIN"]), async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

  const [todayOrders, monthOrders] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.findMany({ where: { createdAt: { gte: startOfMonth } } }),
  ]);

  const salesToday = todayOrders.reduce((s, o) => s + o.total, 0);
  const salesMonth = monthOrders.reduce((s, o) => s + o.total, 0);
  const avgOrder = monthOrders.length ? Math.round(salesMonth / monthOrders.length) : 0;

  // Real delivery fee total from actual home-delivery orders this month
  // (only HOME orders carry a delivery fee - stall pickup is always ₹0).
  const deliveryExpenseMonth = monthOrders
    .filter((o) => o.deliveryType === "HOME")
    .reduce((s, o) => s + o.deliveryFee, 0);
  const homeOrdersMonth = monthOrders.filter((o) => o.deliveryType === "HOME").length;

  res.json({
    salesToday,
    ordersToday: todayOrders.length,
    salesMonth,
    ordersMonth: monthOrders.length,
    avgOrder,
    deliveryExpenseMonth,
    homeOrdersMonth,
  });
});

export default router;
