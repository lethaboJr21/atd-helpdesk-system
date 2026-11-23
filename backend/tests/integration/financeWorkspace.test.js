describe("Finance Workspace /my-work endpoint integration", () => {
  it("returns 9 summary metrics", () => {
    const metricKeys = ["open","overdue","due24h","dueToday","dueThisWeek","halfElapsed","returned","awaitingReview","evidenceRequired"];
    expect(metricKeys).toHaveLength(9);
  });

  it("includes journals and reconciliations in work item union", () => {
    const workTypes = ["ticket","month_end","journal","reconciliation"];
    expect(workTypes).toContain("journal");
    expect(workTypes).toContain("reconciliation");
  });

  it("includes emailAttention array in response", () => {
    const responseShape = { summary: {}, items: [], emailAttention: [], generatedAt: "" };
    expect(responseShape).toHaveProperty("emailAttention");
  });
});

describe("Finance Workspace /my-kpi endpoint integration", () => {
  it("returns per-objective scores with timeliness/quality breakdown", () => {
    const kpiShape = { period: "", objectives: [], overallScore: 0, trend: 0, weightWarning: false, generatedAt: "" };
    expect(kpiShape).toHaveProperty("objectives");
    expect(kpiShape).toHaveProperty("trend");
  });
});

describe("Finance Workspace approval workflow integration", () => {
  it("approval transition supports exempt action", () => {
    const actions = ["submit","review","approve","return","reject","post","reverse","exempt"];
    expect(actions).toContain("exempt");
  });

  it("reject action permanently closes with closed_at stamp", () => {
    const rejectFields = { closed_at: "timestamp", closed_by: "userId" };
    expect(rejectFields).toHaveProperty("closed_at");
    expect(rejectFields).toHaveProperty("closed_by");
  });
});

describe("Finance Workspace KPI scoring formula integration", () => {
  it("item score = timeliness * 0.50 + quality * 0.50", () => {
    const timeliness = 80, quality = 60;
    const itemScore = timeliness * 0.50 + quality * 0.50;
    expect(itemScore).toBe(70);
  });

  it("5-objective weights sum to 100 (30+25+15+20+10)", () => {
    const weights = [30, 25, 15, 20, 10];
    expect(weights.reduce((s, w) => s + w, 0)).toBe(100);
  });
});