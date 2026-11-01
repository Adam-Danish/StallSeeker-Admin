import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Pagination, PaginationContent, PaginationItem } from "./ui/pagination";
import type { RecordSort } from "../useRecordPagination";

interface Props {
  label: string;
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function RecordPagination({ label, page, pageSize, pageCount, total, onPageChange, onPageSizeChange }: Props) {
  const sizeId = useId();
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 text-sm text-muted-foreground">
      <p role="status" aria-live="polite">Showing {first}–{last} of {total} {label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={sizeId}>Per page</label>
        <select id={sizeId} value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-md border border-border bg-background px-2 py-2 text-foreground">
          {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <Pagination className="mx-0 w-auto" aria-label={`${label} pages`}>
          <PaginationContent className="flex-wrap">
            <PaginationItem>
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={`Previous ${label} page`}>
                <ChevronLeft aria-hidden="true" /> Previous
              </Button>
            </PaginationItem>
            <PaginationItem><span className="px-2">Page {page} of {pageCount}</span></PaginationItem>
            <PaginationItem>
              <Button type="button" variant="outline" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label={`Next ${label} page`}>
                Next <ChevronRight aria-hidden="true" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

export function RecordSortSelect({ label, value, onChange, nameLabel = "Name" }: {
  label: string; value: RecordSort; onChange: (sort: RecordSort) => void; nameLabel?: string;
}) {
  const sortId = useId();
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <label htmlFor={sortId}>Sort by</label>
      <select id={sortId} aria-label={`Sort ${label}`} value={value}
        onChange={(event) => onChange(event.target.value as RecordSort)}
        className="rounded-md border border-border bg-background px-3 py-2 text-foreground">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="name-asc">{nameLabel} A–Z</option>
        <option value="name-desc">{nameLabel} Z–A</option>
      </select>
    </div>
  );
}
