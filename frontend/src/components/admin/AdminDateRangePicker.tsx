import React from 'react';
import { Calendar } from 'lucide-react';
import { Input } from '../Ui/Input';

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (val: string) => void;
    onEndDateChange: (val: string) => void;
    className?: string;
}

export function AdminDateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange, className }: DateRangePickerProps) {
    return (
        <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
            <Calendar size={14} className="text-gray-400 shrink-0" />
            <Input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)}
                className="h-[42px] px-2.5 text-xs rounded-lg border-gray-200 bg-gray-50 w-[130px]" />
            <span className="text-xs text-gray-400">–</span>
            <Input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)}
                className="h-[42px] px-2.5 text-xs rounded-lg border-gray-200 bg-gray-50 w-[130px]" />
        </div>
    );
}
