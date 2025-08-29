import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import type { Prisma } from "@prisma/client";

export const transfersRouter = Router();

const TransferReq = z.object({
  idempotencyKey: z.string().min(8),
  debitAccountId: z.string(),
  creditAccountId: z.string(),
  amountCents: z.bigint().positive(),
  currency: z.string().length(3).toUpperCase()
});

transfersRouter.post("/", async (req, res) => {
  const parsed = TransferReq.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { idempotencyKey, debitAccountId, creditAccountId, amountCents, currency } = parsed.data;

  try {
    const transfer = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Idempotency: return previous transfer if same key
        const existing = await tx.transfer.findUnique({ where: { idempotencyKey } });
        if (existing) return existing;

        // Read both accounts
        const [debit, credit] = await Promise.all([
          tx.account.findUnique({ where: { id: debitAccountId } }),
          tx.account.findUnique({ where: { id: creditAccountId } })
        ]);

        if (!debit || !credit) throw new Error("Account not found");
        if (debit.currency !== currency || credit.currency !== currency) throw new Error("Currency mismatch");
        if (debit.id === credit.id) throw new Error("Cannot transfer to same account");
        if (debit.balanceCents < amountCents) throw new Error("Insufficient funds");

        // Create transfer
        const created = await tx.transfer.create({
          data: { idempotencyKey, debitAccountId, creditAccountId, amountCents, currency }
        });

        // Ledger entries
        await tx.ledgerEntry.createMany({
          data: [
            { transferId: created.id, accountId: debit.id, deltaCents: -amountCents },
            { transferId: created.id, accountId: credit.id, deltaCents: amountCents }
          ]
        });

        // Update balances
        await tx.account.update({
          where: { id: debit.id },
          data: { balanceCents: debit.balanceCents - amountCents }
        });
        await tx.account.update({
          where: { id: credit.id },
          data: { balanceCents: credit.balanceCents + amountCents }
        });

        return created;
      },
      { isolationLevel: "Serializable" } // optional but good for money
    );

    res.status(201).json({ status: "ok", transfer });
  } catch (e: any) {
    res.status(400).json({ status: "error", message: e?.message ?? "Transfer failed" });
  }
});
