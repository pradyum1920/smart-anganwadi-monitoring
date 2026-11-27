import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const DashboardFiltersContext = createContext(null);

const readSchoolFromUrl = () =>
  new URLSearchParams(window.location.search).get("school") || "all";

export function DashboardFiltersProvider({ children }) {
  const [schoolId, setSchoolIdState] = useState(readSchoolFromUrl);
  const [studentsSchoolId, setStudentsSchoolId] = useState(readSchoolFromUrl);
  const [attendanceSchoolId, setAttendanceSchoolId] =
    useState(readSchoolFromUrl);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const next = readSchoolFromUrl();
      setSchoolIdState(next);
      setStudentsSchoolId(next);
      setAttendanceSchoolId(next);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const persistUrl = useCallback((id) => {
    const url = new URL(window.location.href);
    url.searchParams.set("school", id || "all");
    window.history.replaceState({}, "", url);
  }, []);

  const selectSchool = useCallback(
    (card, id) => {
      const selected = id || "all";
      setSchoolIdState(selected);
      persistUrl(selected);
      if (card === "students") setStudentsSchoolId(selected);
      if (card === "attendance") setAttendanceSchoolId(selected);

      if (linked) {
        setStudentsSchoolId(selected);
        setAttendanceSchoolId(selected);
      }
    },
    [linked, persistUrl],
  );

  const toggleLinked = useCallback(
    (value) => {
      setLinked(value);

      if (value) {
        setStudentsSchoolId(schoolId);
        setAttendanceSchoolId(schoolId);
      }
    },
    [schoolId],
  );

  const value = useMemo(
    () => ({
      schoolId,
      studentsSchoolId,
      attendanceSchoolId,
      linked,
      selectSchool,
      toggleLinked,
    }),
    [
      schoolId,
      studentsSchoolId,
      attendanceSchoolId,
      linked,
      selectSchool,
      toggleLinked,
    ],
  );

  return (
    <DashboardFiltersContext.Provider value={value}>
      {children}
    </DashboardFiltersContext.Provider>
  );
}

export function useDashboardFilters() {
  const value = useContext(DashboardFiltersContext);

  if (!value)
    throw new Error(
      "useDashboardFilters must be used inside DashboardFiltersProvider",
    );

  return value;
}
