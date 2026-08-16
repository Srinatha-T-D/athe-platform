import { Router } from "express";
import { activeCoupons, validateCoupon } from "../coupons.js";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Public: powers the storefront's offer banners.
router.get("/", async (req, res) => {
  res.json(await activeCoupons());
});

// Public: called when a customer applies a code at checkout, and again
// server-side (orders.js) right before an order is created — never trust
// a discount amount the client sends.
router.post("/validate", async (req, res) => {
  const { code, subtotal } = req.body;
  const result = await validateCoupon(code, Number(subtotal) || 0);
  if (!result.valid) return res.status(400).json(result);
  res.json(result);
});

// Admin: full list (including inactive/expired) for the management screen.
router.get("/all", requireAuth(["ADMIN"]), async (req, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  res.json(coupons);
});

router.post("/", requireAuth(["ADMIN"]), async (req, res) => {
  const { code, label, kind, value, minSubtotal, maxDiscount } = req.body;
  if (!code || !label || !["PERCENT", "FLAT"].includes(kind) || !value || !maxDiscount) {
    return res.status(400).json({ error: "Missing or invalid fields" });
  }
  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: String(code).trim().toUpperCase(),
        label: String(label).trim(),
        kind,
        value: Number(value),
        minSubtotal: Number(minSubtotal) || 0,
        maxDiscount: Number(maxDiscount),
      },
    });
    res.status(201).json(coupon);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "A coupon with that code already exists" });
    throw err;
  }
});

router.patch("/:id", requireAuth(["ADMIN"]), async (req, res) => {
  const { active, label, value, minSubtotal, maxDiscount } = req.body;
  const data = {};
  if (active !== undefined) data.active = Boolean(active);
  if (label !== undefined) data.label = String(label);
  if (value !== undefined) data.value = Number(value);
  if (minSubtotal !== undefined) data.minSubtotal = Number(minSubtotal);
  if (maxDiscount !== undefined) data.maxDiscount = Number(maxDiscount);

  const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data });
  res.json(coupon);
});

router.delete("/:id", requireAuth(["ADMIN"]), async (req, res) => {
  await prisma.coupon.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
