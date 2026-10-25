import { Router } from "express";
import { wrap } from "../utils.js";
import { mutasikuNotify, mockPayOrder } from "../controllers/paymentController.js";

const router = Router();
router.post("/mutasiku/notify", wrap(mutasikuNotify));
router.post("/mock/pay", wrap(mockPayOrder));
export default router;
