import "dotenv/config";
import crypto from "node:crypto";
import { HttpError } from "../utils.js";

// QRIS GoPay Merchant lewat MUTASIKU Payments API (tipe QRIS-DYNAMIC).
// Mutasiku membuat QR + kode unik, memantau mutasi akun GoPay Merchant-mu, lalu menandai pembayaran PAID.
// Dokumentasi: https://mutasiku.co.id/api-docs  |  webhook: https://docs.mutasiku.co.id/docs/webhooks
//
// Env:
//   MUTASIKU_API_KEY            api key dari dashboard Mutasiku (header x-api-key)
//   MUTASIKU_WALLET_ACCOUNT_ID  UUID akun GoPay Merchant yang sudah dihubungkan di Mutasiku
//   MUTASIKU_BASE_URL           default https://mutasiku.co.id
//   MUTASIKU_REDIRECT_URL       URL tujuan setelah bayar (wajib oleh Mutasiku), default = APP_URL atau https://example.com
//   MUTASIKU_WEBHOOK_SECRET     secret webhook (Settings -> Webhooks di dashboard) untuk verifikasi X-Webhook-Signature
//   MUTASIKU_MOCK=true          mode simulasi tanpa Mutasiku/GoPay (tes lokal / demo)
const env = (k, d = "") => process.env[k] || d;
const BASE = () => env("MUTASIKU_BASE_URL", "https://mutasiku.co.id").replace(/\/+$/, "");

export const QR_LIFETIME_MIN = 15; // hanya untuk mode simulasi; mode asli memakai expiresAt dari Mutasiku
export const mockOn = () => String(env("MUTASIKU_MOCK")).toLowerCase() === "true";
export const gatewayOn = () => mockOn() || (env("MUTASIKU_API_KEY") !== "" && env("MUTASIKU_WALLET_ACCOUNT_ID") !== "");

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(BASE() + path, {
      method,
      headers: { "x-api-key": env("MUTASIKU_API_KEY"), Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
  } catch { throw new HttpError(502, "Tidak bisa menghubungi Mutasiku"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === "error") {
    console.error("[mutasiku]", method, path, res.status, JSON.stringify(data).slice(0, 300));
    throw new HttpError(502, "Mutasiku menolak permintaan");
  }
  return data.data;
}

// ---------- MOCK ----------
const mockTx = new Map(); // paymentId -> "PENDING" | "PAID"

// Buat QRIS dinamis. Mengembalikan { paymentId, qr, fee, total, expiresMs }.
//   qr   = URL gambar QR (mode asli) atau teks (mode simulasi)
//   fee  = kode unik (rupiah) yang ditambahkan Mutasiku ke nominal
export async function createQris(orderRef, amount) {
  if (mockOn()) {
    const code = 1 + crypto.randomInt(999);
    mockTx.set(orderRef, "PENDING");
    return { paymentId: orderRef, qr: `MOCK-QRIS|${orderRef}|${amount + code}`, fee: code, total: amount + code, expiresMs: Date.now() + QR_LIFETIME_MIN * 60 * 1000 };
  }
  const d = await call("POST", "/api/v1/payments", {
    amount,
    walletAccountId: env("MUTASIKU_WALLET_ACCOUNT_ID"),
    redirectUrl: env("MUTASIKU_REDIRECT_URL") || env("APP_URL") || "https://example.com",
    orderId: orderRef,
    type: "QRIS-DYNAMIC"
  });
  if (!d?.id || !d?.qrisImage) throw new HttpError(502, "Respons Mutasiku tidak dikenali");
  const total = Number(d.totalAmount) || amount;
  const exp = Date.parse(d.expiresAt);
  return { paymentId: d.id, qr: d.qrisImage, fee: Math.max(0, total - amount), total, expiresMs: Number.isFinite(exp) ? exp : Date.now() + QR_LIFETIME_MIN * 60 * 1000 };
}

// Status resmi dari Mutasiku: "PAID" | "PENDING" | "EXPIRED" | ...
export async function getStatus(paymentId) {
  if (mockOn()) return mockTx.get(paymentId) || "PENDING";
  const d = await call("GET", `/api/v1/payments/status/${encodeURIComponent(paymentId)}`);
  return String(d?.status || "PENDING").toUpperCase();
}

export const isPaid = (s) => s === "PAID" || s === "COMPLETED";
export function mockPay(paymentId) { if (!mockTx.has(paymentId)) return false; mockTx.set(paymentId, "PAID"); return true; }
export async function cancelQris() { /* Mutasiku tidak punya endpoint batal; QR lama kedaluwarsa sendiri */ }

// Webhook: X-Webhook-Signature = HMAC-SHA256(JSON.stringify(body.data), secret), hex.
export function verifyWebhook(req) {
  const secret = env("MUTASIKU_WEBHOOK_SECRET");
  if (!secret) return false; // tanpa secret, webhook ditolak (status tetap terbaca lewat pemeriksa latar belakang)
  const sig = String(req.get("x-webhook-signature") || "");
  const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body?.data ?? null)).digest("hex");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const parseOrderId = (ref) => { const m = /^FC(\d+)-/.exec(String(ref || "")); return m ? Number(m[1]) : NaN; };
