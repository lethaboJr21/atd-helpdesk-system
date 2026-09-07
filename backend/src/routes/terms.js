const express = require("express");
const auth = require("../middleware/auth");
const pool = require("../db/pool");
const { getTermsState, acceptCurrentDocuments } = require("../services/termsService");
const router = express.Router();
router.use(auth);
router.get("/current", async (req,res,next) => { try { return res.json(await getTermsState(req.user.id)); } catch (e) { return next(e); } });
router.post("/accept", async (req,res,next) => {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const state = await acceptCurrentDocuments({ userId:req.user.id, documentIds:req.body.documentIds, ipAddress:req.ip, userAgent:req.get("user-agent"), database:client }); await client.query("COMMIT"); return res.json({ message:"Legal documents accepted.", ...state }); }
  catch(e){ await client.query("ROLLBACK").catch(()=>{}); return next(e); } finally { client.release(); }
});
module.exports = router;
