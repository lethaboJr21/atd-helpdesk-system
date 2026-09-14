import { useNavigate } from "react-router-dom";
import OperationsShell from "../components/OperationsShell";
import OperationalTicketMonitor from "../components/tickets/OperationalTicketMonitor";
export default function TicketMonitorPage(){
 const navigate=useNavigate();
 return <OperationsShell breadcrumb="Helpdesk / Ticket Monitor" title="Ticket Monitor" subtitle="Today-first operational view with lifecycle, Department and Agent filters." contentClassName="px-3 py-3 lg:px-5 lg:py-4">
  <OperationalTicketMonitor standalone onOpenTicket={(id)=>navigate(`/tickets/${id}`)} onApplyShortcut={(shortcut)=>{const q=new URLSearchParams();if(shortcut.assignment)q.set("assignment",shortcut.assignment);if(shortcut.priority)q.set("priority",shortcut.priority);if(shortcut.statuses)q.set("statuses",shortcut.statuses);if(shortcut.source)q.set("source",shortcut.source);navigate(`/tickets?${q.toString()}`);}} />
 </OperationsShell>;
}
