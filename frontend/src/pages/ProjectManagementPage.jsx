import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardPlus,
  FolderKanban,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import OperationsShell from "../components/OperationsShell";
import CompanyAnnouncements from "../components/dashboard/CompanyAnnouncements";
import { projectManagementApi, ticketsApi } from "../services/api";

const EMPTY_PROJECT = { name: "", description: "", startDate: "", dueDate: "" };
const EMPTY_TASK = {
  title: "",
  description: "",
  taskType: "deliverable",
  ownerUserId: "",
  dueDate: "",
  priority: "Medium",
};
const EMPTY_ANNOUNCEMENT = { title: "", body: "" };
const STATUS_LABELS = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

function errorText(error) {
  return error?.response?.data?.error || error?.message || "The project workspace request failed.";
}

function dateLabel(value) {
  return value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString() : "No date";
}

function dateInputValue(value) {
  return value ? String(value).slice(0, 10) : "";
}

function roleLabel(role) {
  return ({
    owner: "Owner",
    project_manager: "Project manager",
    contributor: "Contributor",
    viewer: "Viewer",
    admin: "Administrator",
  })[role] || role;
}

function ticketDetails(ticket) {
  if (ticket?.request_details && typeof ticket.request_details === "object") return ticket.request_details;
  try {
    return JSON.parse(ticket?.request_details || "{}");
  } catch {
    return {};
  }
}

export default function ProjectManagementPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [workspace, setWorkspace] = useState(null);
  const [projectTickets, setProjectTickets] = useState([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [projectStatusDraft, setProjectStatusDraft] = useState("planning");
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [announcementForm, setAnnouncementForm] = useState(EMPTY_ANNOUNCEMENT);
  const [taskDrafts, setTaskDrafts] = useState({});
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRole, setMemberRole] = useState("contributor");
  const [memberCandidates, setMemberCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProjects = useCallback(async (preferredId = "") => {
    const response = await projectManagementApi.getProjects();
    const nextProjects = response.data.projects || [];
    setProjects(nextProjects);
    const available = nextProjects.some((project) => String(project.id) === String(preferredId))
      ? String(preferredId)
      : nextProjects.some((project) => String(project.id) === String(selectedId))
        ? String(selectedId)
        : String(nextProjects[0]?.id || "");
    setSelectedId(available);
  }, [selectedId]);

  const loadWorkspace = useCallback(async (projectId = selectedId) => {
    if (!projectId) {
      setWorkspace(null);
      setProjectTickets([]);
      return;
    }
    const response = await projectManagementApi.getWorkspace(projectId);
    setWorkspace(response.data);
    setProjectStatusDraft(response.data.project.status);
    setTaskDrafts(Object.fromEntries((response.data.tasks || []).map((task) => [
      task.id,
      { status: task.status, progressPercent: Number(task.progress_percent || 0) },
    ])));
    setTicketLoading(true);
    setTicketError("");
    try {
      const ticketResponse = await ticketsApi.getMine();
      const ticketRows = Array.isArray(ticketResponse.data) ? ticketResponse.data : ticketResponse.data?.tickets || [];
      setProjectTickets(ticketRows.filter((ticket) => String(ticketDetails(ticket).projectWorkspaceId) === String(projectId)));
    } catch (requestError) {
      setProjectTickets([]);
      setTicketError(errorText(requestError));
    } finally {
      setTicketLoading(false);
    }
  }, [selectedId]);

  const refresh = useCallback(async (preferredId = selectedId) => {
    setLoading(true);
    setError("");
    try {
      await loadProjects(preferredId);
      if (preferredId) await loadWorkspace(preferredId);
      else if (selectedId) await loadWorkspace(selectedId);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, [loadProjects, loadWorkspace, selectedId]);

  useEffect(() => {
    refresh("");
  }, []); // Initial load only; project selection loads its workspace separately.

  useEffect(() => {
    if (!selectedId) {
      setWorkspace(null);
      setProjectTickets([]);
      return;
    }
    let active = true;
    setLoading(true);
    setTicketLoading(true);
    setTicketError("");
    projectManagementApi.getWorkspace(selectedId)
      .then((response) => {
        if (!active) return;
        setWorkspace(response.data);
        setProjectStatusDraft(response.data.project.status);
        setTaskDrafts(Object.fromEntries((response.data.tasks || []).map((task) => [
          task.id,
          { status: task.status, progressPercent: Number(task.progress_percent || 0) },
        ])));
      })
      .catch((requestError) => {
        if (active) setError(errorText(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    ticketsApi.getMine()
      .then((response) => {
        if (!active) return;
        const ticketRows = Array.isArray(response.data) ? response.data : response.data?.tickets || [];
        setProjectTickets(ticketRows.filter((ticket) => String(ticketDetails(ticket).projectWorkspaceId) === String(selectedId)));
      })
      .catch((requestError) => {
        if (!active) return;
        setProjectTickets([]);
        setTicketError(errorText(requestError));
      })
      .finally(() => {
        if (active) setTicketLoading(false);
      });
    return () => { active = false; };
  }, [selectedId]);

  const contributingMembers = useMemo(
    () => (workspace?.members || []).filter((member) => member.member_role !== "viewer"),
    [workspace?.members],
  );
  const canManage = Boolean(workspace?.access?.canManage && workspace?.project?.status !== "archived");
  const metrics = workspace?.metrics || { total: 0, completed: 0, blocked: 0, overdue: 0, averageProgress: 0, completionPercent: 0 };
  const statusCounts = useMemo(() => {
    const counts = { not_started: 0, in_progress: 0, blocked: 0, done: 0 };
    (workspace?.tasks || []).forEach((task) => { counts[task.status] = (counts[task.status] || 0) + 1; });
    return counts;
  }, [workspace?.tasks]);

  const createProject = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await projectManagementApi.createProject(projectForm);
      setProjectForm(EMPTY_PROJECT);
      setNotice("Project created. You are its owner; add members to grant project-only access.");
      await loadProjects(String(response.data.id));
      setSelectedId(String(response.data.id));
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const reloadWorkspace = async (message) => {
    setError("");
    try {
      await loadProjects(selectedId);
      await loadWorkspace(selectedId);
      if (message) setNotice(message);
    } catch (requestError) {
      setError(errorText(requestError));
    }
  };

  const createTask = async (event) => {
    event.preventDefault();
    if (!taskForm.ownerUserId || !taskForm.dueDate) {
      setError("Every task or deliverable needs one accountable owner and a due date.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await projectManagementApi.createTask(selectedId, {
        ...taskForm,
        ownerUserId: Number(taskForm.ownerUserId),
      });
      setTaskForm(EMPTY_TASK);
      await reloadWorkspace("Task or deliverable allocated and logged.");
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (taskId) => {
    const draft = taskDrafts[taskId];
    if (!draft) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await projectManagementApi.updateTask(selectedId, taskId, {
        status: draft.status,
        progressPercent: Number(draft.progressPercent),
      });
      await reloadWorkspace("Task progress saved to the project activity log.");
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const searchMembers = async (event) => {
    event.preventDefault();
    if (memberSearch.trim().length < 2) {
      setError("Enter at least two characters to find an employee.");
      return;
    }
    setError("");
    try {
      const response = await projectManagementApi.searchMembers(selectedId, memberSearch.trim());
      setMemberCandidates(response.data.candidates || []);
    } catch (requestError) {
      setError(errorText(requestError));
    }
  };

  const addMember = async (candidate) => {
    setSaving(true);
    setError("");
    try {
      await projectManagementApi.addMember(selectedId, { userId: candidate.id, role: memberRole });
      setMemberCandidates((current) => current.filter((item) => item.id !== candidate.id));
      await reloadWorkspace(`${candidate.name} added as ${roleLabel(memberRole).toLowerCase()}.`);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member) => {
    setSaving(true);
    setError("");
    try {
      await projectManagementApi.removeMember(selectedId, member.user_id);
      await reloadWorkspace(`${member.name} removed from the project.`);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const publishAnnouncement = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await projectManagementApi.createAnnouncement(selectedId, announcementForm);
      setAnnouncementForm(EMPTY_ANNOUNCEMENT);
      await reloadWorkspace("Announcement published to project members.");
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const saveProjectStatus = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await projectManagementApi.updateProjectStatus(selectedId, projectStatusDraft);
      await reloadWorkspace("Project status updated and recorded in the activity log.");
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const raiseProjectTicket = () => {
    if (!workspace) return;
    navigate("/incidents/new", {
      state: {
        prefillTitle: `IT support for ${workspace.project.name}`,
        prefillDescription: `Requesting IT support related to project "${workspace.project.name}" (#${workspace.project.id}).\n\nDescribe the issue, impact, and any steps already tried.`,
        workspaceTicketContext: {
          projectId: workspace.project.id,
          projectName: workspace.project.name,
          source: "Project Workspace",
        },
      },
    });
  };

  return (
    <OperationsShell>
      <main className="h-full overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950 xl:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-800 p-7 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.22em] text-indigo-200">Member-only workspace</p>
                <h1 className="mt-2 text-3xl font-black">Project Management</h1>
                <p className="mt-2 max-w-3xl text-sm text-indigo-50">
                  Coordinate communication, allocate accountable owners, monitor deliverables, and keep an auditable project activity trail.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {workspace && <button type="button" onClick={raiseProjectTicket} className="flex items-center gap-2 rounded-xl bg-indigo-400 px-4 py-2 text-sm font-bold text-indigo-950 hover:bg-indigo-300"><Ticket className="h-4 w-4" /> Raise IT support ticket</button>}
                <button type="button" onClick={() => refresh()} className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
              </div>
            </div>
          </header>

          <CompanyAnnouncements />

          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

          <section className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-bold text-slate-900">Your projects</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{projects.length}</span>
                </div>
                {projects.length === 0 && !loading && <p className="text-sm text-slate-500">No member projects yet.</p>}
                <div className="space-y-2">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => { setWorkspace(null); setSelectedId(String(project.id)); setError(""); setNotice(""); }}
                      className={`w-full rounded-xl border p-3 text-left transition ${String(project.id) === String(selectedId) ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
                    >
                      <span className="block truncate text-sm font-bold text-slate-900">{project.name}</span>
                      <span className="mt-1 flex justify-between text-xs text-slate-500">
                        <span>{roleLabel(project.member_role || "admin")}</span>
                        <span>{project.completed_count || 0}/{project.task_count || 0} done</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={createProject} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-indigo-700" />
                  <h2 className="font-bold text-slate-900">Create a project</h2>
                </div>
                <input className="input" required minLength={2} maxLength={180} placeholder="Project name" value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} />
                <textarea className="input min-h-20" maxLength={5000} placeholder="Purpose and scope" value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-slate-600">Start date<input className="input mt-1 text-sm" type="date" value={projectForm.startDate} onChange={(event) => setProjectForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
                  <label className="text-xs font-semibold text-slate-600">Target date<input className="input mt-1 text-sm" type="date" value={projectForm.dueDate} onChange={(event) => setProjectForm((current) => ({ ...current, dueDate: event.target.value }))} /></label>
                </div>
                <button disabled={saving} className="w-full rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Create project</button>
              </form>
            </aside>

            <section className="min-w-0 space-y-5">
              {loading && !workspace ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading project workspace…</div>
              ) : !workspace ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <FolderKanban className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 font-semibold text-slate-700">Select or create a project to get started.</p>
                </div>
              ) : (
                <>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">{roleLabel(workspace.access.role)}</p>
                        <h2 className="mt-1 text-2xl font-black text-slate-900">{workspace.project.name}</h2>
                        <p className="mt-1 max-w-3xl text-sm text-slate-600">{workspace.project.description || "No project scope has been added."}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div className="flex items-center justify-end gap-1"><CalendarDays className="h-4 w-4" /> Target {dateLabel(workspace.project.due_date)}</div>
                        {canManage ? (
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <select disabled={workspace.project.status === "archived"} className="input py-1 text-xs capitalize disabled:opacity-60" value={projectStatusDraft} onChange={(event) => setProjectStatusDraft(event.target.value)}>
                              <option value="planning">Planning</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option><option value="archived">Archived</option>
                            </select>
                            <button type="button" onClick={saveProjectStatus} disabled={saving || workspace.project.status === "archived"} className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-bold text-white disabled:opacity-50">Save</button>
                          </div>
                        ) : <div className="mt-1 capitalize">Status: {workspace.project.status.replace("_", " ")}</div>}
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {[
                        ["Deliverables", metrics.total, ClipboardPlus],
                        ["Completed", metrics.completed, CheckCircle2],
                        ["Blocked", metrics.blocked, CircleAlert],
                        ["Overdue", metrics.overdue, CalendarDays],
                        ["Average progress", `${metrics.averageProgress}%`, BarChart3],
                      ].map(([label, value, Icon]) => (
                        <div key={label} className="rounded-xl bg-slate-50 p-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>{label}</span><Icon className="h-4 w-4 text-indigo-600" /></div>
                          <div className="mt-1 text-xl font-black text-slate-900">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600"><span>Overall completion</span><span>{metrics.completionPercent}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${metrics.completionPercent}%` }} /></div>
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {Object.entries(STATUS_LABELS).map(([status, label]) => (
                          <div key={status} className="rounded-lg border border-slate-100 p-2 text-center">
                            <div className="text-base font-bold text-slate-800">{statusCounts[status]}</div>
                            <div className="text-[10px] text-slate-500">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
                    <div className="space-y-5">
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2"><ClipboardPlus className="h-5 w-5 text-indigo-700" /><div><h3 className="font-bold text-slate-900">Tasks and deliverables</h3><p className="text-xs text-slate-500">Every item has one accountable owner and a due date.</p></div></div>
                        {canManage && (
                          <form onSubmit={createTask} className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
                            <input className="input" required minLength={2} maxLength={240} placeholder="Task or deliverable" value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
                            <div className="grid grid-cols-2 gap-2">
                              <select className="input" value={taskForm.taskType} onChange={(event) => setTaskForm((current) => ({ ...current, taskType: event.target.value }))}><option value="deliverable">Deliverable</option><option value="task">Task</option></select>
                              <select className="input" value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
                            </div>
                            <textarea className="input min-h-16 md:col-span-2" maxLength={5000} placeholder="Description / acceptance notes" value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} />
                            <select className="input" required value={taskForm.ownerUserId} onChange={(event) => setTaskForm((current) => ({ ...current, ownerUserId: event.target.value }))}>
                              <option value="">Select accountable owner</option>
                              {contributingMembers.map((member) => <option key={member.user_id} value={member.user_id}>{member.name} · {roleLabel(member.member_role)}</option>)}
                            </select>
                            <input className="input" required type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} aria-label="Deliverable due date" />
                            <button disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 md:col-span-2"><Plus className="h-4 w-4" /> Allocate task / deliverable</button>
                          </form>
                        )}
                        {workspace.tasks.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No deliverables tracked yet.</p> : (
                          <div className="space-y-3">
                            {workspace.tasks.map((task) => {
                              const editable = workspace.project.status !== "archived" && (canManage || Number(task.owner_user_id) === Number(workspace.access.currentUserId));
                              const draft = taskDrafts[task.id] || { status: task.status, progressPercent: Number(task.progress_percent || 0) };
                              return (
                                <article key={task.id} className="rounded-xl border border-slate-200 p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-bold text-slate-900">{task.title}</h4>
                                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">{task.task_type}</span>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{task.priority}</span>
                                      </div>
                                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{task.description || "No description"}</p>
                                      <p className="mt-2 text-xs text-slate-500">Owner: <strong>{task.owner_name}</strong> · Due: <strong>{dateLabel(task.due_date)}</strong></p>
                                    </div>
                                    <div className="min-w-[220px] space-y-2">
                                      <div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{STATUS_LABELS[task.status]}</span><span className="font-bold text-slate-700">{task.progress_percent}%</span></div>
                                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${task.status === "blocked" ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${task.progress_percent}%` }} /></div>
                                      {editable && (
                                        <div className="flex gap-2">
                                          <select className="input min-w-0 py-1 text-xs" value={draft.status} onChange={(event) => setTaskDrafts((current) => ({ ...current, [task.id]: { ...draft, status: event.target.value, progressPercent: event.target.value === "done" ? 100 : draft.status === "done" ? 0 : draft.progressPercent } }))}>
                                            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                          </select>
                                          <input aria-label="Task progress percent" className="input w-16 py-1 text-xs" type="number" min="0" max="100" value={draft.progressPercent} disabled={draft.status === "done"} onChange={(event) => setTaskDrafts((current) => ({ ...current, [task.id]: { ...draft, progressPercent: event.target.value } }))} />
                                          <button type="button" onClick={() => updateTask(task.id)} disabled={saving} className="shrink-0 rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Save</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </section>

                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-700" /><h3 className="font-bold text-slate-900">Project activity log</h3></div>
                        {workspace.activity.length === 0 ? <p className="text-sm text-slate-500">Project changes will be recorded here.</p> : (
                          <ol className="space-y-3">
                            {workspace.activity.slice(0, 20).map((event) => (
                              <li key={event.id} className="flex gap-3 border-l-2 border-indigo-100 pl-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-800">{event.actor_name || "System"} · {String(event.event_type).replace(".", " ")}</p>
                                  <p className="truncate text-xs text-slate-500">{event.details?.title || event.details?.name || event.details?.memberName || (event.entity_type === "task" || event.entity_type === "deliverable" ? "Task progress or planning updated" : "")}</p>
                                </div>
                                <time className="shrink-0 text-[10px] text-slate-400">{new Date(event.created_at).toLocaleString()}</time>
                              </li>
                            ))}
                          </ol>
                        )}
                      </section>
                    </div>

                    <div className="space-y-5">
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2"><Megaphone className="h-5 w-5 text-indigo-700" /><div><h3 className="font-bold text-slate-900">Project announcements</h3><p className="text-xs text-slate-500">Visible only to active project members.</p></div></div>
                        {canManage && (
                          <form onSubmit={publishAnnouncement} className="mb-4 space-y-2">
                            <input className="input" required maxLength={180} placeholder="Announcement title" value={announcementForm.title} onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))} />
                            <textarea className="input min-h-24" required maxLength={5000} placeholder="Update, decision, or project notice" value={announcementForm.body} onChange={(event) => setAnnouncementForm((current) => ({ ...current, body: event.target.value }))} />
                            <button disabled={saving} className="w-full rounded-xl bg-indigo-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Publish to members</button>
                          </form>
                        )}
                        <div className="space-y-3">
                          {workspace.announcements.length === 0 ? <p className="text-sm text-slate-500">No announcements yet.</p> : workspace.announcements.map((announcement) => (
                            <article key={announcement.id} className="rounded-xl bg-slate-50 p-3">
                              <h4 className="text-sm font-bold text-slate-900">{announcement.title}</h4>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{announcement.body}</p>
                              <p className="mt-2 text-[10px] text-slate-400">{announcement.author_name} · {new Date(announcement.created_at).toLocaleString()}</p>
                            </article>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center gap-2"><Ticket className="h-5 w-5 text-indigo-700" /><div><h3 className="font-bold text-slate-900">IT support tickets</h3><p className="text-xs text-slate-500">Tickets you raised for this project; fulfillment stays in the IT queue.</p></div></div>
                        {ticketError && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Ticket tracking could not be loaded: {ticketError}</p>}
                        {ticketLoading ? <p className="py-3 text-sm text-slate-500">Loading project tickets…</p> : projectTickets.length === 0 ? <p className="py-3 text-sm text-slate-500">No IT support tickets have been raised for this project.</p> : (
                          <div className="space-y-2">
                            {projectTickets.map((ticket) => (
                              <a key={ticket.id} href={`/helpdesk/tickets/${ticket.id}`} className="block rounded-xl border border-slate-100 p-3 hover:border-indigo-200 hover:bg-indigo-50">
                                <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-indigo-700">{ticket.ticket_ref}</span><span className="text-xs font-semibold text-slate-600">{ticket.status}</span></div>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{ticket.title}</p>
                                <p className="mt-1 text-[10px] text-slate-500">{ticket.priority} priority · {new Date(ticket.created_at).toLocaleDateString()}</p>
                              </a>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-indigo-700" /><h3 className="font-bold text-slate-900">Project members</h3></div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{workspace.members.length}</span>
                        </div>
                        {canManage && (
                          <div className="mb-4 space-y-2">
                            <form onSubmit={searchMembers} className="flex gap-2">
                              <input className="input min-w-0" minLength={2} placeholder="Find by name or email" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
                              <button aria-label="Search employees" className="rounded-lg bg-slate-900 px-3 text-white"><Search className="h-4 w-4" /></button>
                            </form>
                            {memberCandidates.length > 0 && (
                              <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                                <select className="input" value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option value="contributor">Contributor</option><option value="project_manager">Project manager</option><option value="viewer">Viewer</option></select>
                                {memberCandidates.map((candidate) => (
                                  <div key={candidate.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2">
                                    <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{candidate.name}</p><p className="truncate text-[10px] text-slate-500">{candidate.email}</p></div>
                                    <button type="button" onClick={() => addMember(candidate)} disabled={saving} className="rounded-lg bg-indigo-700 px-2 py-1 text-xs font-bold text-white disabled:opacity-50">Add</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="space-y-2">
                          {workspace.members.map((member) => (
                            <div key={member.user_id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-3">
                              <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{member.name}</p><p className="truncate text-xs text-slate-500">{member.email} · {roleLabel(member.member_role)}</p></div>
                              {canManage && member.member_role !== "owner" && <button type="button" onClick={() => removeMember(member)} disabled={saving} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">Remove</button>}
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                </>
              )}
            </section>
          </section>
        </div>
      </main>
    </OperationsShell>
  );
}
