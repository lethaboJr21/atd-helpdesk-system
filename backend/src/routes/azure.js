// 🚀 Key improvements applied:
// - safer API handling
// - normalized status/priority
// - proper ticket age
// - stable filtering

/* function normalize(value) {
  return (value || "").toLowerCase();
}

function getTicketAge(ticket) {
  if (!ticket.created_at) return "—";
  const created = new Date(ticket.created_at).getTime();
  return formatDuration(Date.now() - created);
}

const filteredTickets = useMemo(() => {
  return tickets.filter((ticket) => {
    const text = [
      ticket.ticket_ref,
      ticket.title,
      ticket.description,
      ticket.requester_name,
      ticket.assigned_to_name,
      ticket.assigned_group_name,
      ticket.workspace,
      ticket.priority,
      ticket.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      text.includes(query.toLowerCase()) &&
      (workspaceFilter === "All" || ticket.workspace === workspaceFilter)
    );
  });
}, [tickets, query, workspaceFilter]);

*/

const express = require("express");
const router = express.Router();

const { getUsers } = require("../services/azureUsers");

router.get("/users", async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (err) {
    console.error("Azure error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Azure fetch failed",
      details: err.response?.data || err.message,
    });
  }
});

module.exports = router;