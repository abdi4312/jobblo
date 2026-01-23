import React from "react";
import { X } from "lucide-react";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  newUser: any;
  setNewUser: (data: any) => void;
  handleCreateUser: (e: React.FormEvent) => void;
  isSubmitting: boolean;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, newUser, setNewUser, handleCreateUser, isSubmitting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Create New User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Full Name</label>
            <input required type="text" placeholder="John Doe" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#2d4a3e]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Email</label>
              <input required type="email" placeholder="john@example.com" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#2d4a3e]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Phone</label>
              <input required type="number" placeholder="0300..." value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#2d4a3e]" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Password</label>
            <input required type="password" placeholder="••••••••" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#2d4a3e]" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Assign Role</label>
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none">
              <option value="user">User</option>
              <option value="provider">Provider</option>
              <option value="superAdmin">Super Admin</option>
            </select>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-[#2d4a3e] text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 mt-4">
            {isSubmitting ? "Creating..." : "Confirm & Create"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;