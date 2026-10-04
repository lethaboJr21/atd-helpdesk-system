const express = require("express");
const auth = require("../middleware/auth");
const pool = require("../db/pool");
const router = express.Router();
router.use(auth);

const offices = [
  { id: "main-cfo", name: "Finance Main and CFO Office", kind: "operational_and_executive" },
  { id: "accounts-payable", name: "Accounts Payable Office", kind: "operational", ownManager: true },
  { id: "boardroom", name: "Finance Boardroom", kind: "governed_meeting_and_decision_space", defaultAssignee: false },
];
const products = [
  ["RSB", "Rear Step Bumpers"], ["CF", "Chassis Frames"], ["TG", "Tailgates"],
  ["BL", "Bedliners"], ["BR", "Box Rails"], ["EC", "Endcaps"], ["OTHER", "Other or uncategorised products"],
].map(([code, name]) => ({ code, name }));
const processes = ["Supplier invoice","Supplier payment","Employee payment","Employee reimbursement","Sales order processing","Purchase-order matching","Payment exception","Supplier query","Budget review","Financial reporting","Audit request","Boardroom review","General Finance request"];
const lifecycle = ["New","Under Review","Information Required","Waiting Approval","Approved","Rejected","In Progress","Completed","Cancelled","Reopened"];
const confidentiality = ["Internal","Finance Restricted","Confidential","CFO Restricted","Boardroom Restricted","Payment Restricted","Employee Financial Information","Supplier Banking Information"];
const exportSheets = ["Summary","Product Performance","Accounts Payable","Approvals","Overdue Items","Office Workload","Exceptions","Detailed Data","Data Dictionary","Export Metadata"];

router.get("/configuration", async (_req, res) => res.json({
  workspaceCode: "FIN", offices, products, processes, lifecycle, confidentiality,
  uploadSecurity: { confidentialUploadsEnabled: false, blockers: ["protected-storage","signature-validation","generated-filenames","malware-scanning","csrf-protection","retention","authenticated-download"] },
  reporting: { periods: ["Daily","Weekly","Monthly","Quarterly","Year to date","Financial year","Custom"], exportSheets, xlsxStatus: "export-contract-ready-workbook-service-pending" },
  entraOrganogram: { mode: "read-only", fields: ["department","jobTitle","manager","officeLocation","companyName","employeeType","accountEnabled","objectId"], writeBack: false },
}));

router.get("/dashboard", async (_req, res, next) => {
  try {
    const ws = await pool.query("SELECT id, code, name, status FROM service_workspaces WHERE code = 'FIN' LIMIT 1");
    const workspace = ws.rows[0] || { code: "FIN", name: "Finance", status: "draft" };
    let metrics = { total: 0, overdue: 0, waitingApproval: 0, completed: 0, byStatus: [], byPriority: [] };
    if (workspace.id) {
      const summary = await pool.query(`SELECT COUNT(*)::int total,
        COUNT(*) FILTER (WHERE due_at < NOW() AND status NOT IN ('Resolved','Closed'))::int overdue,
        COUNT(*) FILTER (WHERE status = 'Waiting Approval')::int waiting_approval,
        COUNT(*) FILTER (WHERE status IN ('Resolved','Closed'))::int completed
        FROM tickets WHERE workspace_id = $1`, [workspace.id]);
      const status = await pool.query("SELECT status label, COUNT(*)::int value FROM tickets WHERE workspace_id=$1 GROUP BY status ORDER BY value DESC", [workspace.id]);
      const priority = await pool.query("SELECT priority label, COUNT(*)::int value FROM tickets WHERE workspace_id=$1 GROUP BY priority ORDER BY value DESC", [workspace.id]);
      const row = summary.rows[0] || {};
      metrics = { total: row.total || 0, overdue: row.overdue || 0, waitingApproval: row.waiting_approval || 0, completed: row.completed || 0, byStatus: status.rows, byPriority: priority.rows };
    }
    res.json({ workspace, metrics, offices, products, secureUploadReady: false, generatedAt: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get("/export-contract", (_req, res) => res.json({
  format: "xlsx", implementationStatus: "contract-ready-workbook-service-pending",
  sheets: exportSheets,
  columns: ["Record ID","Finance Office","Finance Process","Product Family Code","Product Family Name","Product Code","Product Description","Customer","Supplier","Invoice Number","Purchase Order Number","Sales Order Number","Transaction Date","Due Date","Quantity","Unit Price","Gross Amount","Discount Amount","Tax Amount","Net Amount","Currency","Exchange Rate","Local Currency Amount","Approval Status","Payment Status","Owner","Department","Cost Centre","Confidentiality Level","Created At","Completed At","Reopened"],
  rules: ["one-header-row","one-record-per-row","genuine-excel-dates","numeric-money","separate-currency-column","stable-column-names","data-dictionary","export-metadata","column-level-security","export-audit"],
}));
module.exports = router;
