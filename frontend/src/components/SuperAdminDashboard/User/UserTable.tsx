import React from "react";
import { Trash2 } from "lucide-react";

interface UserTableProps {
  users: any[];
  loading: boolean;
  handleRoleChange: (id: string, newRole: string) => void;
  handleDelete: (id: string) => void;
}

const UserTable: React.FC<UserTableProps> = ({ users, loading, handleRoleChange, handleDelete }) => {
  return (
    <div className="overflow-x-auto no-scrollbar">
      <table className="w-full text-left min-w-[800px]">
        <thead>
          <tr className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-50">
            <th className="pb-5 px-4">Name & Email</th>
            <th className="pb-5 px-4 text-center">Phone</th>
            <th className="pb-5 px-4 text-center">Role</th>
            <th className="pb-5 px-4 text-center">Joined</th>
            <th className="pb-5 px-4 text-right">Delete</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {loading ? (
            <tr>
              <td colSpan={6} className="text-center py-20 animate-pulse">
                Syncing data...
              </td>
            </tr>
          ) : (
            users.map((user: any) => (
              <tr key={user._id} className="group hover:bg-gray-50/80 transition-colors">
                <td className="py-5 px-4">
                  <div className="font-bold text-gray-800">{user.name}</div>
                  <div className="text-[10px] text-gray-400">{user.email}</div>
                </td>
                <td className="py-5 px-4 text-center text-gray-600 font-medium text-sm">
                  {user.phone || "N/A"}
                </td>
                <td className="py-5 px-4 text-center">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user._id, e.target.value)}
                    className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border-none shadow-sm
                      ${user.role === "superAdmin" ? "bg-purple-100 text-purple-700" : user.role === "provider" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}
                  >
                    <option value="user">User</option>
                    <option value="provider">Provider</option>
                    <option value="superAdmin">Super Admin</option>
                  </select>
                </td>
                <td className="py-5 px-4 text-center text-gray-400 text-xs">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="py-5 px-4 text-right">
                  <button
                    onClick={() => handleDelete(user._id)}
                    className="bg-red-50 text-red-500 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;