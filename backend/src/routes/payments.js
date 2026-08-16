import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { prisma } from "../db.js";
import { revenueTotal } from "../metrics.js";

const router = Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Step 1 (frontend): before opening the Razorpay checkout modal, ask us to
// create a Razorpay order for the exact amount, so the amount can't be
// tampered with client-side.
router.post("/create-order", async (req, res) => {
  const { amount } = req.body; // amount in rupees (whole INR, e.g. 649)
  if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency: "INR",
      receipt: `athe_${Date.now()}`,
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // publishable, safe to send to the browser
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    res.status(502).json({ error: "Could not start payment. Please try again." });
  }
});

// Verifies a client-completed payment's signature. Used by the checkout flow
// right after the Razorpay modal succeeds, before we mark an order as paid.
export function verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return expected === razorpaySignature;
}

// Step 3 (webhook, configured in the Razorpay dashboard): a safety net.
// Even if the customer closes their browser right after paying, Razorpay
// still tells us the payment succeeded here, so the order gets marked paid.
router.post("/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.rawBody || JSON.stringify(req.body))
    .digest("hex");

  if (signature !== expected) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const event = req.body;
  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const order = await prisma.order.findFirst({ where: { razorpayOrderId: payment.order_id } });
    if (order && !order.paid) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paid: true, razorpayPaymentId: payment.id },
      });
      revenueTotal.inc(order.total);
    }
  }

  res.json({ received: true });
});

export default router;
