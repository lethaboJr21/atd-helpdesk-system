"use strict";

const RULES = [
  {
    type: "asset_request",
    terms: ["laptop", "desktop", "monitor", "mouse", "keyboard", "headset", "device", "asset", "equipment", "replacement hardware", "new hardware"],
    workspace: "IT Service Request",
    category: "Hardware",
  },
  {
    type: "change",
    terms: ["change request", "planned change", "deployment", "release", "rollback", "implementation plan", "maintenance window", "configuration change"],
    workspace: "Change Management",
    category: "Change Management",
  },
  {
    type: "project",
    terms: ["new project", "project request", "project proposal", "project sponsor", "project owner", "deliverables", "project initiation"],
    workspace: "Project Management",
    category: "Project Management",
  },
  {
    type: "service_request",
    terms: ["request access", "access request", "new account", "install", "installation", "license", "permission", "shared mailbox", "distribution list", "service request"],
    workspace: "IT Service Request",
    category: "Service Request",
  },
  {
    type: "incident",
    terms: ["not working", "down", "offline", "error", "failed", "failure", "cannot", "can't", "unable", "issue", "problem", "outage", "slow", "timeout"],
    workspace: "IT",
    category: "Incident",
  },
];

function classifyEmail({ subject = "", body = "" } = {}) {
  const text = `${subject} ${body}`.toLowerCase();
  const scored = RULES.map((rule) => ({
    ...rule,
    score: rule.terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];
  if (!best || best.score === 0) {
    return {
      ticketType: "incident",
      workspace: "IT",
      category: "Email Triage",
      confidence: 0.25,
      requiresTriage: true,
      reasons: [],
    };
  }

  const confidence = Math.min(0.95, 0.5 + best.score * 0.12 - (second?.score === best.score ? 0.15 : 0));
  return {
    ticketType: best.type,
    workspace: best.workspace,
    category: best.category,
    confidence,
    requiresTriage: confidence < 0.65,
    reasons: best.terms.filter((term) => text.includes(term)),
  };
}

module.exports = { classifyEmail };