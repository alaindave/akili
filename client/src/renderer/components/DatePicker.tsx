import { useCallback, useEffect, useMemo, useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { fr } from "date-fns/locale";
import { Box, Flex, FormControl } from "@chakra-ui/react";

import "react-datepicker/dist/react-datepicker.css";

registerLocale("fr", fr);

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export interface DateRange {
  startDate: string | Date;
  endDate: string | Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  minDate?: string | Date;
  maxDate?: string | Date;
  disabled?: boolean;
}

/*
 * ============================================================
 * DATE HELPERS
 * ============================================================
 */

/**
 * Convert YYYY-MM-DD or Date into a LOCAL Date.
 *
 * We intentionally do NOT use:
 *
 * new Date("2026-08-30")
 *
 * because that is parsed as UTC and can shift the date
 * depending on timezone.
 */
function toLocalDate(value?: string | Date): Date | null {
  if (!value) {
    return null;
  }

  /*
   * Date object
   */
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  /*
   * Only accept YYYY-MM-DD.
   */
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  /*
   * Reject invalid dates such as:
   *
   */
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Convert Date → YYYY-MM-DD.
 */
function formatDatabaseDate(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDateValue(value?: string | Date): string {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return formatDatabaseDate(value);
  }

  return value;
}

function preventManualDateTyping(event: React.KeyboardEvent<HTMLElement>) {
  const allowedKeys = new Set([
    "Tab",
    "Escape",
    "Enter",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
  ]);

  if (allowedKeys.has(event.key)) {
    return;
  }
  event.preventDefault();
}

/*
 * ============================================================
 * COMPONENT
 * ============================================================
 */

export default function DateRangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
}: DateRangePickerProps) {
  /*
   * ============================================================
   * NORMALIZE PARENT VALUES
   * ============================================================
   */

  const normalizedStartDate = useMemo(
    () => normalizeDateValue(value.startDate),
    [value.startDate]
  );

  const normalizedEndDate = useMemo(
    () => normalizeDateValue(value.endDate),
    [value.endDate]
  );

  /*
   * ============================================================
   * LOCAL PICKER STATE
   * ============================================================
   *
   * react-datepicker receives stable Date objects.
   */

  const [startDate, setStartDate] = useState<Date | null>(() =>
    toLocalDate(normalizedStartDate)
  );

  const [endDate, setEndDate] = useState<Date | null>(() =>
    toLocalDate(normalizedEndDate)
  );

  /*
   * ============================================================
   * PARENT → LOCAL SYNCHRONIZATION
   * ============================================================
   */

  useEffect(() => {
    const nextDate = toLocalDate(normalizedStartDate);

    setStartDate((current) => {
      const currentString = formatDatabaseDate(current);
      const nextString = formatDatabaseDate(nextDate);

      /*
       * Do not update React state if the actual date did not
       * change.
       */
      if (currentString === nextString) {
        return current;
      }

      return nextDate;
    });
  }, [normalizedStartDate]);

  useEffect(() => {
    const nextDate = toLocalDate(normalizedEndDate);

    setEndDate((current) => {
      const currentString = formatDatabaseDate(current);
      const nextString = formatDatabaseDate(nextDate);

      /*
       * Do not update React state if the actual date did not
       * change.
       */
      if (currentString === nextString) {
        return current;
      }

      return nextDate;
    });
  }, [normalizedEndDate]);

  /*
   * ============================================================
   * MIN / MAX DATES
   * ============================================================
   */

  const parsedMinDate = useMemo(() => toLocalDate(minDate), [minDate]);

  const parsedMaxDate = useMemo(() => toLocalDate(maxDate), [maxDate]);

  /*
   * ============================================================
   * START DATE
   * ============================================================
   */

  const handleStartDateChange = useCallback(
    (date: Date | null) => {
      /*
       * Update local state immediately.
       */
      setStartDate(date);

      /*
       * User cleared the date.
       */
      if (!date) {
        onChange({
          startDate: "",
          endDate: normalizedEndDate,
        });

        return;
      }

      const newStartDate = formatDatabaseDate(date);

      /*
       * If start > end, clear the end date.
       */
      const shouldClearEnd =
        Boolean(normalizedEndDate) && newStartDate > normalizedEndDate;

      if (shouldClearEnd) {
        setEndDate(null);
      }

      onChange({
        startDate: newStartDate,
        endDate: shouldClearEnd ? "" : normalizedEndDate,
      });
    },
    [normalizedEndDate, onChange]
  );

  /*
   * ============================================================
   * END DATE
   * ============================================================
   */

  const handleEndDateChange = useCallback(
    (date: Date | null) => {
      /*
       * User cleared the date.
       */
      if (!date) {
        setEndDate(null);

        onChange({
          startDate: normalizedStartDate,
          endDate: "",
        });

        return;
      }

      const newEndDate = formatDatabaseDate(date);

      /*
       * Never allow:
       *
       * endDate < startDate
       */
      if (normalizedStartDate && newEndDate < normalizedStartDate) {
        return;
      }

      setEndDate(date);

      onChange({
        startDate: normalizedStartDate,
        endDate: newEndDate,
      });
    },
    [normalizedStartDate, onChange]
  );

  /*
   * ============================================================
   * VALIDATION
   * ============================================================
   */

  const invalidRange =
    Boolean(normalizedStartDate) &&
    Boolean(normalizedEndDate) &&
    normalizedEndDate < normalizedStartDate;

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <Box>
      <Flex gap={2} align="end" flexWrap="wrap">
        {/* ================================================== */}
        {/* START DATE */}
        {/* ================================================== */}

        <FormControl
          width="auto"
          minW="180px"
          isInvalid={invalidRange}
          isDisabled={disabled}
        >
          <DatePicker
            selected={startDate}
            onChange={handleStartDateChange}
            locale="fr"
            dateFormat="dd/MM/yyyy"
            placeholderText="JJ/MM/AAAA"
            minDate={parsedMinDate ?? undefined}
            maxDate={endDate ? endDate : parsedMaxDate ?? undefined}
            showPopperArrow={false}
            isClearable
            disabled={disabled}
            autoComplete="off"
            className="date-range-picker-input"
            onKeyDown={preventManualDateTyping}
          />
        </FormControl>

        <Box pb="10px" color="gray.500" fontSize="14px" userSelect="none">
          →
        </Box>

        {/* ================================================== */}
        {/* END DATE */}
        {/* ================================================== */}

        <FormControl
          width="auto"
          minW="180px"
          isInvalid={invalidRange}
          isDisabled={disabled}
        >
          <DatePicker
            selected={endDate}
            onChange={handleEndDateChange}
            locale="fr"
            dateFormat="dd/MM/yyyy"
            placeholderText="JJ/MM/AAAA"
            minDate={startDate ?? parsedMinDate ?? undefined}
            maxDate={parsedMaxDate ?? undefined}
            showPopperArrow={false}
            isClearable
            disabled={disabled}
            autoComplete="off"
            className="date-range-picker-input"
            /*
             * Prevent manual date editing.
             */
            onKeyDown={preventManualDateTyping}
          />
        </FormControl>
      </Flex>

      {/* ==================================================== */}
      {/* STYLES */}
      {/* ==================================================== */}

      <style>
        {`
    .date-range-picker-input {
      width: 180px;
      height: 40px;

      padding: 0 12px;

      border: 1px solid #A0AEC0;
      border-radius: 6px;

      background: white;

      font-size: 16px;
      color: #1A202C;

      outline: none;

      box-sizing: border-box;

      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;

      cursor: pointer;
    }

    .date-range-picker-input:hover {
      border-color: #718096;
    }

    .date-range-picker-input:focus {
      border-color: #4A5568;

      box-shadow:
        0 0 0 1px #4A5568;
    }

    .date-range-picker-input:disabled {
      background: #F7FAFC;
      color: #A0AEC0;
      cursor: not-allowed;
    }

    .date-range-picker-input::placeholder {
      color: #718096;
    }

    /*
     * ==================================================
     * CALENDAR
     * ==================================================
     */

    .react-datepicker {
      font-family: inherit;

      border: 1px solid #A0AEC0;
      border-radius: 8px;

      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.12);

      overflow: hidden;
    }

    .react-datepicker__header {
      background: white;
      border-bottom: 1px solid #A0AEC0;
    }

    .react-datepicker__current-month {
      font-size: 16px;
      font-weight: 600;
      color: #1A202C;
    }

    .react-datepicker__day-name {
      color: #718096;
      font-size: 12px;
    }

    .react-datepicker__day {
      border-radius: 4px;
      font-size: 13px;
    }

    .react-datepicker__day:hover {
      border-radius: 4px;
    }

    .react-datepicker__day--selected,
    .react-datepicker__day--keyboard-selected {
      border-radius: 4px;
    }

    .react-datepicker__navigation {
      top: 8px;
    }
  `}
      </style>
    </Box>
  );
}
