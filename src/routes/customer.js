import { Router } from "express";
import rateLimit from "express-rate-limit";
import { wrap } from "../utils.js";
import {
  getConfig, getTableByQR, getTenants, getAllMenus, getMenusByTenant, checkout,
  getOrderStatus, getOrdersStatus
} from "../controllers/customerController.js";
import { ensureQris, cekBayar } from "../controllers/paymentController.js";

const router = Router();

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Terlalu banyak percobaan, tunggu sebentar lalu coba lagi" }
});

router.get("/config", wrap(getConfig));
router.get("/tables/:qr_code", wrap(getTableByQR));
router.get("/tenants", wrap(getTenants));
router.get("/menus", wrap(getAllMenus));
router.get("/tenants/:tenantId/menus", wrap(getMenusByTenant));
router.post("/checkout", checkoutLimiter, wrap(checkout));
router.get("/orders/status", wrap(getOrdersStatus));
router.get("/orders/:orderId/status", wrap(getOrderStatus));

const payLimiter = rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: true, legacyHeaders: false, message: { message: "Terlalu banyak permintaan, tunggu sebentar" } });
router.post("/orders/:orderId/qris", payLimiter, wrap(ensureQris));
router.post("/orders/:orderId/cek-bayar", payLimiter, wrap(cekBayar));

export default router;
