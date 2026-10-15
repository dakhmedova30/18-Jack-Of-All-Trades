interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

type PageToken = number | 'gap';

/** e.g. current 5 of 68 -> [1, gap, 4, 5, 6, gap, 68] */
export function getPageTokens(current: number, total: number): PageToken[] {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const tokens: PageToken[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous > 1) tokens.push('gap');
    tokens.push(page);
  });
  return tokens;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="pagination__page"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        ‹
      </button>
      {getPageTokens(page, totalPages).map((token, index) =>
        token === 'gap' ? (
          <span key={`gap-${index}`} className="pagination__gap">
            …
          </span>
        ) : (
          <button
            key={token}
            type="button"
            className={`pagination__page${token === page ? ' is-current' : ''}`}
            onClick={() => onPageChange(token)}
            aria-current={token === page ? 'page' : undefined}
          >
            {token}
          </button>
        ),
      )}
      <button
        type="button"
        className="pagination__page"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
