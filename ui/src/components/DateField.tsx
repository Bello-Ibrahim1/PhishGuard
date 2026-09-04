import DatePicker from "react-datepicker";
import { parseYMD, formatYMD } from "../format";

/** A single day/month/year field for the report date-range filter — typing a date directly
 *  and picking one from a calendar are both first-class here, not an either/or:
 *   - Typing: the field is a normal text input (dateFormat="MM/dd/yyyy"), so you can just
 *     type a date and tab out.
 *   - Picking: clicking it opens a calendar with the days of the month laid out in a real
 *     Sun-Sat grid; the month and year in the header are themselves native <select> dropdowns
 *     (showMonthDropdown/showYearDropdown, dropdownMode="select"), so jumping to "December"
 *     or "2019" is its own pop-open list rather than clicking next/prev a dozen times.
 *  Values in and out are plain "YYYY-MM-DD" strings (see parseYMD/formatYMD in format.ts) —
 *  everything else on this page already speaks that format (the URL, the filter state). */
export function DateField({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder,
}: {
  value: string; // "" | "YYYY-MM-DD"
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
}) {
  return (
    <DatePicker
      selected={value ? parseYMD(value) : null}
      onChange={(d: Date | null) => onChange(d ? formatYMD(d) : "")}
      minDate={minDate ? parseYMD(minDate) ?? undefined : undefined}
      maxDate={maxDate ? parseYMD(maxDate) ?? undefined : undefined}
      dateFormat="MM/dd/yyyy"
      placeholderText={placeholder || "MM/DD/YYYY"}
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      isClearable
      className="pg-date-input"
      calendarClassName="pg-datepicker"
      wrapperClassName="pg-date-wrapper"
    />
  );
}
