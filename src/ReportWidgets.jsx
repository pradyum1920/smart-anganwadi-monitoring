import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export function SchoolSelect({
  schools,
  value,
  onChange,
  label = "Select school",
  all = true,
  loading = false,
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const chosen =
    value === "all"
      ? { name: "All schools" }
      : schools.find((s) => s._id === value);

  const options = [
    ...(all ? [{ _id: "all", name: "All schools" }] : []),
    ...schools,
  ].filter((s) =>
    `${s.name} ${s.centerId || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  const select = (s) => {
    onChange(s._id);
    setSearch("");
    setOpen(false);
  };

  return (
    <div className="school-combobox">
      <input
        aria-label={label}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        placeholder={label}
        value={
          open
            ? search
            : `${chosen?.name || label}${chosen?.centerId ? ` (${chosen.centerId})` : ""}`
        }
        onClick={() => {
          if (!open) {
            setSearch("");
            setOpen(true);
          }
        }}
        onFocus={() => {
          if (!open) {
            setSearch("");
            setOpen(true);
          }
        }}
        onChange={(e) => setSearch(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setSearch("");
          }

          if (e.key === "Enter") {
            e.preventDefault();
            if (options[0]) select(options[0]);
          }

          if (e.key === "ArrowDown" && !open) {
            setOpen(true);
          }
        }}
      />
      <ChevronDown size={14} />
      {open && (
        <div className="school-options" role="listbox">
          {loading ? (
            <small className="school-options-message">Loading schools…</small>
          ) : options.length ? (
            options.map((s) => (
              <button
                type="button"
                role="option"
                aria-selected={s._id === value}
                key={s._id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(s)}
              >
                {s.name}
                {s.centerId ? ` (${s.centerId})` : ""}
              </button>
            ))
          ) : (
            <small className="school-options-message">
              No matching schools
            </small>
          )}
        </div>
      )}
    </div>
  );
}

export function Donut({ data }) {
  const total = data?.total || 0;
  const girls = data?.girls || 0;
  const boys = data?.boys || 0;
  const ratio = total ? girls / total : 0;

  return (
    <div className="donut-row">
      <div
        className="student-donut"
        style={{
          background: `conic-gradient(#86cf70 0 ${ratio * 100}%,#3e6b35 ${ratio * 100}% 100%)`,
        }}
      >
        <div>
          <small>Total</small>
          <strong>{total.toLocaleString()}</strong>
        </div>
      </div>
      <div className="donut-legend">
        <span>
          <i className="girl-dot" /> Girls<b>{girls.toLocaleString()}</b>
        </span>
        <span>
          <i className="boy-dot" /> Boys<b>{boys.toLocaleString()}</b>
        </span>
      </div>
    </div>
  );
}
