import { Check, Pencil, X } from "lucide-react";

interface ProfileFieldProps {
    label: string;
    field: string;
    value: string;
    initialValue: string;
    type?: string;
    isEditing: boolean;
    onEdit: (field: string) => void;
    onSave: (field: string) => void;
    onChange: (field: string, value: string) => void;
}

export const ProfileField = ({
    label,
    field,
    value,
    initialValue,
    type = "text",
    isEditing,
    onEdit,
    onSave,
    onChange,
}: ProfileFieldProps) => {

    // Check if data has actually changed
    const isChanged = value !== initialValue;

    return (
        <div className="bg-[#FFFFFF1A] rounded-xl p-4 mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 shadow-sm">

            <span className="font-medium text-[16px] md:text-[20px] leading-[100%] text-[#0A0A0A] min-w-[120px]">
                {label}
            </span>

            {isEditing ? (
                <div className="flex items-center gap-2 w-full sm:flex-1 max-w-md">
                    {field === "gender" ? (
                        <select
                            value={value}
                            onChange={(e) => onChange(field, e.target.value)}
                            className="flex-1 p-2 border-2 border-[#2F7E47] rounded-lg text-[15px] outline-none bg-white"
                            autoFocus
                        >
                            <option value="">Velg kjønn</option>
                            <option value="male">Mann</option>
                            <option value="female">Kvinne</option>
                            <option value="unisex">Unisex</option>
                        </select>
                    ) : (
                        <input
                            type={type}
                            value={value}
                            onChange={(e) => onChange(field, e.target.value)}
                            className="flex-1 p-2 border-2 border-[#2F7E47] rounded-lg text-[15px] outline-none"
                            autoFocus
                        />
                    )}

                    <div className="flex items-center gap-1.5">
                        {/* Save Button with Check Icon */}
                        <button
                            onClick={() => isChanged && onSave(field)}
                            disabled={!isChanged}
                            className={`p-2 rounded-lg transition-all flex items-center gap-1 ${isChanged
                                ? "bg-[#2F7E47] text-white hover:bg-[#153014] cursor-pointer"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                }`}
                            title="Lagre"
                        >
                            <Check size={18} strokeWidth={3} />
                        </button>

                        {/* Cancel Button with X Icon */}
                        <button
                            onClick={() => onEdit("")} // Empty string pass karne se editingField null ho jayega
                            className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
                            title="Avbryt"
                        >
                            <X size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between sm:justify-end w-full sm:flex-1">
                    <span className="text-[15px] font-medium text-[#7A8293] mr-4 truncate">
                        {field === "password" ? "************" :
                            field === "gender" ? (value === "male" ? "Mann" : value === "female" ? "Kvinne" : value === "unisex" ? "Unisex" : value) :
                                value || "—"}
                    </span>
                    <button
                        onClick={() => onEdit(field)}
                        className="text-[#0A0A0A] hover:text-[#2F7E47] transition-colors p-1"
                    >
                        <Pencil size={18} />
                    </button>
                </div>
            )}
        </div>
    );
};