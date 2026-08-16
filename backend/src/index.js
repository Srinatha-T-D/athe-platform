import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import productTypeRoutes from "./routes/product-types.js";
import designRoutes from "./routes/designs.js";
import garmentPhotoRoutes from "./routes/garment-photos.js";
import zoneRoutes from "./routes/zones.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";
import couponRoutes from "./routes/coupons.js";
import { register, metricsMiddleware } from "./metrics.js";

const app = express();

app.use(helmet());
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors({ origin: !corsOrigin || corsOrigin === "*" ? true : corsOrigin.split(",") }));
app.use(express.json({
  limit: "5mb",
  verify: (req, res, buf) => {
    // The Razorpay webhook needs the exact raw body to verify its signature;
    // JSON.parse can reformat whitespace, which would break that check.
    req.rawBody = buf.toString();
  },
}));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(metricsMiddleware);

// Kubernetes liveness/readiness probes
app.get("/healthz", (req, res) => res.json({ status: "ok" }));
app.get("/readyz", (req, res) => res.json({ status: "ready" }));

// Prometheus scrape target
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.send(await register.metrics());
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/product-types", productTypeRoutes);
app.use("/api/designs", designRoutes);
app.use("/api/garment-photos", garmentPhotoRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/coupons", couponRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`ATHE backend listening on :${port}`));
