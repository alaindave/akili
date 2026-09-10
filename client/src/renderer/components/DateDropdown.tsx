import { useState } from "react";
import Select from "react-select";

const formatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getDaysBetweenDates(startDate: Date | string, endDate: Date | string) {
  const date1 = new Date(startDate);
  const date2 = new Date(endDate);

  // Convert both dates to UTC timestamps to ignore Daylight Saving Time (DST)
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());

  // One day in milliseconds: 1000s * 60m * 60h * 24d
  const oneDay = 1000 * 60 * 60 * 24;

  // Calculate the absolute difference and convert to days
  return Math.floor(Math.abs(utc2 - utc1) / oneDay);
}

// Example usage:
const start = "2026-08-01";
const end = "2026-08-30";
console.log(getDaysBetweenDates(start, end)); // Output: 29

function getSelectedDays(startDate: Date | string, endDate: Date | string) {
  const days = [];
  let i = 0;

  const numberOfDays = getDaysBetweenDates(startDate, endDate);

  while (days.length <= numberOfDays) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);

    days.push({
      label: formatDate(date),
      value: formatter.format(date),
    });

    i++;
  }

  return days;
}

function formatDate(date: Date) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  const formatted = date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return isToday ? `Aujurd'hui:${formatted} ` : formatted;
}

interface Props {
  startDate: Date | string;
  endDate: Date | string;
  onChange?: (date: string) => void;
}

interface Option {
  label: string;
  value: string;
}

export default function DateDropdown({ startDate, endDate, onChange }: Props) {
  const options: Option[] = getSelectedDays(startDate, endDate);
  const [selected, setSelected] = useState<Option | null>(options[0]);
  function handleChange(option: Option | null) {
    if (option) {
      setSelected(option);
      onChange?.(option.value);
    }
  }

  return (
    <Select
      options={options}
      value={selected}
      onChange={handleChange}
      isSearchable={false}
      menuPlacement="top"
      styles={{
        control: (base, state) => ({
          ...base,
          borderColor: state.isFocused ? "#6B7280" : "#9CA3AF",
          boxShadow: state.isFocused ? "0 0 0 1px #6B7280" : "none",
          "&:hover": {
            borderColor: "#6B7280",
          },
        }),
      }}
    />
  );
}
