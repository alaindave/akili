import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Text,
  VStack,
  HStack,
  Editable,
  EditableInput,
  EditablePreview,
  Tooltip,
  Box,
  useDisclosure,
  Badge,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { AttendanceWithEmployee } from "../../../../../common/types/Attendance";
import { useUpdateAttendance } from "../hooks/useAttendance";
import useAdminUser from "../../../../../store/auth.store";

interface Props {
  attendance?: AttendanceWithEmployee | null;
  date: string;
  onRefresh?: () => void;
  isUnlocked: boolean;
  awayStatus?: "ABSENT" | "CONGÉ" | null;
}

/* =========================================================
   FORMAT LATE MINUTES
========================================================= */

export const formatLateMinutes = (lateMinutes: number): string => {
  if (lateMinutes < 60) {
    return `${lateMinutes} min`;
  }

  const hours = Math.floor(lateMinutes / 60);
  const minutes = lateMinutes % 60;

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
};

/* =========================================================
   FORMAT TIME
========================================================= */

const formatTime = (input?: string | Date | null) => {
  if (!input) return null;

  const raw = String(input).trim();

  /* =====================================================
     ISO STRING
  ===================================================== */

  const iso = new Date(raw);

  if (!Number.isNaN(iso.getTime()) && raw.includes("T")) {
    return `${String(iso.getHours()).padStart(2, "0")}:${String(
      iso.getMinutes()
    ).padStart(2, "0")}`;
  }

  const cleaned = raw.replace(/[hH]/g, ":");

  /* =====================================================
     HHMM
     Example: 1830
  ===================================================== */

  if (/^\d{4}$/.test(cleaned)) {
    const hours = Number(cleaned.slice(0, 2));
    const minutes = Number(cleaned.slice(2, 4));

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours > 23 ||
      minutes > 59
    ) {
      return null;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}`;
  }

  /* =====================================================
     HMM
     Example: 930
  ===================================================== */

  if (/^\d{3}$/.test(cleaned)) {
    const hours = Number(cleaned.slice(0, 1));
    const minutes = Number(cleaned.slice(1, 3));

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours > 23 ||
      minutes > 59
    ) {
      return null;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}`;
  }

  /* =====================================================
     HH:MM / H:MM
  ===================================================== */

  const match = cleaned.match(/^(\d{1,2}):(\d{1,2})$/);

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours > 23 ||
    minutes > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
};

/* =========================================================
   COMPONENT
========================================================= */

const ClockIn = ({
  attendance,
  date,
  onRefresh,
  isUnlocked,
  awayStatus,
}: Props) => {
  const user = useAdminUser((store) => store.adminUser);

  const updateAttendanceMutation = useUpdateAttendance(user.companyId);

  /* =====================================================
     LOCAL STATE
  ===================================================== */

  const initialClockIn = formatTime(attendance?.clockIn);

  const [clockInValue, setClockInValue] = useState<string | null>(
    initialClockIn
  );

  const [draftClockIn, setDraftClockIn] = useState<string | null>(
    initialClockIn
  );

  const [errorMessage, setErrorMessage] = useState("");

  const { isOpen, onOpen, onClose } = useDisclosure();

  if (!attendance) return null;

  /* =====================================================
     KEEP LOCAL DISPLAY IN SYNC WITH QUERY DATA
  ===================================================== */

  useEffect(() => {
    if (!attendance?.clockIn) {
      setClockInValue(null);
      setDraftClockIn(null);
      return;
    }

    const formatted = formatTime(attendance.clockIn);

    setClockInValue(formatted);
    setDraftClockIn(formatted);
  }, [attendance?.clockIn]);

  /* =====================================================
     ERROR RESET
  ===================================================== */

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setErrorMessage("");

      setDraftClockIn(formatTime(clockInValue));
    }, 2000);

    return () => clearTimeout(timeout);
  }, [errorMessage, clockInValue]);

  /* =====================================================
     EDIT CLOCK IN
  ===================================================== */

  const handleEditClockIn = async () => {
    const formattedClockIn = formatTime(draftClockIn);

    /* -----------------------------------------------------
       Validate
    ----------------------------------------------------- */

    if (!formattedClockIn) {
      setErrorMessage("Heure invalide");
      return false;
    }

    /* -----------------------------------------------------
       Validate attendance ID
    ----------------------------------------------------- */

    if (!attendance._id) {
      console.error("Cannot update clock-in: attendance ID is missing.");

      setErrorMessage("Impossible de modifier l'heure.");

      return false;
    }

    try {
      /* ===================================================
         CONVERT TIME
      =================================================== */

      const [hours, minutes] = formattedClockIn.split(":").map(Number);

      const clockInDate = new Date(attendance.date);

      clockInDate.setHours(hours, minutes, 0, 0);

      const clockInISO = clockInDate.toISOString();

      console.log("UPDATING CLOCK IN:", clockInISO);

      /* ===================================================
         OPTIMISTIC LOCAL UI
      =================================================== */

      setClockInValue(formattedClockIn);

      setDraftClockIn(formattedClockIn);

      /* ===================================================
         UPDATE THROUGH REACT QUERY
      =================================================== */

      await updateAttendanceMutation.mutateAsync({
        _id: attendance._id,
        employeeId: attendance.employeeId,
        date,

        updates: {
          clockIn: clockInISO,
        },
      });
      console.log("CLOCK IN UPDATED SUCCESSFULLY");
      onRefresh?.();

      return true;
    } catch (error) {
      console.error("ERROR EDITING CLOCK IN:", error);

      /*
       * Restore the last known valid value.
       */
      setDraftClockIn(formatTime(clockInValue));

      setErrorMessage("Impossible de modifier l'heure.");

      return false;
    }
  };

  /* =========================================================
     ATTENDANCE STATUS / AWAY
  ========================================================= */

  if (awayStatus) {
    return (
      <>
        {attendance.notes?.trim() ? (
          <Popover isOpen={isOpen} onClose={onClose} placement="left">
            <PopoverTrigger>
              <Box
                fontSize="18px"
                color="#FF8787"
                cursor="pointer"
                _hover={{
                  color: "#F2B705",
                }}
                onMouseEnter={onOpen}
                onMouseLeave={onClose}
              >
                <Badge
                  mr="0.3rem"
                  bg={awayStatus === "CONGÉ" ? "#3182CE" : "#E53E3E"}
                  color="gray.200"
                  fontSize="14px"
                >
                  {awayStatus}
                </Badge>
              </Box>
            </PopoverTrigger>

            <PopoverContent
              onMouseEnter={onOpen}
              onMouseLeave={onClose}
              bg="#F8F9FB"
              color="white"
              position="relative"
              right="1rem"
            >
              <PopoverArrow bg="#08162b" />

              <PopoverBody>
                {attendance.notes && (
                  <Text position="relative" color="gray.700">
                    <strong>Justification:</strong> {attendance.notes}
                  </Text>
                )}
              </PopoverBody>
            </PopoverContent>
          </Popover>
        ) : (
          <Badge
            mr="0.3rem"
            bg={awayStatus === "CONGÉ" ? "#3182CE" : "#E53E3E"}
            color="gray.200"
            fontSize="0.9rem"
          >
            {awayStatus}
          </Badge>
        )}
      </>
    );
  }

  /* =========================================================
     CLOCK IN DISPLAY
  ========================================================= */

  const lateMinutes = attendance.lateMinutes ?? 0;

  /* =========================================================
     LATE
  ========================================================= */

  if (lateMinutes > 0) {
    return (
      <Popover isOpen={isOpen} onClose={onClose} placement="left">
        <PopoverTrigger>
          <Text
            fontSize="18px"
            color="#FF8787"
            cursor={isUnlocked ? "pointer" : "default"}
            _hover={{
              color: isUnlocked ? "#F2B705" : "#FF8787",
            }}
            onMouseEnter={onOpen}
            onMouseLeave={onClose}
          >
            <Tooltip
              label={errorMessage}
              bg="red.600"
              color="white"
              hasArrow
              placement="top"
              isOpen={!!errorMessage}
            >
              <Editable
                position="relative"
                bottom="0.1rem"
                value={draftClockIn ?? ""}
                onChange={setDraftClockIn}
                submitOnBlur={false}
                width="80px"
                selectAllOnFocus
                onSubmit={handleEditClockIn}
                isDisabled={!isUnlocked || updateAttendanceMutation.isPending}
              >
                <EditablePreview
                  color="red.600"
                  fontSize="18px"
                  fontWeight="500"
                  px={2}
                  borderRadius="6px"
                  transition="0.2s"
                  cursor={isUnlocked ? "pointer" : "default"}
                  _hover={{
                    bg: "rgba(255,255,255,0.05)",
                    cursor: isUnlocked ? "pointer" : "default",
                  }}
                />

                <EditableInput
                  color="brown"
                  fontSize="18px"
                  width="80px"
                  onFocus={() => {
                    setErrorMessage("");

                    setDraftClockIn(formatTime(clockInValue));
                  }}
                  onBlur={() => {
                    if (!formatTime(draftClockIn)) {
                      setErrorMessage("");
                      setDraftClockIn(formatTime(clockInValue));
                    }
                  }}
                />
              </Editable>
            </Tooltip>
          </Text>
        </PopoverTrigger>

        <PopoverContent
          onMouseEnter={onOpen}
          onMouseLeave={onClose}
          bg="#F8F9FB"
          color="white"
          position="relative"
          right="1rem"
        >
          <PopoverArrow bg="#08162b" />

          <PopoverBody>
            <VStack>
              <HStack>
                {attendance.lateMinutes ? (
                  <Text color="red.700">
                    {formatLateMinutes(attendance.lateMinutes)}
                  </Text>
                ) : null}

                <Text color="gray.800">de retard</Text>
              </HStack>

              {attendance.notes && (
                <Text position="relative" bottom="1rem" color="gray.700">
                  <strong>Justification:</strong> {attendance.notes}
                </Text>
              )}
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    );
  }

  /* =========================================================
     ON TIME
  ========================================================= */

  return (
    <Editable
      position="relative"
      value={draftClockIn ?? ""}
      onChange={setDraftClockIn}
      submitOnBlur={false}
      width="80px"
      selectAllOnFocus
      onSubmit={handleEditClockIn}
      isDisabled={!isUnlocked || updateAttendanceMutation.isPending}
    >
      <Tooltip
        label={errorMessage}
        bg="red.600"
        color="white"
        hasArrow
        placement="top"
        isOpen={!!errorMessage}
      >
        <EditablePreview
          color="green.700"
          fontSize="18px"
          fontWeight="500"
          px={2}
          borderRadius="6px"
          transition="0.2s"
          cursor={isUnlocked ? "pointer" : "default"}
          _hover={{
            bg: "rgba(255,255,255,0.05)",
            cursor: isUnlocked ? "pointer" : "default",
          }}
        />
      </Tooltip>

      <EditableInput
        color="brown"
        fontSize="1.1rem"
        width="80px"
        onFocus={() => {
          setErrorMessage("");

          setDraftClockIn(formatTime(clockInValue));
        }}
        onBlur={() => {
          if (!formatTime(draftClockIn)) {
            setErrorMessage("");

            setDraftClockIn(formatTime(clockInValue));
          }
        }}
      />
    </Editable>
  );
};

export default ClockIn;
