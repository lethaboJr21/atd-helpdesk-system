/**
 * Seed realistic mock helpdesk data for a single demo/test employee account.
 *
 * Safe by design:
 * - Only touches rows tagged with external_id prefix demo-ngwenya-*
 * - Only attaches tickets/notifications to the target requester
 * - Does not modify other users, FS imports, groups, or AMS
 *
 * Usage:
 *   node scripts/seed-demo-user.js
 *   node scripts/seed-demo-user.js --email=ngwenyaresego@gmail.com
 */

require("dotenv").config();

const pool = require("../src/db/pool");

const DEMO_PREFIX = "demo-ngwenya";
const DEFAULT_EMAIL = "ngwenyaresego@gmail.com";

function argEmail() {
  const flag = process.argv.find((value) => value.startsWith("--email="));
  return String(flag ? flag.slice("--email=".length) : DEFAULT_EMAIL)
    .trim()
    .toLowerCase();
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days) {
  return hoursAgo(days * 24);
}

async function main() {
  const email = argEmail();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT id, name, email, role, status, approved
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );
    const user = userResult.rows[0];
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }
    if (!user.approved || user.status !== "active") {
      throw new Error(
        `User ${email} must be approved and active before seeding (status=${user.status}, approved=${user.approved}).`
      );
    }

    // Remove only this demo's prior seed (cascade covers comments/history/attachments).
    const removedTickets = await client.query(
      `DELETE FROM tickets
        WHERE external_id LIKE $1
           OR (requester_id = $2 AND request_details->>'demoSeed' = $3)
       RETURNING id, ticket_ref`,
      [`${DEMO_PREFIX}-%`, user.id, DEMO_PREFIX]
    );

    await client.query(
      `DELETE FROM notifications
        WHERE user_id = $1
          AND module = 'helpdesk'
          AND message LIKE '[Demo]%'` ,
      [user.id]
    );

    const sydney = 16; // Infrastructure / ERP
    const neo = 14; // ERP / IT Management
    const erp = 1;
    const infra = 2;

    const tickets = [
      {
        key: "01",
        prefix: "INC",
        title: "Cannot log into Syspro after password reset",
        description:
          "After the weekend password reset I can open Syspro but authentication fails with an environment prompt. Need access restored for finance month-end.",
        priority: "High",
        status: "Investigating",
        workspace: "IT",
        ticketType: "incident",
        category: "Application Software",
        subCategory: "Syspro",
        itemCategory: "Cannot Connect",
        source: "Portal",
        groupId: erp,
        assigneeId: sydney,
        impact: "High",
        urgency: "High",
        createdAt: hoursAgo(6),
        dueAt: hoursAgo(-18),
        firstRespondedAt: hoursAgo(5),
        comment:
          "Looking into your Syspro environment profile now. Please confirm whether you can reach the VPN.",
      },
      {
        key: "02",
        prefix: "REQ",
        title: "QMuzik Access",
        description:
          "Please grant QMuzik access for my role in Finance. I need to post and review transactions.",
        priority: "Medium",
        status: "Assigned",
        workspace: "IT Service Request",
        ticketType: "service_request",
        category: "Application Software",
        subCategory: "QMuzik",
        itemCategory: null,
        source: "Portal",
        groupId: erp,
        assigneeId: neo,
        impact: "Medium",
        urgency: "Medium",
        createdAt: hoursAgo(30),
        dueAt: hoursAgo(-42),
        firstRespondedAt: hoursAgo(28),
        requestDetails: {
          catalogItem: "QMuzik Access",
          catalogCategory: "QMuzik",
        },
        comment:
          "Access request received. Waiting on ERP Team approval for the Finance role pack.",
      },
      {
        key: "03",
        prefix: "INC",
        title: "Office printer on 2nd floor offline",
        description:
          "The Konica on the second floor shows offline and queued jobs are stuck. Nearby desks are affected.",
        priority: "Medium",
        status: "Pending",
        workspace: "IT",
        ticketType: "incident",
        category: "Hardware /Equipment",
        subCategory: "Office Printers",
        itemCategory: null,
        source: "Portal",
        groupId: infra,
        assigneeId: sydney,
        impact: "Medium",
        urgency: "Medium",
        createdAt: hoursAgo(52),
        dueAt: hoursAgo(-20),
        firstRespondedAt: hoursAgo(50),
        comment:
          "We rebooted the print spooler remotely. Please retry a test page and reply with the result.",
      },
      {
        key: "04",
        prefix: "REQ",
        title: "VPN Access",
        description:
          "Need VPN access for remote work two days a week. Laptop is already enrolled.",
        priority: "Low",
        status: "Open",
        workspace: "IT Service Request",
        ticketType: "service_request",
        category: "Network",
        subCategory: "VPN Access",
        itemCategory: null,
        source: "Portal",
        groupId: infra,
        assigneeId: null,
        impact: "Low",
        urgency: "Low",
        createdAt: hoursAgo(10),
        dueAt: hoursAgo(-62),
        firstRespondedAt: null,
        requestDetails: {
          catalogItem: "VPN Access",
          catalogCategory: "Network Access",
        },
      },
      {
        key: "05",
        prefix: "REQ",
        title: "Laptop charger replacement",
        description:
          "My laptop charger cable frayed near the connector. Requesting a replacement charger for Dell Latitude.",
        priority: "Medium",
        status: "Assigned",
        workspace: "IT Service Request",
        ticketType: "asset_request",
        category: "Hardware Provisioning",
        subCategory: "Laptop Charger",
        itemCategory: "Laptop Charger",
        source: "Portal",
        groupId: infra,
        assigneeId: sydney,
        impact: "Medium",
        urgency: "Medium",
        createdAt: daysAgo(3),
        dueAt: daysAgo(1),
        firstRespondedAt: daysAgo(2.8),
        requestDetails: {
          catalogItem: "Laptop Charger",
          catalogCategory: "Hardware Provisioning",
        },
      },
      {
        key: "06",
        prefix: "INC",
        title: "WiFi drops in boardroom B",
        description:
          "Teams calls drop every few minutes in Boardroom B. Wired guest port works fine.",
        priority: "High",
        status: "Open",
        workspace: "IT",
        ticketType: "incident",
        category: "Network",
        subCategory: "Wifi Access",
        itemCategory: null,
        source: "Email",
        groupId: infra,
        assigneeId: null,
        impact: "High",
        urgency: "Medium",
        createdAt: hoursAgo(3),
        dueAt: hoursAgo(-21),
        firstRespondedAt: null,
      },
      {
        key: "07",
        prefix: "REQ",
        title: "BOM Updates",
        description:
          "Please update BOM linkage for stock code ATD-DEMO-1001 — parent/child quantities are wrong in Syspro.",
        priority: "Medium",
        status: "Waiting Approval",
        workspace: "IT Service Request",
        ticketType: "service_request",
        category: "Master Data Correction",
        subCategory: "BOM Updates",
        itemCategory: null,
        source: "Portal",
        groupId: erp,
        assigneeId: neo,
        impact: "Medium",
        urgency: "Medium",
        createdAt: daysAgo(1),
        dueAt: hoursAgo(-12),
        firstRespondedAt: hoursAgo(20),
        requestDetails: {
          catalogItem: "BOM Updates",
          catalogCategory: "Syspro",
          stockCode: "ATD-DEMO-1001",
        },
        comment:
          "Logged with ERP master data. Approval needed before the BOM change is applied.",
      },
      {
        key: "08",
        prefix: "INC",
        title: "Outlook mailbox full warning",
        description:
          "Receiving mailbox almost full warnings. Need archive guidance or quota increase.",
        priority: "Low",
        status: "Resolved",
        workspace: "IT",
        ticketType: "incident",
        category: "Office Applications",
        subCategory: "Office365",
        itemCategory: "Mailbox",
        source: "Portal",
        groupId: infra,
        assigneeId: sydney,
        impact: "Low",
        urgency: "Low",
        createdAt: daysAgo(8),
        dueAt: daysAgo(6),
        firstRespondedAt: daysAgo(7.5),
        resolvedAt: daysAgo(6),
        comment:
          "Quota increased and archive mailbox enabled. Please confirm the warning is gone.",
      },
      {
        key: "09",
        prefix: "CHG",
        title: "Schedule firewall rule for QMuzik reporting host",
        description:
          "Change request to allow outbound HTTPS from finance VLAN to the QMuzik reporting host for month-end packs.",
        priority: "High",
        status: "Waiting Approval",
        workspace: "Change Management",
        ticketType: "change",
        category: "Change",
        subCategory: "Network",
        itemCategory: null,
        source: "Portal",
        groupId: infra,
        assigneeId: sydney,
        impact: "High",
        urgency: "Medium",
        createdAt: hoursAgo(40),
        dueAt: hoursAgo(-80),
        firstRespondedAt: hoursAgo(36),
        requestDetails: {
          changeType: "Major",
          changePlan: "Add temporary allow rule, validate reporting, then document permanent rule.",
          backoutPlan: "Remove the temporary rule and restore prior ACL.",
        },
      },
      {
        key: "10",
        prefix: "INC",
        title: "Laptop battery drains unusually fast",
        description:
          "Battery drops from 100% to 20% within two hours on light Office work. Started after last Windows update.",
        priority: "Medium",
        status: "Closed",
        workspace: "IT",
        ticketType: "incident",
        category: "Hardware /Equipment",
        subCategory: "Laptop / Computer",
        itemCategory: null,
        source: "Portal",
        groupId: infra,
        assigneeId: sydney,
        impact: "Medium",
        urgency: "Low",
        createdAt: daysAgo(14),
        dueAt: daysAgo(12),
        firstRespondedAt: daysAgo(13.5),
        resolvedAt: daysAgo(11),
        closedAt: daysAgo(10),
        comment:
          "Power plan reset and battery calibration completed. Closing after your confirmation.",
      },
    ];

    const created = [];

    for (const ticket of tickets) {
      const sequence = await client.query(
        `SELECT nextval(pg_get_serial_sequence('tickets','id')) AS next_id`
      );
      const nextId = Number(sequence.rows[0].next_id);
      const ticketRef = `${ticket.prefix}-${String(nextId).padStart(5, "0")}`;
      const externalId = `${DEMO_PREFIX}-${ticket.key}`;
      const details = {
        demoSeed: DEMO_PREFIX,
        demoFor: email,
        ...(ticket.requestDetails || {}),
      };

      await client.query(
        `INSERT INTO tickets (
           id, ticket_ref, title, description, priority, status,
           requester_id, created_by_user_id, assigned_to_user_id, assigned_group_id,
           workspace, due_at, closed_at, resolved_at, first_responded_at,
           origin, category, sub_category, item_category, source, ticket_type,
           impact, urgency, request_details, external_id, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,
           $7,$7,$8,$9,
           $10,$11,$12,$13,$14,
           'helpdesk',$15,$16,$17,$18,$19,
           $20,$21,$22::jsonb,$23,$24,$24
         )`,
        [
          nextId,
          ticketRef,
          ticket.title,
          ticket.description,
          ticket.priority,
          ticket.status,
          user.id,
          ticket.assigneeId,
          ticket.groupId,
          ticket.workspace,
          ticket.dueAt,
          ticket.closedAt || null,
          ticket.resolvedAt || null,
          ticket.firstRespondedAt,
          ticket.category,
          ticket.subCategory,
          ticket.itemCategory,
          ticket.source,
          ticket.ticketType,
          ticket.impact,
          ticket.urgency,
          JSON.stringify(details),
          externalId,
          ticket.createdAt,
        ]
      );

      await client.query(
        `INSERT INTO ticket_history (ticket_id, actor_user_id, action, old_value, new_value, created_at)
         VALUES ($1,$2,'created',NULL,$3,$4)`,
        [nextId, user.id, ticket.status, ticket.createdAt]
      );

      if (ticket.assigneeId || ticket.groupId) {
        await client.query(
          `INSERT INTO ticket_history (ticket_id, actor_user_id, action, old_value, new_value, created_at)
           VALUES ($1,$2,'assigned','Unassigned · No group',$3,$4)`,
          [
            nextId,
            ticket.assigneeId || user.id,
            `User #${ticket.assigneeId || "none"} · Group #${ticket.groupId}`,
            ticket.firstRespondedAt || ticket.createdAt,
          ]
        );
      }

      if (ticket.comment) {
        await client.query(
          `INSERT INTO ticket_comments (
             ticket_id, author_user_id, body, is_internal, created_at,
             author_name, author_email, origin
           ) VALUES ($1,$2,$3,FALSE,$4,$5,$6,'helpdesk')`,
          [
            nextId,
            ticket.assigneeId || sydney,
            ticket.comment,
            ticket.firstRespondedAt || hoursAgo(1),
            ticket.assigneeId === neo ? "Neo Kgopa" : "Sydney Nkwana",
            ticket.assigneeId === neo
              ? "neok@atdalliance.co.za"
              : "sydneyn@atdalliance.co.za",
          ]
        );
      }

      created.push({ id: nextId, ticket_ref: ticketRef, title: ticket.title, status: ticket.status });
    }

    const openTicket = created.find((row) => row.status === "Investigating") || created[0];
    const notifications = [
      {
        message: `[Demo] Agent replied on ${openTicket.ticket_ref}: ${openTicket.title}`,
        type: "info",
        targetType: "ticket",
        targetId: openTicket.id,
        targetUrl: `/tickets/${openTicket.id}`,
        createdAt: hoursAgo(4),
      },
      {
        message: `[Demo] Your VPN Access request is waiting in the Infrastructure queue.`,
        type: "info",
        targetType: "ticket",
        targetId: created.find((row) => row.title === "VPN Access")?.id || openTicket.id,
        targetUrl: `/tickets/${created.find((row) => row.title === "VPN Access")?.id || openTicket.id}`,
        createdAt: hoursAgo(9),
      },
      {
        message: `[Demo] Change ${created.find((row) => row.title.includes("firewall"))?.ticket_ref || ""} needs approval before implementation.`,
        type: "warning",
        targetType: "ticket",
        targetId: created.find((row) => row.title.includes("firewall"))?.id || openTicket.id,
        targetUrl: `/tickets/${created.find((row) => row.title.includes("firewall"))?.id || openTicket.id}`,
        createdAt: hoursAgo(35),
      },
    ];

    for (const note of notifications) {
      await client.query(
        `INSERT INTO notifications (
           user_id, target_role, type, module, message,
           target_type, target_id, target_url, attachment_count, is_read, created_at
         ) VALUES ($1, NULL, $2, 'helpdesk', $3, $4, $5, $6, 0, FALSE, $7)`,
        [
          user.id,
          note.type,
          note.message,
          note.targetType,
          note.targetId,
          note.targetUrl,
          note.createdAt,
        ]
      );
    }

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          ok: true,
          user: { id: user.id, email: user.email, name: user.name },
          removedPriorDemoTickets: removedTickets.rows.length,
          createdTickets: created,
          notifications: notifications.length,
          note: "Assets for this account are served by the demo AMS fallback in assets.js (no DB/AMS writes).",
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Demo seed failed:", error.message);
  process.exit(1);
});
