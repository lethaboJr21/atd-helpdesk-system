const { getTermsState } = require("../services/termsService");
module.exports = async function requireTermsAcceptance(req, res, next) {
  try {
    const state = await getTermsState(req.user?.id);
    req.terms = state;
    if (!state.required) return next();
    return res.status(428).json({ code: "TERMS_ACCEPTANCE_REQUIRED", error: "Accept the current Terms and Privacy Notice to continue.", terms: state });
  } catch (error) { if (error.code === "42P01") return next(); return next(error); }
};
