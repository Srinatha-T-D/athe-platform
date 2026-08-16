import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Public: the storefront reads these to show a real garment photo instead
// of the flat placeholder shape. Returned as a flat "typeId:colorId" -> url
// map - one slot per (type, colour) pair, independent of any product's stock.
router.get("/", async (req, res) => {
  const rows = await prisma.garmentPhoto.findMany();
  const map = {};
  for (const row of rows) map[`${row.typeId}:${row.color}`] = row.photoUrl;
  res.json(map);
});

router.patch("/", requireAuth(["ADMIN"]), async (req, res) => {
  const { typeId, colorId, photoUrl } = req.body;
  if (!typeId || !colorId || !photoUrl) return res.status(400).json({ error: "typeId, colorId and photoUrl are required" });
  const row = await prisma.garmentPhoto.upsert({
    where: { typeId_color: { typeId, color: colorId } },
    update: { photoUrl },
    create: { typeId, color: colorId, photoUrl },
  });
  res.json(row);
});

export default router;
