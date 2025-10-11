import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import crons from "@convex-dev/crons/convex.config";

const app = defineApp();

app.use(rateLimiter);
app.use(crons);

export default app;
