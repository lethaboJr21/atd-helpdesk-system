import { useEffect, useState } from "react";
import { userApi } from "../services/api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await userApi.getUsers();
      const data = Array.isArray(res.data) ? res.data : [];
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ✅ Update local role before saving
  const handleRoleChange = (id, role) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, newRole: role } : u
      )
    );
  };

  // ✅ Save updated role
  const updateUserRole = async (id) => {
    const user = users.find((u) => u.id === id);

    try {
      await userApi.approveUser(id, user.newRole || user.role);
      fetchUsers();
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const roleColors = {
    admin: "bg-purple-100 text-purple-700",
    agent: "bg-green-100 text-green-700",
    user: "bg-slate-100 text-slate-700",
  };

  // ✅ Approve user
  const approveUser = async (id) => {
    try {
      await userApi.approveUser(id, "user");
      fetchUsers();
    } catch (err) {
      console.error("Failed to approve user:", err);
    }
  };

  
  return (
    <div className="p-8">

      {/* Header */}
      <h1 className="text-2xl font-bold mb-6">
        User Management
      </h1>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

        {/* Loading state */}
        {loading && (
          <div className="p-6 text-center text-slate-500">
            Loading users...
          </div>
        )}

        {/* Empty state */}
        {!loading && users.length === 0 && (
          <div className="p-6 text-center text-slate-500">
            No users found
          </div>
        )}

        {/* Table */}
        {!loading && users.length > 0 && (
          <table className="w-full text-left">

            <thead className="bg-slate-100 text-sm font-semibold text-slate-700">
  <tr>
    <th className="p-4">ID</th>
    <th className="p-4">Email</th>
    <th className="p-4">Role</th>
    <th className="p-4">Status</th>
    <th className="p-4">Assign Role</th>
    <th className="p-4">Actions</th>
    <th className="p-4">Status</th>
  </tr>
</thead>

<tbody className="divide-y">
  {users.map((user) => (
    <tr key={user.id} className="hover:bg-slate-50 transition">

      {/* ID */}
      <td className="p-4 font-medium">
        {user.id}
      </td>

      {/* Email */}
      <td className="p-4">
        {user.email}
      </td>

      {/* Role Badge */}
      <td className="p-4">
        <span
          className={`px-3 py-1 text-xs rounded-full font-semibold ${
            roleColors[user.role] || "bg-slate-100 text-slate-700"
          }`}
        >
          {user.role}
        </span>
      </td>

      {/* ✅ NEW: Status */}
      <td className="p-4">
        {user.approved ? (
          <span className="text-green-600  font-semibold">
            Approved
          </span>
        ) : (
          <span className="px-3 py-1 text-yellow-600 font-semibold">
            Pending
          </span>
        )}
      </td>
          <td className="p-4">
            {!user.approved && (
              <button
                onClick={() => approveUser(user.id)}
                className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm"
              >
                Approve
              </button>
            )}
          </td>
      {/* Assign Role */}
      <td className="p-4">
        <select
          value={user.newRole || user.role}
          onChange={(e) =>
            handleRoleChange(user.id, e.target.value)
          }
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200"
        >
          <option value="user">User</option>
          <option value="agent">Agent</option>
          <option value="admin">Admin</option>
        </select>
      </td>

      {/* ✅ Actions */}
      <td className="p-4 flex gap-2">

        {/* Save Role */}
        <button
          onClick={() => updateUserRole(user.id)}
          className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-blue-700"
        >
          Save
        </button>

        {/* ✅ Approve button */}
        {!user.approved && (
          <button
            onClick={() => approveUser(user.id)}
            className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-green-700"
          >
            Approve
          </button>
        )}

      </td>

    </tr>
  ))}
</tbody>
          </table>
        )}

      </div>
    </div>
  );
}
