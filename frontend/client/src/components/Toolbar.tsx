import { useId, useState, type ReactNode } from 'react';
import { MoreIcon, PlusIcon, TrashIcon } from './icons';

interface ToolbarProps {
  search?: ReactNode;
  onAdd: () => void;
  transfer?: ReactNode;
  selectedCount: number;
  onDelete?: () => void;
  profileActions?: ReactNode;
  filters?: ReactNode;
  activeFilterCount?: number;
}

/** Shared responsive table actions, filters, search, and contextual selection controls. */
export function Toolbar({
  search,
  onAdd,
  transfer,
  selectedCount,
  onDelete,
  profileActions,
  filters,
  activeFilterCount = 0,
}: ToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelId = useId();

  return (
    <div className="toolbar">
      {selectedCount > 0 && (
        <div className="toolbar__selection" role="region" aria-label="Selection actions">
          <span className="toolbar__selection-count">{selectedCount} selected</span>
          {profileActions}
          {onDelete && (
            <button type="button" className="button button--danger-outline" onClick={onDelete}>
              Delete <TrashIcon />
            </button>
          )}
        </div>
      )}

      <div className="toolbar__layout">
        {search && <div className="toolbar__search">{search}</div>}

        <div className="toolbar__actions">
          {filters && (
            <button
              type="button"
              className={`button button--ghost toolbar__filters-trigger${filtersOpen ? ' is-active' : ''}`}
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls={filterPanelId}
              aria-label={
                activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'
              }
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="toolbar__filter-count">{activeFilterCount}</span>
              )}
            </button>
          )}
          {transfer && (
            <details className="toolbar__transfer">
              <summary
                className="button button--ghost"
                aria-label="Import or export CSV"
                title="Import or export CSV"
              >
                <span className="toolbar__transfer-label">Import / Export</span>
                <span className="toolbar__transfer-compact" aria-label="More actions">
                  <MoreIcon />
                </span>
              </summary>
              <div className="toolbar__transfer-menu">{transfer}</div>
            </details>
          )}
          <button
            type="button"
            className="button toolbar__add"
            onClick={onAdd}
            aria-label="Add"
            title="Add"
          >
            <span>Add</span>
            <PlusIcon />
          </button>
        </div>
      </div>

      {filters && (
        <div
          id={filterPanelId}
          className={`toolbar__filter-panel${filtersOpen ? ' is-open' : ''}`}
          aria-hidden={!filtersOpen}
          inert={!filtersOpen}
        >
          <div className="toolbar__filter-panel-inner">{filters}</div>
        </div>
      )}
    </div>
  );
}
