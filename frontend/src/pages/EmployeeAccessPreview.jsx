import {
  useEffect,
  useState,
} from "react";
import {
  CheckCircle2,
  HardDrive,
  Search,
  ShieldCheck,
  Ticket,
  User,
  XCircle,
} from "lucide-react";

import { userApi } from "../services/api";

const SEARCH_DEBOUNCE_MS = 250;
const MINIMUM_SEARCH_LENGTH = 2;

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function getErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage
  );
}

function formatAccessLabel(accessKey) {
  return accessKey
    .split("_")
    .map((word) => {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export default function EmployeeAccessPreview() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [preview, setPreview] = useState(null);

  const [searching, setSearching] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const normalizedSearch = searchQuery.trim();

    if (normalizedSearch.length < MINIMUM_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;

    const debounceTimer = setTimeout(async () => {
      setSearching(true);
      setError("");

      try {
        const response = await userApi.getUsers({
          search: normalizedSearch,
          role: "user",
          limit: 20,
        });

        if (!cancelled) {
          setSearchResults(
            Array.isArray(response.data)
              ? response.data
              : []
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              requestError,
              "Failed to search employees."
            )
          );
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [searchQuery]);

  const loadEmployeePreview = async (employee) => {
    setSelectedEmployee(employee);
    setPreview(null);
    setPreviewLoading(true);
    setError("");

    try {
      const response = await userApi.getEmployeePreview(employee.id);
      setPreview(response.data);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Failed to load the employee access preview."
        )
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-5 text-slate-900 xl:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold text-blue-700">
            Administration
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Employee Access Preview
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Review the information and modules available to an employee without
            creating an impersonated session or allowing write operations.
          </p>
        </header>

        {error && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label
              htmlFor="employee-access-search"
              className="text-sm font-bold text-slate-700"
            >
              Find an employee
            </label>

            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                id="employee-access-search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                }}
                placeholder="Search name, email or employee number..."
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="mt-3 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
              {searching && (
                <p className="p-4 text-sm text-slate-500">
                  Searching employees...
                </p>
              )}

              {!searching &&
                searchQuery.trim().length >= MINIMUM_SEARCH_LENGTH &&
                searchResults.length === 0 && (
                  <p className="p-4 text-sm text-slate-500">
                    No matching employees found.
                  </p>
                )}

              {searchResults.map((employee) => {
                const isSelected =
                  selectedEmployee?.id === employee.id;

                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => loadEmployeePreview(employee)}
                    className={classNames(
                      "w-full p-3 text-left transition hover:bg-slate-50",
                      isSelected && "bg-blue-50"
                    )}
                  >
                    <p className="font-bold text-slate-950">
                      {employee.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {employee.email}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {employee.department || "No department"}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-5 lg:col-span-2">
            {previewLoading && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600 shadow-sm">
                Loading employee preview...
              </div>
            )}

            {!previewLoading && preview && (
              <>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

                    <div>
                      <p className="font-bold">
                        Read-only employee preview
                      </p>

                      <p className="mt-1 text-sm text-blue-800">
                        Viewing access for {selectedEmployee?.name}. No
                        employee session has been created and no changes can be
                        made from this preview.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <PreviewMetricCard
                    icon={Ticket}
                    label="Visible Tickets"
                    value={preview.summary?.ticketCount ?? 0}
                  />

                  <PreviewMetricCard
                    icon={HardDrive}
                    label="Visible Assets"
                    value={preview.summary?.assetCount ?? "Pending AMS Link"}
                  />

                  <PreviewMetricCard
                    icon={User}
                    label="Portal Role"
                    value={preview.user?.role || "user"}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">
                        Employee Profile
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Identity and employment information available to the
                        Helpdesk.
                      </p>
                    </div>

                    <StatusPill
                      active={preview.user?.status === "active"}
                      activeText="Portal Active"
                      inactiveText="Portal Inactive"
                    />
                  </div>

                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <ProfileDetail
                      label="Employee Number"
                      value={preview.user?.employee_number}
                    />
                    <ProfileDetail
                      label="Email"
                      value={preview.user?.email}
                    />
                    <ProfileDetail
                      label="Department"
                      value={preview.user?.department}
                    />
                    <ProfileDetail
                      label="Job Title"
                      value={preview.user?.job_title}
                    />
                    <ProfileDetail
                      label="Site"
                      value={preview.user?.site}
                    />
                    <ProfileDetail
                      label="Microsoft Status"
                      value={
                        preview.user?.microsoft_account_enabled === false
                          ? "Disabled"
                          : "Active"
                      }
                    />
                  </dl>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-950">
                    Access Matrix
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Allowed and blocked modules for the selected employee role.
                  </p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {Object.entries(preview.access || {}).map(
                      ([accessKey, allowed]) => (
                        <div
                          key={accessKey}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                        >
                          <span className="text-sm font-semibold capitalize text-slate-700">
                            {formatAccessLabel(accessKey)}
                          </span>

                          {allowed ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                          ) : (
                            <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </>
            )}

            {!previewLoading && !preview && (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
                Select an employee to inspect read-only portal access.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function PreviewMetricCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="inline-flex rounded-xl bg-blue-100 p-2.5 text-blue-700">
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-2xl font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function ProfileDetail({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </dt>

      <dd className="mt-1 font-semibold text-slate-900">
        {value || "Not available"}
      </dd>
    </div>
  );
}

function StatusPill({ active, activeText, inactiveText }) {
  return (
    <span
      className={classNames(
        "rounded-full px-2.5 py-1 text-xs font-bold",
        active
          ? "bg-emerald-100 text-emerald-800"
          : "bg-red-100 text-red-700"
      )}
    >
      {active ? activeText : inactiveText}
    </span>
  );
}
