export const PasswordView = () => (
  <section className="flex flex-col gap-6 max-w-2xl">
    <div className="relative group">
      <label htmlFor="currentPassword" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">Current Password</label>
      <input id="currentPassword" type="password" placeholder="••••••••" className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors" />
    </div>
    <div className="relative group">
      <label htmlFor="newPassword" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">New Password</label>
      <input id="newPassword" type="password" placeholder="••••••••" className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors" />
    </div>
    <button type="button" className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg py-4.5 rounded-2xl shadow-sm transition-all">Change password</button>
  </section>
);
