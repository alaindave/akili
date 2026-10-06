import { useEffect, useState } from "react";
import Select from "react-select";

interface Props {
  onChange?: (month: string) => void;
}

interface Option {
  label: string;
  value: string;
}

function getLast12Months(): Option[] {
  const months: Option[] = [];

  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);

    months.push({
      label: date.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      }),
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`,
    });
  }

  return months;
}

export default function MonthDropDown({ onChange }: Props) {
  const options = getLast12Months();
  const [selected, setSelected] = useState<Option | null>(options[0] || null);

  useEffect(() => {
    console.log("MonthDropdown mounted");
    return () => {
      console.log("MonthDropdown unmounted");
    };
  }, []);

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
          borderColor: state.isFocused ? "#3b82f6" : "#374151",
          boxShadow: state.isFocused ? "0 0 0 2px #3b82f6" : "none",
          "&:hover": {
            borderColor: "#3b82f6",
          },
        }),
      }}
    />
  );
}
