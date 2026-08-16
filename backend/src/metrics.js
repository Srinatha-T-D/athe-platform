import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "athe_backend_" });

export const httpRequestDuration = new client.Histogram({
  name: "athe_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.02, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

export const ordersCreatedTotal = new client.Counter({
  name: "athe_orders_created_total",
  help: "Total number of orders placed",
});

export const revenueTotal = new client.Counter({
  name: "athe_revenue_total_inr",
  help: "Cumulative revenue in INR (paise-free, whole rupees)",
});

export const loginFailuresTotal = new client.Counter({
  name: "athe_login_failures_total",
  help: "Total failed login attempts (security signal)",
});

register.registerMetric(httpRequestDuration);
register.registerMetric(ordersCreatedTotal);
register.registerMetric(revenueTotal);
register.registerMetric(loginFailuresTotal);

export function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
  });
  next();
}
