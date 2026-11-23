function logFinanceAction(req, action, target) {
  console.log(JSON.stringify({
    logType: "FINANCE_ACTION",
    userId: req.user?.id ?? null,
    role: req.user?.role ?? null,
    workspace: "FIN",
    action: action ?? null,
    target: target === undefined ? null : target,
    timestamp: new Date().toISOString(),
  }));
}

module.exports = { logFinanceAction };