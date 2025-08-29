import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";

export const accountsRouter = Router();

const CreateAccount = z.object({
  name: z.string().min(1),
  currency: z.string().length(3).toUpperCase()
});

accountsRouter.post("/", async (req, res) => {
  const parsed = CreateAccount.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const acct = await prisma.account.create({
    data: { ...parsed.data, balanceCents: 0n }
  });
  res.status(201).json(acct);
});

accountsRouter.get("/", async (_req, res) => {
  res.json(await prisma.account.findMany());
});
