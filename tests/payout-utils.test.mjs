import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadTypeScript(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  return module.exports;
}

const {
  formatRmFromCents,
  getBookingNetPaidCents,
  maskAccountNumber,
  parsePayoutDetailsDoc,
  parsePayoutLedgerDoc,
  parseRmInputToCents,
  summarizeAllVendorsEarnings,
  validateRejectionNote,
  validateTransferReference,
} = loadTypeScript("../src/app/payoutUtils.ts");

test("getBookingNetPaidCents separates live vs test paid orders and deducts refunds", () => {
  assert.deepEqual(
    getBookingNetPaidCents({
      vendorId: "v1",
      paymentStatus: "paid",
      paymentMode: "live",
      paymentPaidAt: 1_760_000_000_000,
      totalCents: 2500,
      paymentRefundedCents: 500,
    }),
    { vendorId: "v1", cents: 2000, mode: "live" }
  );

  assert.deepEqual(
    getBookingNetPaidCents({
      vendorId: "v1",
      paymentStatus: "paid",
      paymentMode: "test",
      paymentPaidAt: 1_760_000_000_000,
      totalCents: 4000,
    }),
    { vendorId: "v1", cents: 4000, mode: "test" }
  );

  assert.deepEqual(
    getBookingNetPaidCents({
      vendorId: "v1",
      paymentStatus: "awaiting_payment",
      paymentMode: "live",
      totalCents: 4000,
    }),
    { vendorId: "v1", cents: 0, mode: "live" }
  );
});

test("summarizeAllVendorsEarnings computes unsettled balances across vendors", () => {
  const bookings = [
    {
      id: "b1",
      data: {
        vendorId: "v1",
        paymentStatus: "paid",
        paymentMode: "live",
        paymentPaidAt: 1_760_000_000_000,
        totalCents: 5000,
      },
    },
    {
      id: "b2",
      data: {
        vendorId: "v1",
        paymentStatus: "paid",
        paymentMode: "test",
        paymentPaidAt: 1_760_000_000_000,
        totalCents: 3000,
      },
    },
    {
      id: "b3",
      data: {
        vendorId: "v2",
        paymentStatus: "paid",
        paymentMode: "live",
        paymentPaidAt: 1_760_000_000_000,
        totalCents: 1800,
      },
    },
  ];

  const payouts = [
    parsePayoutLedgerDoc("p1", {
      vendorId: "v1",
      amountCents: 2000,
      status: "paid",
      bankName: "Maybank",
      accountHolderName: "Ali",
      accountNumber: "1122334455",
      transferReference: "MBB-001",
    }),
    parsePayoutLedgerDoc("p2", {
      vendorId: "v1",
      amountCents: 1500,
      status: "pending",
      bankName: "Maybank",
      accountHolderName: "Ali",
      accountNumber: "1122334455",
    }),
    parsePayoutLedgerDoc("p3", {
      vendorId: "v1",
      amountCents: 900,
      status: "rejected",
      bankName: "Maybank",
      accountHolderName: "Ali",
      accountNumber: "1122334455",
    }),
  ];

  const map = summarizeAllVendorsEarnings(bookings, payouts);
  const v1 = map.get("v1");
  const v2 = map.get("v2");

  assert.equal(v1.liveNetSalesCents, 5000);
  assert.equal(v1.livePaidOrdersCount, 1);
  assert.equal(v1.testNetSalesCents, 3000);
  assert.equal(v1.paidOutCents, 2000);
  assert.equal(v1.pendingCents, 1500);
  assert.equal(v1.unsettledLiveCents, 3000);
  assert.equal(v1.availableToRequestCents, 1500);

  assert.equal(v2.liveNetSalesCents, 1800);
  assert.equal(v2.unsettledLiveCents, 1800);
});

test("payout input validators & formatters enforce limits", () => {
  assert.equal(formatRmFromCents(1250), "RM 12.50");
  assert.equal(maskAccountNumber("1122 3344 5566"), "•••• 5566");
  assert.equal(parseRmInputToCents("12.50"), 1250);
  assert.equal(parseRmInputToCents("0.50"), null);
  assert.equal(parseRmInputToCents("not-a-number"), null);
  assert.notEqual(validateTransferReference("x"), null);
  assert.equal(validateTransferReference("MBB-FT-2026"), null);
  assert.notEqual(validateRejectionNote(" "), null);
  assert.equal(validateRejectionNote("Invalid account number"), null);

  const parsedDetails = parsePayoutDetailsDoc("v1", {
    bankName: "CIMB Bank",
    accountHolderName: "Siti Aminah",
    accountNumber: "8001234567",
  });
  assert.equal(parsedDetails.vendorId, "v1");
  assert.equal(parsedDetails.bankName, "CIMB Bank");
});
