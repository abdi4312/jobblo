import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Pagination } from '../../types/admin';
import { cn } from '@/lib/utils';
import { Button } from '../Ui/Button';

interface AdminPaginationProps {
    pagination: Pagination;
    onPageChange: (page: number) => void;
    className?: string;
}

export function AdminPagination({
    pagination,
    onPageChange,
    className,
}: AdminPaginationProps) {
    const { page, totalPages, total, limit, hasNextPage, hasPreviousPage } = pagination;

    if (totalPages <= 1) return null;

    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    return (
        <div
            className={cn(
                'flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3',
                className
            )}
            role="navigation"
            aria-label="Paginering"
        >
            <p className="text-sm text-gray-500">
                Viser <span className="font-semibold text-gray-700">{from}–{to}</span> av{' '}
                <span className="font-semibold text-gray-700">{total}</span> resultater
            </p>

            <div className="flex items-center gap-1.5">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onPageChange(page - 1)}
                    disabled={!hasPreviousPage}
                    className="border-gray-200 text-gray-600 disabled:opacity-40"
                    aria-label="Forrige side"
                >
                    <ChevronLeft size={16} />
                </Button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                        pageNum = i + 1;
                    } else if (page <= 3) {
                        pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                    } else {
                        pageNum = page - 2 + i;
                    }
                    return (
                        <Button
                            key={pageNum}
                            variant={pageNum === page ? 'default' : 'outline'}
                            onClick={() => onPageChange(pageNum)}
                            className={cn(
                                'min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium',
                                pageNum === page
                                    ? 'bg-[#2d4a3e] text-white hover:bg-[#233b31]'
                                    : 'border-gray-200 text-gray-600'
                            )}
                            aria-label={`Side ${pageNum}`}
                            aria-current={pageNum === page ? 'page' : undefined}
                        >
                            {pageNum}
                        </Button>
                    );
                })}

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onPageChange(page + 1)}
                    disabled={!hasNextPage}
                    className="border-gray-200 text-gray-600 disabled:opacity-40"
                    aria-label="Neste side"
                >
                    <ChevronRight size={16} />
                </Button>
            </div>
        </div>
    );
}
