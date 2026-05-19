import { useEffect, useState } from "react";
import { userApi } from "../services/api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  const fetchUsers = async () => {
    const res = await userApi.getUsers();
    setUsers(res.data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (id, role) => {
    await userApi.approveUser(id, role);
    fetchUsers();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">User Management</h1>

      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="border-b">
            <th>ID</th>
            <th>Email</th>
            <th>Current Role</th>
            <th>Assign Role</th>
          </tr>
        </thead>

        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="text-center border-b">
              <td>{u.id}</td>
              <td>{u.email}</td>
              <td>
                <span className="font-semibold">{u.role}</span>
              </td>

              <td>
                <select
                  onChange={(e) =>
                    handleRoleChange(u.id, e.target.value)
                  }
                  defaultValue=""
                  className="border p-1 rounded"
                >
                  <option disabled value="">
                    Assign Role
                  </option>
                  <option value="operator">Operator</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}