import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Turns the flat ProductVariant rows Prisma returns into the nested
// { [colorId]: { [size]: stock } } shape every frontend app already expects.
function shapeVariants(variantRows) {
  const shaped = {};
  for (const v of variantRows) {
    if (!shaped[v.color]) shaped[v.color] = {};
    shaped[v.color][v.size] = v.stock;
  }
  return shaped;
}
function shapeProduct(product) {
  return { ...product, variants: shapeVariants(product.variants || []) };
}

// Public: storefront catalog
router.get("/", async (req, res) => {
  const { type, category } = req.query;
  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(type && type !== "all" ? { type: String(type) } : {}),
      ...(category && category !== "all" ? { category: String(category) } : {}),
    },
    include: { variants: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(products.map(shapeProduct));
});

// New products start at price 0 with every colour/size at 0 stock - admin
// sets the real price and stock afterward (Products tab), rather than
// requiring them up front. Only name/type/category are mandatory.
router.post("/", requireAuth(["ADMIN"]), async (req, res) => {
  const { name, type, category, price, isNew } = req.body;
  if (!name || !type || !category) return res.status(400).json({ error: "name, type and category are required" });
  const product = await prisma.product.create({
    data: { name, type, category, price: Number(price) || 0, isNew: !!isNew },
    include: { variants: true },
  });
  res.status(201).json(shapeProduct(product));
});

// Partial update - admin sends one field at a time (name, type, category,
// price, isNew, active).
router.patch("/:id", requireAuth(["ADMIN"]), async (req, res) => {
  const allowed = ["name", "type", "category", "price", "isNew", "active"];
  const data = {};
  for (const key of allowed) if (key in req.body) data[key] = req.body[key];
  const product = await prisma.product.update({ where: { id: req.params.id }, data, include: { variants: true } });
  res.json(shapeProduct(product));
});

router.delete("/:id", requireAuth(["ADMIN"]), async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

const stockSchema = z.object({
  colorId: z.string().min(1),
  size: z.string().min(1),
  units: z.number().int().min(0),
});

// One colour/size cell at a time, matching the admin stock grid's per-input
// editing. Upserts so the first edit to a cell doesn't need a separate
// "create the variant row" step.
router.patch("/:id/stock", requireAuth(["ADMIN"]), async (req, res) => {
  const parsed = stockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { colorId, size, units } = parsed.data;

  const variant = await prisma.productVariant.upsert({
    where: { productId_color_size: { productId: req.params.id, color: colorId, size } },
    update: { stock: units },
    create: { productId: req.params.id, color: colorId, size, stock: units },
  });
  res.json(variant);
});

export default router;
