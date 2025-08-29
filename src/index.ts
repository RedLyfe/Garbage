import express from "express";
import { logger } from "./logger.js";
import { accountsRouter } from "./routes/accounts.js";
import { transfersRouter } from "./routes/transfers.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/accounts", accountsRouter);
app.use("/transfers", transfersRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => logger.info(`API listening on port ${port}`));
