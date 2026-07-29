import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  FileText,
  LifeBuoy,
  Settings,
  UploadCloud,
  Wrench,
  X,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  groupsApi,
  ticketsApi,
} from "../services/api";

const TICKET_TYPES = {
  incident: {
    title: "Report an Issue",
    description:
      "Report something that is broken, unavailable or working incorrectly.",
    icon: LifeBuoy,
    defaultWorkspace: "IT",
  },
  service_request: {
    title: "Request a Service",
    description:
      "Request access, software, equipment or another standard IT service.",
    icon: Wrench,
    defaultWorkspace: "IT Service Request",
  },
  change: {
    title: "Change Management Request",
    description:
      "Request a planned change that requires assessment and scheduling.",
    icon: Settings,
    defaultWorkspace: "Change Management",
  },
};

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

function normalizeTicketType(value) {
  return TICKET_TYPES[value]
    ? value
    : "incident";
}

export default function TicketCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const ticketType = normalizeTicketType(
    searchParams.get("type") ||
      location.state?.createMode
  );

  const ticketConfiguration =
    TICKET_TYPES[ticketType];

  const TicketTypeIcon =
    ticketConfiguration.icon;

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    workspace:
      ticketConfiguration.defaultWorkspace,
    assignedGroupId: "",
    assignedToUserId: "",
  });

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadGroups = async () => {
      try {
        const response = await groupsApi.getAll();

        if (!cancelled) {
          setGroups(
            Array.isArray(response.data)
              ? response.data
              : []
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError?.response?.data?.error ||
              "Support groups could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setGroupsLoading(false);
        }
      }
    };

    loadGroups();

    return () => {
      cancelled = true;
    };
  }, []);

  const fileSummary = useMemo(() => {
    const totalBytes = files.reduce(
      (total, file) => total + file.size,
      0
    );

    return {
      count: files.length,
      totalMegabytes: (
        totalBytes /
        1024 /
        1024
      ).toFixed(1),
    };
  }, [files]);

  const updateForm = (fieldName, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [fieldName]: value,
    }));
  };

  const validateAndAddFiles = (
    selectedFiles
  ) => {
    setError("");

    const incomingFiles = Array.from(
      selectedFiles || []
    );

    const acceptedFiles = [];

    for (const file of incomingFiles) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setError(
          "Only PNG, JPG, JPEG, WEBP and PDF files are allowed."
        );
        continue;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(
          `${file.name} is larger than 5 MB.`
        );
        continue;
      }

      acceptedFiles.push(file);
    }

    setFiles((currentFiles) => {
      const combinedFiles = [
        ...currentFiles,
        ...acceptedFiles,
      ];

      if (combinedFiles.length > MAX_FILES) {
        setError(
          `A maximum of ${MAX_FILES} files may be attached.`
        );
      }

      return combinedFiles.slice(0, MAX_FILES);
    });
  };

  const removeFile = (fileIndex) => {
    setFiles((currentFiles) => {
      return currentFiles.filter(
        (_file, index) => index !== fileIndex
      );
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("A short summary is required.");
      return;
    }

    if (!form.description.trim()) {
      setError("Please provide more information about the request.");
      return;
    }

    if (!form.assignedGroupId) {
      setError("Please select the support group that should receive this ticket.");
      return;
    }

    const confirmed = window.confirm(
      `Create this ${ticketConfiguration.title.toLowerCase()}?`
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await ticketsApi.create({
        ticketType,
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        workspace: form.workspace,
        assignedGroupId:
          form.assignedGroupId || null,
        assignedToUserId:
          form.assignedToUserId || null,
      });

      const createdTicket = response.data;

      // Secure multipart attachment upload is the next milestone.
      // Files remain client-side until the authenticated attachment endpoint exists.
      if (files.length > 0) {
        console.info(
          `${files.length} attachment(s) selected and awaiting the secure upload endpoint.`
        );
      }

      navigate(`/tickets/${createdTicket.id}`);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to create the ticket."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-5 text-slate-900 xl:p-8">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                <TicketTypeIcon className="h-7 w-7" />
              </div>

              <div>
                <p className="text-sm font-semibold text-blue-700">
                  New Helpdesk Ticket
                </p>

                <h1 className="mt-1 text-3xl font-bold text-slate-950">
                  {ticketConfiguration.title}
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {ticketConfiguration.description}
                </p>
              </div>
            </div>
          </header>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 p-6"
          >
            {error && (
              <div
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}

            <FormField
              label="Short Summary"
              required
            >
              <input
                value={form.title}
                onChange={(event) => {
                  updateForm(
                    "title",
                    event.target.value
                  );
                }}
                maxLength={180}
                placeholder="Briefly describe what is needed"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </FormField>

            <FormField
              label="Detailed Description"
              required
              helpText="Include what happened, when it started, the impact and any troubleshooting already attempted."
            >
              <textarea
                value={form.description}
                onChange={(event) => {
                  updateForm(
                    "description",
                    event.target.value
                  );
                }}
                rows={8}
                maxLength={5000}
                placeholder="Provide enough information for the support team to begin investigating"
                className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </FormField>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Support Group" required>
                <select
                  value={form.assignedGroupId}
                  disabled={groupsLoading}
                  onChange={(event) => {
                    updateForm(
                      "assignedGroupId",
                      event.target.value
                    );
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <option value="">
                    {groupsLoading
                      ? "Loading support groups..."
                      : "Select support group"}
                  </option>

                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Priority">
                <select
                  value={form.priority}
                  onChange={(event) => {
                    updateForm(
                      "priority",
                      event.target.value
                    );
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </FormField>

              <FormField label="Workspace">
                <input
                  value={form.workspace}
                  onChange={(event) => {
                    updateForm(
                      "workspace",
                      event.target.value
                    );
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </FormField>
            </div>

            <FormField
              label="Attachments"
              helpText="Up to 5 files. PNG, JPG, JPEG, WEBP or PDF. Maximum 5 MB per file."
            >
              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  validateAndAddFiles(
                    event.dataTransfer.files
                  );
                }}
                className={
                  dragActive
                    ? "rounded-2xl border-2 border-dashed border-blue-500 bg-blue-50 p-8 text-center"
                    : "rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center"
                }
              >
                <UploadCloud className="mx-auto h-9 w-9 text-blue-700" />

                <p className="mt-3 font-bold text-slate-950">
                  Drag and drop files here
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  or choose files from the computer
                </p>

                <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                  Choose Files
                  <input
                    type="file"
                    multiple
                    accept={ALLOWED_FILE_TYPES.join(",")}
                    onChange={(event) => {
                      validateAndAddFiles(
                        event.target.files
                      );
                      event.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500">
                    {fileSummary.count} file(s) · {fileSummary.totalMegabytes} MB
                  </p>

                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="h-5 w-5 shrink-0 text-blue-700" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </FormField>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              File selection and previews are active. Secure server upload will be
              connected after the attachment migration and authenticated upload
              route are installed.
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating Ticket..." : "Review and Create Ticket"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  helpText,
  required = false,
  children,
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </span>

      {helpText && (
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {helpText}
        </span>
      )}

      <div className="mt-2">{children}</div>
    </label>
  );
}
