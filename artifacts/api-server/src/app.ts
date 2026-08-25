import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { getCachedStripeMode } from "./stripeClient";

const app: Express = express();

// ── Stripe webhook — MUST be registered before express.json() ────────────────
// Stripe requires the raw Buffer body to validate the webhook signature.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err: err.message }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

// ── Raw-card production guard — MUST be before express.json() ────────────────
// Block POST /api/bookings before the body is parsed in live mode so that
// real PAN/CVC never reaches this server at all (not just after parsing).
app.use("/api/bookings", (req, res, next) => {
  if (req.method === "POST" && getCachedStripeMode() === "live") {
    res.status(503).json({
      error:
        "Raw card collection is unavailable in production. " +
        "Please use the Stripe mobile SDK for payments.",
    });
    return;
  }
  next();
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
