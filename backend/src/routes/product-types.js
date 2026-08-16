import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Public: storefront and admin both need the current type list (storefront
// for size-chart/silhouette lookups, admin to populate the type picker).
router.get("/", async (req, res) => {
  const types = await prisma.productType.findMany({ orderBy: { createdAt: "asc" } });
  res.json(types);
});

// `id` is a client-supplied slug (e.g. "oversized"), not a generated uuid -
// admin computes it from the type name so its optimistic local state and
// the server agree without a round trip. Upsert so re-adding the same slug
// (e.g. retrying after a dropped connection) updates instead of 500ing on
// the unique constraint.
router.post("/", requireAuth(["ADMIN"]), async (req, res) => {
  const { id, name, silhouette } = req.body;
  if (!id || !name || !silhouette) return res.status(400).json({ error: "id, name and silhouette are required" });
  if (!["tshirt", "hoodie"].includes(silhouette)) return res.status(400).json({ error: "silhouette must be tshirt or hoodie" });
  const type = await prisma.productType.upsert({
    where: { id },
    update: { name, silhouette },
    create: { id, name, silhouette },
  });
  res.status(201).json(type);
});

// Deleting a type never touches products that reference it - they just keep
// the stale type string (see the schema comment on Product.type).
router.delete("/:id", requireAuth(["ADMIN"]), async (req, res) => {
  await prisma.productType.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

export default router;
