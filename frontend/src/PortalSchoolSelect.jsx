import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export default function PortalSchoolSelect({
  schools = [],
  value,
  onChange,
  label = "Select school",
  all = true,
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);

  const selected =
    value === "all"
      ? { name: "All schools" }
      : schools.find((item) => item._id === value);

  const options = useMemo(
    () =>
      [
        ...(all ? [{ _id: "all", name: "All schools" }] : []),
        ...schools,
      ].filter((item) =>
        `${item.name} ${item.centerId || ""}`
          .toLowerCase()
          .includes(input.trim().toLowerCase()),
      ),
    [all, schools, input],
  );

  const placeMenu = () => {
    const box = inputRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = Math.min(Math.max(box.width, 230), window.innerWidth - 16);
    const maxTop = Math.max(8, window.innerHeight - 245);

    setRect({
      top: Math.min(box.bottom + 5, maxTop),
      left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)),
      width,
    });
  };

  const openMenu = () => {
    setInput("");
    placeMenu();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const reposition = () => placeMenu();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const choose = (item) => {
    onChange(item._id);
    setInput("");
    setOpen(false);
  };

  return (
    <div className="school-combobox dashboard-school-combobox">
      <input
        ref={inputRef}
        aria-label={label}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="dashboard-school-options"
        placeholder={label}
        value={
          open
            ? input
            : `${selected?.name || label}${selected?.centerId ? ` (${selected.centerId})` : ""}`
        }
        onFocus={() => {
          if (!open) openMenu();
        }}
        onClick={() => {
          if (!open) openMenu();
        }}
        onChange={(event) => setInput(event.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setInput("");
          }

          if (event.key === "ArrowDown" && !open) openMenu();

          if (event.key === "Enter") {
            event.preventDefault();
            if (options[0]) choose(options[0]);
          }
        }}
      />
      <ChevronDown size={14} />
      {open &&
        rect &&
        createPortal(
          <div
            id="dashboard-school-options"
            className="dashboard-school-menu"
            role="listbox"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            {options.length ? (
              options.map((item) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={item._id === value}
                  key={item._id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                >
                  {item.name}
                  {item.centerId ? ` (${item.centerId})` : ""}
                </button>
              ))
            ) : (
              <small>No matching schools</small>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
