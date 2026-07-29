import {
  cloneElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  CheckCircle2,
  Edit3,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { azureApi, userApi } from "../services/api";

const DEFAULT_PAGE_SIZE = 50;
const TOAST_DURATION_MS = 5000;

const PAGE_SIZE_OPTIONS = [
  { label: "50 employees", value: 50 },
  { label: "100 employees", value: 100 },
  { label: "200 employees", value: 200 },
  { label: "All employees", value: "all" },
];

const EMPTY_FILTERS = {
  search: "",
  role: "",
  department: "",
  status: "",
  approved: "",
  microsoftEnabled: "",
  includeArchived: false,
};

const EMPTY_EDIT_FORM = {
  name: "",
  email: "",
  firstName: "",
  lastName: "",
  employeeNumber: "",
  jobTitle: "",
  department: "",
  managerName: "",
  officeLocation: "",
  site: "",
  mobilePhone: "",
  businessPhone: "",
  alternativeEmail: "",
  employmentStatus: "active",
  startDate: "",
  terminationDate: "",
  role: "user",
};

const INITIAL_META = {
  summary: {},
  departments: [],
  roles: [],
  employmentStatuses: [],
};

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

function formatDateTime(value) {
  if (!value) {
    return "â€”";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "â€”";
  }

  return parsedDate.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatInputDate(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function getRoleClassName(role) {
  const roleClasses = {
    superadmin: "bg-fuchsia-100 text-fuchsia-800",
    admin: "bg-purple-100 text-purple-800",
    manager: "bg-indigo-100 text-indigo-800",
    agent: "bg-emerald-100 text-emerald-800",
    operator: "bg-cyan-100 text-cyan-800",
    user: "bg-slate-100 text-slate-700",
  };

  return roleClasses[role] || "bg-slate-100 text-slate-700";
}

function mapUserToEditForm(user) {
  return {
    name: user.name || "",
    email: user.email || "",
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    employeeNumber: user.employee_number || "",
    jobTitle: user.job_title || "",
    department: user.department || "",
    managerName: user.manager_name || "",
    officeLocation: user.office_location || "",
    site: user.site || "",
    mobilePhone: user.mobile_phone || "",
    businessPhone: user.business_phone || "",
    alternativeEmail: user.alternative_email || "",
    employmentStatus: user.employment_status || "active",
    startDate: formatInputDate(user.start_date),
    terminationDate: formatInputDate(user.termination_date),
    role: user.role || "user",
  };
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const toastTimerRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(INITIAL_META);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [toast, setToast] = useState(null);
  const [syncSummary, setSyncSummary] = useState(null);

  const isSuperadmin = currentUser?.role === "superadmin";
  const canEditUsers = ["admin", "superadmin"].includes(currentUser?.role);

  const showToast = useCallback((type, message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({
      id: Date.now(),
      type,
      message,
    });

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const buildUserQueryParams = useCallback(() => {
    return {
      search: filters.search || undefined,
      role: filters.role || undefined,
      department: filters.department || undefined,
      status: filters.status || undefined,
      approved: filters.approved || undefined,
      microsoftEnabled: filters.microsoftEnabled || undefined,
      includeArchived: filters.includeArchived,
      limit: 500,
    };
  }, [filters]);

  const loadUsers = useCallback(
    async ({ showInitialLoader = false } = {}) => {
      if (showInitialLoader) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const [usersResponse, metaResponse] = await Promise.all([
          userApi.getUsers(buildUserQueryParams()),
          userApi.getMeta(),
        ]);

        setUsers(
          Array.isArray(usersResponse.data)
            ? usersResponse.data
            : []
        );

        setMeta(metaResponse.data || INITIAL_META);
      } catch (error) {
        showToast(
          "error",
          getErrorMessage(error, "Failed to load users.")
        );
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [buildUserQueryParams, showToast]
  );

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadUsers({ showInitialLoader: users.length === 0 });
    }, 250);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [filters, loadUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === "all") {
      return 1;
    }

    return Math.max(1, Math.ceil(users.length / pageSize));
  }, [pageSize, users.length]);

  const visibleUsers = useMemo(() => {
    if (pageSize === "all") {
      return users;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return users.slice(startIndex, endIndex);
  }, [currentPage, pageSize, users]);

  const visibleUserIds = useMemo(() => {
    return visibleUsers.map((userItem) => userItem.id);
  }, [visibleUsers]);

  const allVisibleUsersSelected = useMemo(() => {
    if (visibleUserIds.length === 0) {
      return false;
    }

    return visibleUserIds.every((userId) => {
      return selectedUserIds.includes(userId);
    });
  }, [selectedUserIds, visibleUserIds]);

  const permittedRoles = useMemo(() => {
    const availableRoles = meta.roles || [];

    if (isSuperadmin) {
      return availableRoles;
    }

    return availableRoles.filter((role) => {
      return !["admin", "superadmin"].includes(role);
    });
  }, [isSuperadmin, meta.roles]);

  const summaryCards = [
    {
      label: "Total Users",
      value: meta.summary?.total || 0,
      icon: Users,
      colorClass: "bg-blue-100 text-blue-700",
    },
    {
      label: "Active",
      value: meta.summary?.active || 0,
      icon: CheckCircle2,
      colorClass: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Pending Approval",
      value: meta.summary?.pending || 0,
      icon: UserCheck,
      colorClass: "bg-amber-100 text-amber-700",
    },
    {
      label: "Agents",
      value: meta.summary?.agents || 0,
      icon: ShieldCheck,
      colorClass: "bg-indigo-100 text-indigo-700",
    },
    {
      label: "Missing Departments",
      value: meta.summary?.missing_department || 0,
      icon: Filter,
      colorClass: "bg-orange-100 text-orange-700",
    },
    {
      label: "Archived",
      value: meta.summary?.archived || 0,
      icon: Archive,
      colorClass: "bg-slate-200 text-slate-700",
    },
  ];

  const setFilter = (filterName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [filterName]: value,
    }));
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((currentSelection) => {
      if (currentSelection.includes(userId)) {
        return currentSelection.filter((selectedId) => {
          return selectedId !== userId;
        });
      }

      return [...currentSelection, userId];
    });
  };

  const toggleVisibleUserSelection = () => {
    setSelectedUserIds((currentSelection) => {
      if (allVisibleUsersSelected) {
        return currentSelection.filter((selectedId) => {
          return !visibleUserIds.includes(selectedId);
        });
      }

      return Array.from(
        new Set([
          ...currentSelection,
          ...visibleUserIds,
        ])
      );
    });
  };

  const runAction = async ({ action, successMessage }) => {
    const currentScrollPosition = window.scrollY;

    setActionLoading(true);

    try {
      await action();
      await loadUsers();

      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: currentScrollPosition,
          behavior: "auto",
        });
      });

      showToast("success", successMessage);
    } catch (error) {
      showToast(
        "error",
        getErrorMessage(error, "The action could not be completed.")
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMicrosoftSync = async () => {
    setSyncing(true);
    setSyncSummary(null);

    try {
      const response = await azureApi.syncUsers({
        includeDisabled: true,
      });

      const summary = response.data?.summary || null;
      setSyncSummary(summary);

      await loadUsers();

      showToast(
        "success",
        response.data?.message || "Microsoft users synchronized."
      );
    } catch (error) {
      showToast(
        "error",
        getErrorMessage(
          error,
          "Microsoft user synchronization failed."
        )
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkAction = async (action, value = undefined) => {
    if (selectedUserIds.length === 0) {
      return;
    }

    const readableAction = action.replaceAll("_", " ");
    const confirmed = window.confirm(
      `Apply ${readableAction} to ${selectedUserIds.length} selected employee${
        selectedUserIds.length === 1 ? "" : "s"
      }?`
    );

    if (!confirmed) {
      return;
    }

    await runAction({
      action: async () => {
        const response = await userApi.bulkAction({
          userIds: selectedUserIds,
          action,
          value,
        });

        const result = response.data;

        setSelectedUserIds([]);

        showToast(
          result.failed > 0 ? "warning" : "success",
          `${result.updated} updated, ${result.skipped} skipped and ${result.failed} failed.`
        );
      },
      successMessage: "Bulk action completed.",
    });
  };

  const openEditModal = (userItem) => {
    setEditingUser(userItem);
    setEditForm(mapUserToEditForm(userItem));
  };

  const closeEditModal = () => {
    if (actionLoading) {
      return;
    }

    setEditingUser(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const handleSaveUser = async () => {
    if (!editingUser) {
      return;
    }

    if (!editForm.name.trim() || !editForm.email.trim()) {
      showToast("error", "Name and email are required.");
      return;
    }

    await runAction({
      action: async () => {
        await userApi.updateProfile(editingUser.id, editForm);

        if (editForm.role !== editingUser.role) {
          await userApi.updateUserRole(
            editingUser.id,
            editForm.role
          );
        }

        setEditingUser(null);
        setEditForm(EMPTY_EDIT_FORM);
      },
      successMessage: "Employee profile updated successfully.",
    });
  };

  const handleDeleteUser = async (userItem) => {
    const confirmed = window.confirm(
      `Permanently delete ${
        userItem.name || userItem.email
      }? This cannot be undone. Archive is safer for accounts with history.`
    );

    if (!confirmed) {
      return;
    }

    await runAction({
      action: () => userApi.deleteUser(userItem.id),
      successMessage: "User permanently deleted.",
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 p-5 text-slate-900 xl:p-8">
      <ToastContainer
        toast={toast}
        onDismiss={() => setToast(null)}
      />

      <div className="mx-auto max-w-[1650px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              Administration
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              User Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage employee profiles, access, directory quality and bulk operations.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadUsers()}
              disabled={refreshing || initialLoading}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={classNames(
                  "mr-2 h-4 w-4",
                  (refreshing || initialLoading) && "animate-spin"
                )}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={handleMicrosoftSync}
              disabled={syncing}
              className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={classNames(
                  "mr-2 h-4 w-4",
                  syncing && "animate-spin"
                )}
              />
              {syncing ? "Syncing..." : "Sync Microsoft 365"}
            </button>
          </div>
        </header>

        {syncSummary && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <span className="font-bold">
              Last Microsoft sync:
            </span>{" "}
            {syncSummary.retrieved} retrieved, {syncSummary.created} created,{" "}
            {syncSummary.updated} updated, {syncSummary.skipped} skipped and{" "}
            {syncSummary.failed} failed.
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div
                  className={classNames(
                    "inline-flex rounded-xl p-2.5",
                    card.colorClass
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {card.label}
                </p>

                <p className="mt-1 text-3xl font-bold text-slate-950">
                  {card.value}
                </p>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Filter className="h-4 w-4" />
            Filters
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={filters.search}
                onChange={(event) => {
                  setFilter("search", event.target.value);
                }}
                placeholder="Search name, email, title or employee number..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <SelectInput
              value={filters.role}
              onChange={(value) => setFilter("role", value)}
            >
              <option value="">All roles</option>
              {(meta.roles || []).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </SelectInput>

            <SelectInput
              value={filters.department}
              onChange={(value) => setFilter("department", value)}
            >
              <option value="">All departments</option>
              {(meta.departments || []).map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </SelectInput>

            <SelectInput
              value={filters.status}
              onChange={(value) => setFilter("status", value)}
            >
              <option value="">All portal statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SelectInput>

            <SelectInput
              value={filters.microsoftEnabled}
              onChange={(value) => {
                setFilter("microsoftEnabled", value);
              }}
            >
              <option value="">All Microsoft states</option>
              <option value="true">Microsoft active</option>
              <option value="false">Microsoft disabled</option>
            </SelectInput>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={filters.includeArchived}
                onChange={(event) => {
                  setFilter("includeArchived", event.target.checked);
                }}
              />
              Include archived accounts
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-slate-600">
                View
              </label>

              <SelectInput
                value={pageSize}
                onChange={(value) => {
                  setPageSize(
                    value === "all" ? "all" : Number(value)
                  );
                }}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </SelectInput>

              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-sm font-bold text-blue-700 hover:text-blue-800"
              >
                Clear filters
              </button>
            </div>
          </div>
        </section>

        {selectedUserIds.length > 0 && (
          <BulkActionBar
            selectedCount={selectedUserIds.length}
            roles={permittedRoles}
            disabled={actionLoading}
            onApprove={() => handleBulkAction("approve")}
            onActivate={() => handleBulkAction("activate")}
            onDeactivate={() => handleBulkAction("deactivate")}
            onArchive={() => handleBulkAction("archive")}
            onRestore={() => handleBulkAction("restore")}
            onSetRole={(role) => {
              handleBulkAction("set_role", role);
            }}
            onClear={() => setSelectedUserIds([])}
          />
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-4">
                    <input
                      type="checkbox"
                      checked={allVisibleUsersSelected}
                      onChange={toggleVisibleUserSelection}
                      aria-label="Select all visible employees"
                    />
                  </th>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Department / Title</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Portal</th>
                  <th className="p-4">Microsoft</th>
                  <th className="p-4">Approval</th>
                  <th className="p-4">Last Sync</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {initialLoading ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="p-10 text-center text-sm text-slate-500"
                    >
                      Loading employees...
                    </td>
                  </tr>
                ) : visibleUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="p-10 text-center text-sm text-slate-500"
                    >
                      No employees match the current filters.
                    </td>
                  </tr>
                ) : (
                  visibleUsers.map((userItem) => {
                    const isArchived = Boolean(userItem.archived_at);
                    const isCurrentUser =
                      Number(currentUser?.id) === Number(userItem.id);

                    return (
                      <UserTableRow
                        key={userItem.id}
                        user={userItem}
                        selected={selectedUserIds.includes(userItem.id)}
                        isArchived={isArchived}
                        isCurrentUser={isCurrentUser}
                        canEdit={canEditUsers}
                        isSuperadmin={isSuperadmin}
                        disabled={actionLoading}
                        onSelect={() => {
                          toggleUserSelection(userItem.id);
                        }}
                        onEdit={() => openEditModal(userItem)}
                        onApprove={() => {
                          runAction({
                            action: () => {
                              return userApi.approveUser(
                                userItem.id,
                                userItem.role || "user"
                              );
                            },
                            successMessage: "User approved.",
                          });
                        }}
                        onDeactivate={() => {
                          runAction({
                            action: () => {
                              return userApi.deactivateUser(userItem.id);
                            },
                            successMessage: "User deactivated.",
                          });
                        }}
                        onReactivate={() => {
                          runAction({
                            action: () => {
                              return userApi.reactivateUser(userItem.id);
                            },
                            successMessage: "User reactivated.",
                          });
                        }}
                        onArchive={() => {
                          runAction({
                            action: () => {
                              return userApi.archiveUser(
                                userItem.id,
                                "Archived by administrator"
                              );
                            },
                            successMessage: "User archived.",
                          });
                        }}
                        onRestore={() => {
                          runAction({
                            action: () => {
                              return userApi.restoreUser(userItem.id);
                            },
                            successMessage: "User restored.",
                          });
                        }}
                        onDelete={() => handleDeleteUser(userItem)}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={users.length}
            visibleItems={visibleUsers.length}
            pageSize={pageSize}
            onPrevious={() => {
              setCurrentPage((page) => Math.max(1, page - 1));
            }}
            onNext={() => {
              setCurrentPage((page) => {
                return Math.min(totalPages, page + 1);
              });
            }}
          />
        </section>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          form={editForm}
          roles={permittedRoles}
          employmentStatuses={meta.employmentStatuses || []}
          saving={actionLoading}
          onChange={(fieldName, value) => {
            setEditForm((currentForm) => ({
              ...currentForm,
              [fieldName]: value,
            }));
          }}
          onCancel={closeEditModal}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
}

function ToastContainer({ toast, onDismiss }) {
  if (!toast) {
    return null;
  }

  const toastClasses = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <div
      className="fixed right-5 top-5 z-[100] w-[min(92vw,420px)]"
      aria-live="polite"
    >
      <div
        className={classNames(
          "flex items-start justify-between gap-4 rounded-2xl border p-4 shadow-2xl",
          toastClasses[toast.type] || toastClasses.info
        )}
      >
        <p className="text-sm font-semibold leading-6">
          {toast.message}
        </p>

        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 hover:bg-black/5"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BulkActionBar({
  selectedCount,
  roles,
  disabled,
  onApprove,
  onActivate,
  onDeactivate,
  onArchive,
  onRestore,
  onSetRole,
  onClear,
}) {
  return (
    <div className="sticky top-3 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-lg">
      <strong className="mr-2 text-sm text-blue-950">
        {selectedCount} selected
      </strong>

      <BulkButton disabled={disabled} onClick={onApprove}>
        Approve
      </BulkButton>

      <BulkButton disabled={disabled} onClick={onActivate}>
        Activate
      </BulkButton>

      <BulkButton disabled={disabled} onClick={onDeactivate}>
        Deactivate
      </BulkButton>

      <BulkButton disabled={disabled} onClick={onArchive}>
        Archive
      </BulkButton>

      <BulkButton disabled={disabled} onClick={onRestore}>
        Restore
      </BulkButton>

      <SelectInput
        value=""
        onChange={(value) => {
          if (value) {
            onSetRole(value);
          }
        }}
        disabled={disabled}
      >
        <option value="">Set role...</option>
        {roles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </SelectInput>

      <BulkButton disabled={disabled} onClick={onClear}>
        Clear selection
      </BulkButton>
    </div>
  );
}

function BulkButton({ children, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function UserTableRow({
  user,
  selected,
  isArchived,
  isCurrentUser,
  canEdit,
  isSuperadmin,
  disabled,
  onSelect,
  onEdit,
  onApprove,
  onDeactivate,
  onReactivate,
  onArchive,
  onRestore,
  onDelete,
}) {
  return (
    <tr
      className={classNames(
        "align-top hover:bg-slate-50",
        isArchived && "bg-slate-50 opacity-70"
      )}
    >
      <td className="p-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${user.name || user.email}`}
        />
      </td>

      <td className="p-4">
        <p className="font-bold text-slate-950">
          {user.name}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          {user.email}
        </p>

        {user.employee_number && (
          <p className="mt-1 text-xs text-slate-400">
            Employee #{user.employee_number}
          </p>
        )}
      </td>

      <td className="p-4">
        <p className="font-semibold text-slate-800">
          {user.department || "No department"}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          {user.job_title || "No job title"}
        </p>
      </td>

      <td className="p-4">
        <span
          className={classNames(
            "rounded-full px-2.5 py-1 text-xs font-bold",
            getRoleClassName(user.role)
          )}
        >
          {user.role}
        </span>
      </td>

      <td className="p-4">
        <StatusBadge
          active={user.status === "active" && !isArchived}
          activeText="Active"
          inactiveText={isArchived ? "Archived" : "Inactive"}
        />
      </td>

      <td className="p-4">
        {user.microsoft_id ? (
          <StatusBadge
            active={user.microsoft_account_enabled !== false}
            activeText="Active"
            inactiveText="Disabled"
          />
        ) : (
          <span className="text-xs font-semibold text-slate-400">
            Not linked
          </span>
        )}
      </td>

      <td className="p-4">
        <StatusBadge
          active={Boolean(user.approved)}
          activeText="Approved"
          inactiveText="Pending"
        />
      </td>

      <td className="p-4 text-sm text-slate-500">
        {formatDateTime(user.last_microsoft_sync_at)}
      </td>

      <td className="p-4">
        <div className="flex justify-end gap-2">
          {canEdit && (
            <IconButton
              title="Edit employee"
              onClick={onEdit}
              disabled={disabled}
            >
              <Edit3 />
            </IconButton>
          )}

          {canEdit && !user.approved && !isArchived && (
            <IconButton
              title="Approve employee"
              onClick={onApprove}
              disabled={disabled}
              variant="success"
            >
              <UserCheck />
            </IconButton>
          )}

          {canEdit &&
            !isArchived &&
            user.status === "active" &&
            !isCurrentUser && (
              <IconButton
                title="Deactivate employee"
                onClick={onDeactivate}
                disabled={disabled}
                variant="warning"
              >
                <UserX />
              </IconButton>
            )}

          {canEdit &&
            !isArchived &&
            user.status !== "active" && (
              <IconButton
                title="Reactivate employee"
                onClick={onReactivate}
                disabled={disabled}
                variant="success"
              >
                <RotateCcw />
              </IconButton>
            )}

          {canEdit && !isArchived && !isCurrentUser && (
            <IconButton
              title="Archive employee"
              onClick={onArchive}
              disabled={disabled}
            >
              <Archive />
            </IconButton>
          )}

          {canEdit && isArchived && (
            <IconButton
              title="Restore employee"
              onClick={onRestore}
              disabled={disabled}
              variant="info"
            >
              <RotateCcw />
            </IconButton>
          )}

          {isSuperadmin && !isCurrentUser && (
            <IconButton
              title="Delete employee permanently"
              onClick={onDelete}
              disabled={disabled}
              variant="danger"
            >
              <Trash2 />
            </IconButton>
          )}
        </div>
      </td>
    </tr>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  variant = "default",
}) {
  const variants = {
    default: "border-slate-200 text-slate-700 hover:bg-slate-100",
    success: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    warning: "border-amber-200 text-amber-700 hover:bg-amber-50",
    danger: "border-red-200 text-red-700 hover:bg-red-50",
    info: "border-blue-200 text-blue-700 hover:bg-blue-50",
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "rounded-lg border p-2 transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant]
      )}
    >
      {cloneElement(children, {
        className: "h-4 w-4",
      })}
    </button>
  );
}

function StatusBadge({ active, activeText, inactiveText }) {
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

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  visibleItems,
  pageSize,
  onPrevious,
  onNext,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <p>
        Showing {visibleItems} of {totalItems} employees
        {pageSize !== "all" && ` Â· Page ${currentPage} of ${totalPages}`}
      </p>

      {pageSize !== "all" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={currentPage <= 1}
            className="rounded-lg border border-slate-200 px-3 py-2 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-slate-200 px-3 py-2 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function EditUserModal({
  user,
  form,
  roles,
  employmentStatuses,
  saving,
  onChange,
  onCancel,
  onSave,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <h2
              id="edit-user-title"
              className="text-xl font-bold text-slate-950"
            >
              Edit Employee
            </h2>

            <p className="text-sm text-slate-500">
              {user.email}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close employee editor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <EditField
            label="Full Name"
            value={form.name}
            onChange={(value) => onChange("name", value)}
            required
          />

          <EditField
            label="Company Email"
            type="email"
            value={form.email}
            onChange={(value) => onChange("email", value)}
            required
          />

          <EditField
            label="First Name"
            value={form.firstName}
            onChange={(value) => onChange("firstName", value)}
          />

          <EditField
            label="Last Name"
            value={form.lastName}
            onChange={(value) => onChange("lastName", value)}
          />

          <EditField
            label="Employee Number"
            value={form.employeeNumber}
            onChange={(value) => onChange("employeeNumber", value)}
          />

          <EditField
            label="Job Title"
            value={form.jobTitle}
            onChange={(value) => onChange("jobTitle", value)}
          />

          <EditField
            label="Department"
            value={form.department}
            onChange={(value) => onChange("department", value)}
          />

          <EditField
            label="Manager"
            value={form.managerName}
            onChange={(value) => onChange("managerName", value)}
          />

          <EditField
            label="Office Location"
            value={form.officeLocation}
            onChange={(value) => onChange("officeLocation", value)}
          />

          <EditField
            label="Site"
            value={form.site}
            onChange={(value) => onChange("site", value)}
          />

          <EditField
            label="Mobile Phone"
            value={form.mobilePhone}
            onChange={(value) => onChange("mobilePhone", value)}
          />

          <EditField
            label="Business Phone"
            value={form.businessPhone}
            onChange={(value) => onChange("businessPhone", value)}
          />

          <EditField
            label="Alternative Email"
            type="email"
            value={form.alternativeEmail}
            onChange={(value) => onChange("alternativeEmail", value)}
          />

          <SelectField
            label="Employment Status"
            value={form.employmentStatus}
            onChange={(value) => {
              onChange("employmentStatus", value);
            }}
          >
            {(employmentStatuses.length > 0
              ? employmentStatuses
              : ["active", "resigned", "transferred", "contractor", "suspended"]
            ).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </SelectField>

          <EditField
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(value) => onChange("startDate", value)}
          />

          <EditField
            label="Termination Date"
            type="date"
            value={form.terminationDate}
            onChange={(value) => onChange("terminationDate", value)}
          />

          <SelectField
            label="Portal Role"
            value={form.role}
            onChange={(value) => onChange("role", value)}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white p-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-bold text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-bold text-slate-700">
        {label}
      </span>

      <SelectInput
        value={value}
        onChange={onChange}
      >
        {children}
      </SelectInput>
    </label>
  );
}

function SelectInput({
  value,
  onChange,
  children,
  disabled = false,
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </select>
  );
}

