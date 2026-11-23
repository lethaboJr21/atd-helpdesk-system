const pool = require("../../src/db/pool");
const { scopeTo } = require("../../src/services/workspaceQueryService");

async function countBy(sql, params = []) {
  const r = await pool.query(`SELECT COUNT(*)::int count FROM tickets t WHERE ${sql}`, params);
  return r.rows[0].count;
}

async function idsBy(sql, params = []) {
  const r = await pool.query(`SELECT t.id FROM tickets t WHERE ${sql} ORDER BY t.id`, params);
  return r.rows.map((x) => x.id);
}

describe("Workspace Query Parity (post-Phase-1 verification)", () => {
  afterAll(async () => {
    await pool.end();
  });

  describe("Legacy patterns no longer match (workspace normalised to canonical codes)", () => {
    it("LIKE '%finance%' returns 0", async () => {
      expect(await countBy("LOWER(COALESCE(t.workspace,'')) LIKE '%finance%'")).toBe(0);
    });

    it("= 'finance' returns 0", async () => {
      expect(await countBy("LOWER(COALESCE(t.workspace,'')) = 'finance'")).toBe(0);
    });

    it("<> 'finance' returns ALL tickets (none match 'finance')", async () => {
      const total = await countBy("TRUE");
      const legacy = await countBy("LOWER(COALESCE(t.workspace,'')) <> 'finance'");
      expect(legacy).toBe(total);
    });
  });

  describe("Canonical patterns return correct results", () => {
    it("has Finance tickets (FIN > 0)", async () => {
      expect(await countBy("t.workspace = 'FIN'")).toBeGreaterThan(0);
    });

    it("has IT tickets (IT > 0)", async () => {
      expect(await countBy("t.workspace = 'IT'")).toBeGreaterThan(0);
    });

    it("FIN + IT + PDM + HR + FAC = total", async () => {
      const fin = await countBy("t.workspace = 'FIN'");
      const it = await countBy("t.workspace = 'IT'");
      const pdm = await countBy("t.workspace = 'PDM'");
      const hr = await countBy("t.workspace = 'HR'");
      const fac = await countBy("t.workspace = 'FAC'");
      const total = await countBy("TRUE");
      expect(fin + it + pdm + hr + fac).toBe(total);
    });
  });

  describe("scopeTo() generates correct SQL", () => {
    it("scopeTo('FIN') matches t.workspace = 'FIN'", async () => {
      const scope = scopeTo("FIN", { alias: "t", paramStart: 1 });
      const scoped = await idsBy(scope.sql, scope.params);
      const direct = await idsBy("t.workspace = 'FIN'");
      expect(scoped).toEqual(direct);
    });

    it("scopeTo('IT') matches t.workspace = 'IT'", async () => {
      const scope = scopeTo("IT", { alias: "t", paramStart: 1 });
      const scoped = await idsBy(scope.sql, scope.params);
      const direct = await idsBy("t.workspace = 'IT'");
      expect(scoped).toEqual(direct);
    });

    it("scopeTo('finance') normalises to FIN", async () => {
      const scope = scopeTo("finance", { alias: "t", paramStart: 1 });
      expect(scope.params).toEqual(["FIN"]);
      const finCount = await countBy("t.workspace = 'FIN'");
      const scoped = await idsBy(scope.sql, scope.params);
      expect(scoped.length).toBe(finCount);
    });
  });

  describe("All workspace values are canonical", () => {
    it("no non-canonical workspace values", async () => {
      const r = await pool.query(
        "SELECT DISTINCT t.workspace FROM tickets t WHERE t.workspace IS NOT NULL ORDER BY t.workspace"
      );
      const canonical = ["FIN", "HR", "IT", "FAC", "PDM"];
      for (const row of r.rows) {
        expect(canonical).toContain(row.workspace);
      }
    });

    it("no NULL workspace values", async () => {
      expect(await countBy("t.workspace IS NULL")).toBe(0);
    });
  });
});