import React from "react";
import {
  ExternalLink,
  CreditCard,
  Tag,
  DollarSign,
  RotateCcw,
} from "lucide-react";

interface Props {
  transactions: any[];
  loading: boolean;
  getStatusConfig: (status: string) => any;
  onUpdateStatus: (id: string, newStatus: string) => void;
}

const TransactionTable: React.FC<Props> = ({
  transactions,
  loading,
  getStatusConfig,
  onUpdateStatus,
}) => {
  return (
    <div className="overflow-x-auto no-scrollbar">
      <table className="w-full text-left min-w-[1000px]">
        <thead>
          <tr className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em] border-b border-slate-50">
            <th className="pb-6 px-4">Customer & Plan</th>
            <th className="pb-6 px-4">Type</th>
            <th className="pb-6 px-4">Amount</th>
            <th className="pb-6 px-4">Discount</th>
            <th className="pb-6 px-4 text-center">Status</th>
            <th className="pb-6 px-4 text-right">Date & Reference</th>
            <th className="pb-6 px-4 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50/50">
          {transactions.map((tx) => {
            const currentStatus = tx.refunded ? "refunded" : tx.status;
            const status = getStatusConfig(currentStatus);

            return (
              <tr
                key={tx._id}
                className="group hover:bg-slate-50/50 transition-all"
              >
                {/* Customer Info */}
                <td className="py-6 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[#2d4a3e] font-bold shadow-sm group-hover:bg-white transition-colors">
                      {tx.userId?.name?.charAt(0) || "U"}
                    </div>
                    <div>
                      <p className="text-slate-800 font-bold text-sm leading-tight">
                        {tx.planName || "Custom Plan"}
                      </p>
                      <p className="text-slate-400 text-xs font-medium mt-0.5">
                        {tx.userId?.email || "Guest User"}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Type */}
                <td className="py-6 px-4">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-white transition-colors">
                      <CreditCard size={14} />
                    </span>
                    <span className="text-xs font-bold text-slate-600 capitalize">
                      {tx.type?.replace("_", " ")}
                    </span>
                  </div>
                </td>

                {/* Amount */}
                <td className="py-6 px-4">
                  <p className="text-slate-800 font-black text-sm">
                    {tx.amount?.toLocaleString()}{" "}
                    <span className="uppercase text-[10px] text-slate-400">
                      {tx.currency || "NOK"}
                    </span>
                  </p>
                </td>

                {/* Discount */}
                <td className="py-6 px-4">
                  {tx.discountCoupon || tx.discountAmount > 0 ? (
                    <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[10px] bg-blue-50/50 border border-blue-100 px-2.5 py-1 rounded-full w-fit">
                      <Tag size={10} />
                      {tx.discountCoupon || "Promo"} (-{tx.discountAmount})
                    </div>
                  ) : (
                    <span className="text-slate-200 text-xs">—</span>
                  )}
                </td>

                {/* Status Badge */}
                <td className="py-6 px-4 text-center">
                  <span
                    className={`${status.color} px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm border border-transparent transition-all`}
                  >
                    {tx.refunded ? <RotateCcw size={12} /> : status.icon}{" "}
                    {status.label}
                  </span>
                </td>

                {/* Date & Stripe Link */}
                <td className="py-6 px-4 text-right">
                  <p className="text-slate-800 font-bold text-xs">
                    {new Date(tx.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <a
                    href={`https://dashboard.stripe.com/payments/${tx.stripeSessionId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-slate-400 hover:text-[#2d4a3e] font-bold flex items-center justify-end gap-1 mt-1 transition-colors"
                  >
                    REF: {tx.stripeSessionId?.slice(-8).toUpperCase()}{" "}
                    <ExternalLink size={10} />
                  </a>
                </td>

                {/* Action Column - Status Update */}
                <td className="py-6 px-4 text-center">
                  <div className="relative inline-block text-left w-full max-w-[120px]">
                    <select
                      className="block w-full text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-[#2d4a3e]/40 focus:border-[#2d4a3e] cursor-pointer transition-all hover:bg-slate-50 px-3 py-1.5 uppercase tracking-wider"
                      value={currentStatus}
                      onChange={(e) => onUpdateStatus(tx._id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="succeeded">Succeeded</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Empty State */}
      {!loading && transactions.length === 0 && (
        <div className="py-32 text-center bg-slate-50/30 rounded-[2rem] border-2 border-dashed border-slate-100 m-4">
          <div className="w-20 h-20 bg-white shadow-sm rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-200">
            <DollarSign size={40} />
          </div>
          <p className="text-slate-500 font-bold text-lg">
            No Transactions Found
          </p>
          <p className="text-slate-400 text-sm mt-1">
            Try adjusting your filters or search query.
          </p>
        </div>
      )}
    </div>
  );
};

export default TransactionTable;
