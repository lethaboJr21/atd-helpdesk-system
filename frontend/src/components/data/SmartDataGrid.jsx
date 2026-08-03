import React from "react";
import "./SmartDataGrid.css";

export default function SmartDataGrid({ title, actions, filters, columns = [], rows = [], rowKey = "id", loading, error, emptyMessage = "No records found.", onRowClick, renderRowActions }) {
  return <section className="smart-grid" aria-label={title || "Data list"}>
    {(title || actions) && <header className="smart-grid__pagebar"><div>{title && <h2>{title}</h2>}</div><div>{actions}</div></header>}
    {filters && <div className="smart-grid__filters">{filters}</div>}
    <div className="smart-grid__viewport" role="region" tabIndex="0" aria-label={`${title || "Records"} scroll area`}>
      <table>
        <thead><tr>{columns.map(c => <th key={c.key} style={{width:c.width}}>{c.label}</th>)}{renderRowActions && <th>Actions</th>}</tr></thead>
        <tbody>
          {loading && <tr><td colSpan={columns.length + (renderRowActions ? 1 : 0)}>Loading...</td></tr>}
          {!loading && error && <tr><td className="smart-grid__error" colSpan={columns.length + (renderRowActions ? 1 : 0)}>{error}</td></tr>}
          {!loading && !error && rows.length === 0 && <tr><td className="smart-grid__empty" colSpan={columns.length + (renderRowActions ? 1 : 0)}>{emptyMessage}</td></tr>}
          {!loading && !error && rows.map(row => <tr key={row[rowKey]} tabIndex="0" onClick={() => onRowClick?.(row)} onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && onRowClick) { e.preventDefault(); onRowClick(row); } }}>
            {columns.map(c => <td key={c.key}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>)}
            {renderRowActions && <td onClick={e => e.stopPropagation()}>{renderRowActions(row)}</td>}
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}
