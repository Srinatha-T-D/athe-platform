import { Router } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
const BUCKET = process.env.UPLOADS_BUCKET;

router.get("/", async (req, res) => {
  const designs = await prisma.design.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
  res.json(designs);
});

// Step 1: customer/storefront asks for a presigned S3 PUT URL for their upload
router.post("/upload-url", async (req, res) => {
  const { fileName, contentType } = req.body;
  if (!fileName || !contentType) return res.status(400).json({ error: "fileName and contentType required" });

  // Spaces and special characters in a filename break the resulting URL, so
  // strip anything that isn't a letter, number, dot, dash, or underscore.
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const key = `designs/uploads/${randomUUID()}-${safeName}`;
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const publicUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;

  res.json({ uploadUrl, publicUrl, key });
});

// Step 2: after the browser PUTs the file to S3, register it as a pending design
router.post("/", async (req, res) => {
  const { name, imageUrl } = req.body;
  if (!name || !imageUrl) return res.status(400).json({ error: "name and imageUrl required" });
  const design = await prisma.design.create({
    data: { name, tag: "Customer's Choice", imageUrl, pending: true, active: true },
  });
  res.status(201).json(design);
});

router.patch("/:id/review", requireAuth(["ADMIN"]), async (req, res) => {
  const { approve } = req.body;
  const design = await prisma.design.update({
    where: { id: req.params.id },
    data: approve ? { pending: false, tag: "Customer's Choice" } : { active: false, pending: false },
  });
  res.json(design);
});

// Admin: create a fully-approved design directly (not a pending customer upload).
router.post("/admin", requireAuth(["ADMIN"]), async (req, res) => {
  const { name, tag, audience, imageUrl, trending } = req.body;
  if (!name || !imageUrl) return res.status(400).json({ error: "name and imageUrl required" });
  const design = await prisma.design.create({
    data: {
      name,
      tag: tag || "New",
      audience: ["men", "women", "unisex"].includes(audience) ? audience : "all",
      imageUrl,
      trending: Boolean(trending),
      active: true,
      pending: false,
    },
  });
  res.status(201).json(design);
});

router.patch("/:id", requireAuth(["ADMIN"]), async (req, res) => {
  const { name, tag, audience, trending, active } = req.body;
  const data = {};
  if (name !== undefined) data.name = String(name);
  if (tag !== undefined) data.tag = String(tag);
  if (audience !== undefined && ["all", "men", "women", "unisex"].includes(audience)) data.audience = audience;
  if (trending !== undefined) data.trending = Boolean(trending);
  if (active !== undefined) data.active = Boolean(active);
  const design = await prisma.design.update({ where: { id: req.params.id }, data });
  res.json(design);
});

router.delete("/:id", requireAuth(["ADMIN"]), async (req, res) => {
  await prisma.design.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
