const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

router.use(auth);

/**
 * GET /api/production-events
 */
router.get(
  "/",
  allowRoles("superadmin", "admin", "manager", "agent", "operator"),
  async (req, res) => {
    const {
      eventType,
      partFamily,
      partNumber,
      serialNumber,
      vinNumber,
      trolleyNumber,
      fromDate,
      toDate,
      limit = 100,
    } = req.query;

    const where = [];
    const params = [];
    let i = 1;

    if (eventType) {
      where.push(`event_type = $${i++}`);
      params.push(eventType);
    }

    if (partFamily) {
      where.push(`part_family ILIKE $${i++}`);
      params.push(`%${partFamily}%`);
    }

    if (partNumber) {
      where.push(`part_number ILIKE $${i++}`);
      params.push(`%${partNumber}%`);
    }

    if (serialNumber) {
      where.push(`serial_number ILIKE $${i++}`);
      params.push(`%${serialNumber}%`);
    }

    if (vinNumber) {
      where.push(`vin_number ILIKE $${i++}`);
      params.push(`%${vinNumber}%`);
    }

    if (trolleyNumber) {
      where.push(`trolley_number ILIKE $${i++}`);
      params.push(`%${trolleyNumber}%`);
    }

    if (fromDate) {
      where.push(`event_at >= $${i++}`);
      params.push(fromDate);
    }

    if (toDate) {
      where.push(`event_at <= $${i++}`);
      params.push(toDate);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    try {
      const result = await pool.query(
        `
        SELECT
          e.*,
          u.name AS operator_name,
          u.email AS operator_email
        FROM production_part_events e
        LEFT JOIN users u ON u.id = e.operator_user_id
        ${whereClause}
        ORDER BY e.event_at DESC
        LIMIT $${i}
        `,
        [...params, Number(limit)]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Fetch production events failed:", err);
      res.status(500).json({ error: "Failed to fetch production events" });
    }
  }
);

/**
 * POST /api/production-events
 */
router.post(
  "/",
  allowRoles("superadmin", "admin", "manager", "operator"),
  async (req, res) => {
    const {
      eventType,
      partFamily,
      partNumber,
      serialNumber,
      vinNumber,
      station,
      trolleyNumber,
      warehouseRow,
      quantity,
      scrapReason,
      shift,
      eventAt,
    } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: "eventType is required" });
    }

    if (!partNumber && !partFamily) {
      return res.status(400).json({
        error: "partNumber or partFamily is required",
      });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO production_part_events (
          event_type,
          part_family,
          part_number,
          serial_number,
          vin_number,
          station,
          trolley_number,
          warehouse_row,
          quantity,
          scrap_reason,
          shift,
          operator_user_id,
          event_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13, NOW()))
        RETURNING *
        `,
        [
          eventType,
          partFamily || null,
          partNumber || null,
          serialNumber || null,
          vinNumber || null,
          station || null,
          trolleyNumber || null,
          warehouseRow || null,
          quantity || 1,
          scrapReason || null,
          shift || null,
          req.user.id,
          eventAt || null,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Create production event failed:", err);
      res.status(500).json({ error: "Failed to create production event" });
    }
  }
);

module.exports = router;