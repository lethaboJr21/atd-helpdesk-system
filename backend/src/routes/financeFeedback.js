const express = require("express");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeFeedbackService");
const router = express.Router();

function emitFeedbackEvent(req, payload) {
  const io = req.app.get("io");
  if (io) io.emit("finance-workspace:feedback-updated", payload);
}

router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const entry = await service.createFeedback({ ...body, authorUserId: req.user.id });
    logFinanceAction(req, "feedback_create", entry?.thread_id || entry?.id);
    emitFeedbackEvent(req, { threadId: entry?.thread_id, recipientUserId: entry?.recipient_user_id, timestamp: Date.now() });
    res.status(201).json(entry);
  } catch (error) { next(error); }
});

router.post("/:threadId/reply", async (req, res, next) => {
  try {
    const body = req.body || {};
    const entry = await service.replyToFeedback({ threadId: Number(req.params.threadId), authorUserId: req.user.id, remarkText: body.remarkText, rating: body.rating });
    logFinanceAction(req, "feedback_reply", req.params.threadId);
    emitFeedbackEvent(req, { threadId: Number(req.params.threadId), recipientUserId: entry?.recipient_user_id, timestamp: Date.now() });
    res.status(201).json(entry);
  } catch (error) { next(error); }
});

router.get("/thread/:threadId", async (req, res, next) => {
  try {
    const thread = await service.getFeedbackThread(Number(req.params.threadId), { id: req.user.id, financeAccess: req.financeAccess });
    logFinanceAction(req, "feedback_thread_view", req.params.threadId);
    res.json(thread);
  } catch (error) { next(error); }
});

router.get("/my-feedback", async (req, res, next) => {
  try {
    const feedback = await service.getFeedbackForUser({
      userId: req.user.id,
      direction: req.query.direction,
      workItemId: req.query.workItemId,
      periodKey: req.query.periodKey,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    logFinanceAction(req, "feedback_list_own");
    res.json({ feedback });
  } catch (error) { next(error); }
});

router.put("/:entryId", async (req, res, next) => {
  try {
    const body = req.body || {};
    const entry = await service.editFeedback(Number(req.params.entryId), req.user.id, body.remarkText, body.rating);
    logFinanceAction(req, "feedback_edit", req.params.entryId);
    emitFeedbackEvent(req, { threadId: entry?.thread_id, entryId: Number(req.params.entryId), timestamp: Date.now() });
    res.json(entry);
  } catch (error) { next(error); }
});

module.exports = router;