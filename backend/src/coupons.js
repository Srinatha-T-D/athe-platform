// Coupons live in the database (Coupon model) and are managed from the
// admin Coupons tab. This module is the only place discount math happens,
// so the storefront (display) and the orders route (money) can never
// disagree, and a customer can never dictate their own discount.
import { prisma } from "./db.js";

// Returns { valid, discountAmount, label, code, error }. subtotal is in rupees.
export async function validateCoupon(rawCode, subtotal) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { valid: false, discountAmount: 0, error: "Enter a code" };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) {
    return { valid: false, discountAmount: 0, error: "Invalid or expired code" };
  }

  if (subtotal < coupon.minSubtotal) {
    return {
      valid: false,
      discountAmount: 0,
      error: `Add ₹${coupon.minSubtotal - subtotal} more to use this code`,
    };
  }

  let discountAmount =
    coupon.kind === "PERCENT" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  discountAmount = Math.min(discountAmount, coupon.maxDiscount, subtotal);

  return { valid: true, discountAmount, label: coupon.label, code: coupon.code };
}

// Public list powering the storefront's offer banners.
export async function activeCoupons() {
  const coupons = await prisma.coupon.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });
  return coupons.map(({ code, label }) => ({ code, label }));
}
