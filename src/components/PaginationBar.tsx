import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
  rangeFrom: number;
  rangeTo: number;
  total: number;
}

export function PaginationBar({ page, pageCount, setPage, rangeFrom, rangeTo, total }: Props) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1">
      <p className="text-xs text-muted-foreground">
        {rangeFrom}–{rangeTo} von {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground px-2">
          Seite {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
