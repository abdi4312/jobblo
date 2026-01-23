import React from "react";
import {
  Trash2 as TrashIcon,
  Pencil as EditIcon,
} from "lucide-react";

interface HeroTableProps {
  heroes: any[];
  getStatus: (start: string, end: string) => any;
  handleEdit: (item: any) => void;
  handleDelete: (id: string) => void;
  loading: boolean;
}

const HeroTable: React.FC<HeroTableProps> = ({ heroes, getStatus, handleEdit, handleDelete, loading }) => {
  return (
    <div className="overflow-x-auto no-scrollbar">
      <table className="w-full text-left min-w-[800px]">
        <thead>
          <tr className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-50">
            <th className="pb-6 px-4">Preview</th>
            <th className="pb-6 px-4">Title / Info</th>
            <th className="pb-6 px-4 text-center">Status</th>
            <th className="pb-6 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50/50">
          {heroes.map((item: any) => {
            const status = getStatus(item.activeFrom, item.expireAt);
            return (
              <tr
                key={item._id}
                className="group hover:bg-gray-50/30 transition-all"
              >
                <td className="py-5 px-4">
                  <div className="w-32 h-20 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                    <img
                      src={item.image}
                      alt="Hero"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                </td>
                <td className="py-5 px-4">
                  <p className="text-gray-800 font-bold">{item.title}</p>
                  <p className={`text-[11px] font-bold mt-1 ${status.dateTextColor}`}>
                    {status.dateInfo}
                  </p>
                </td>
                <td className="py-5 px-4 text-center">
                  <span
                    className={`${status.color} text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-sm`}
                  >
                    {status.icon} {status.label}
                  </span>
                </td>
                <td className="py-5 px-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="bg-blue-50 text-blue-500 p-2.5 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm active:scale-90"
                    >
                      <EditIcon size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="bg-red-50 text-red-500 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-90"
                    >
                      <TrashIcon size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {heroes.length === 0 && !loading && (
        <p className="text-center py-10 text-gray-400">No data found</p>
      )}
    </div>
  );
};

export default HeroTable;