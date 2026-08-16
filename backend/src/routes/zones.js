import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const zones = await prisma.deliveryZone.findMany({ orderBy: { pincode: "asc" } });
  res.json(zones);
});

router.get("/:pincode", async (req, res) => {
  const zone = await prisma.deliveryZone.findUnique({ where: { pincode: req.params.pincode } });
  if (!zone) return res.status(404).json({ error: "Pincode not mapped yet" });
  res.json(zone);
});

router.post("/", requireAuth(["ADMIN"]), async (req, res) => {
  const { pincode, km, fee } = req.body;
  if (!/^\d{6}$/.test(pincode || "")) return res.status(400).json({ error: "Invalid pincode" });
  const zone = await prisma.deliveryZone.create({ data: { pincode, km: Number(km), fee: Number(fee) } });
  res.status(201).json(zone);
});

router.delete("/:id", requireAuth(["ADMIN"]), async (req, res) => {
  await prisma.deliveryZone.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
