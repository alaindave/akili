import {
  Box,
  Button,
  Editable,
  EditableInput,
  EditablePreview,
  Grid,
  HStack,
  Text,
  Tooltip,
  Image,
  Badge,
} from "@chakra-ui/react";
import { memo, useEffect, useState } from "react";
import { GiClockwork } from "react-icons/gi";
import { FaWindowClose } from "react-icons/fa";
import { FaLock } from "react-icons/fa";
import ClockIn from "./ClockIn";
import type { AttendanceWithEmployee } from "../../../../../common/types/attendance/Attendance";
import defaultAvatar from "../../../../assets/default-avatar.jpeg";
import { useUpdateAttendance } from "../hooks/useAttendance";
import { useEmployee } from "../../employees/hooks/useEmployees";
import useAdminUser from "../../../../../store/auth.store";

interface Props {
  attendance: AttendanceWithEmployee | null;
  selectedDate: string;
  onDelete: () => void;
  gridTemplate: string;
  isUnlocked: boolean;
  toggleOff: () => void;
}

type ClockOutMode = "idle" | "editing" | "submitting" | "completed";

/* =========================================================
   FORMAT TIME
========================================================= */

const formatTime = (input?: string | Date | null) => {
  if (!input) return "";

  const raw = String(input).trim();

  // ISO STRING
  const iso = new Date(raw);

  if (!Number.isNaN(iso.getTime()) && raw.includes("T")) {
    return `${String(iso.getHours()).padStart(2, "0")}:${String(
      iso.getMinutes()
    ).padStart(2, "0")}`;
  }

  const cleaned = raw.replace(/[hH]/g, ":");

  // HHMM
  if (/^\d{4}$/.test(cleaned)) {
    const hours = Number(cleaned.slice(0, 2));
    const minutes = Number(cleaned.slice(2, 4));

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours > 23 ||
      minutes > 59
    ) {
      return "";
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}`;
  }

  // HMM
  if (/^\d{3}$/.test(cleaned)) {
    const hours = Number(cleaned.slice(0, 1));
    const minutes = Number(cleaned.slice(1, 3));

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours > 23 ||
      minutes > 59
    ) {
      return "";
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}`;
  }

  // HH:MM / H:MM
  const match = cleaned.match(/^(\d{1,2}):(\d{1,2})$/);

  if (!match) return "";

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours > 23 ||
    minutes > 59
  ) {
    return "";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
};

/* =========================================================
   COMPONENT
========================================================= */

const EmployeeAttendanceCard = ({
  attendance,
  selectedDate,
  onDelete,
  gridTemplate,
  isUnlocked,
  toggleOff,
}: Props) => {
  const user = useAdminUser((store) => store.adminUser);

  /*
   * Hooks MUST be called before any conditional return.
   */

  const employeeId = attendance?.employeeId;
  const attendanceId = attendance?._id;

  /* =========================================================
     REACT QUERY
  ========================================================= */

  const { data: employee } = useEmployee(employeeId);

  const updateAttendanceMutation = useUpdateAttendance(user.companyId);

  /* =========================================================
     LOCAL ATTENDANCE STATE
  ========================================================= */

  const [localAttendance, setLocalAttendance] =
    useState<AttendanceWithEmployee | null>(attendance);

  const [errorMessage, setErrorMessage] = useState("");

  const [clockOutMode, setClockOutMode] = useState<ClockOutMode>("idle");

  const [clockOutValue, setClockOutValue] = useState("");

  const [draftClockOut, setDraftClockOut] = useState("");

  const [photoUrl, setPhotoUrl] = useState("");

  /* =========================================================
     SYNC PROP -> LOCAL STATE
     
     This only happens when the parent actually gives us a
     different attendance record.
  ========================================================= */

  useEffect(() => {
    setLocalAttendance((previous) => {
      if (!attendance) {
        return null;
      }

      /*
       * Preserve our optimistic local clockOut while a mutation
       * is running.
       */
      if (
        updateAttendanceMutation.isPending &&
        previous?._id === attendance._id
      ) {
        return previous;
      }

      return attendance;
    });
  }, [attendance, updateAttendanceMutation.isPending]);

  /* =========================================================
     SYNC CLOCK OUT DISPLAY
  ========================================================= */

  useEffect(() => {
    if (!localAttendance?.clockOut) {
      setClockOutValue("");
      return;
    }

    const formatted = formatTime(localAttendance.clockOut);

    setClockOutValue(formatted);

    /*
     * Don't overwrite the user's input while editing.
     */
    if (clockOutMode === "idle" || clockOutMode === "completed") {
      setDraftClockOut(formatted);
    }
  }, [localAttendance?.clockOut, clockOutMode]);

  /* =========================================================
     LOAD EMPLOYEE PHOTO
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadPhoto() {
      if (!employee?.photo_path) {
        setPhotoUrl("");
        return;
      }

      try {
        const base64 = await window.electron.hr.employees.getPhotoUrl(
          employee.photo_path
        );

        if (!cancelled) {
          setPhotoUrl(`data:image/jpeg;base64,${base64}`);
        }
      } catch (error) {
        console.error("FAILED TO LOAD EMPLOYEE PHOTO:", error);

        if (!cancelled) {
          setPhotoUrl("");
        }
      }
    }

    loadPhoto();

    return () => {
      cancelled = true;
    };
  }, [employee?.photo_path]);

  /* =========================================================
     ERROR MESSAGE TIMER
  ========================================================= */

  useEffect(() => {
    if (!errorMessage) return;

    const timeout = setTimeout(() => {
      setErrorMessage("");

      if (clockOutValue) {
        setDraftClockOut(formatTime(clockOutValue));
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [errorMessage, clockOutValue]);

  /* =========================================================
     GUARD
  ========================================================= */

  if (!attendance || attendance.date !== selectedDate) {
    return null;
  }

  if (!localAttendance) {
    return null;
  }

  /* =========================================================
     TOGGLE CLOCK OUT
  ========================================================= */

  const handleToggleClockOut = () => {
    if (clockOutMode === "editing") {
      setDraftClockOut("");
      setClockOutMode("idle");
      return;
    }

    const now = new Date();

    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    setDraftClockOut(currentTime);
    setClockOutMode("editing");
  };

  /* =========================================================
     CREATE CLOCK OUT
  ========================================================= */

  const handleSubmitClockOut = async () => {
    console.log("CLOCKOUT UPDATED", attendance.clockOut);

    const formattedClockOut = formatTime(draftClockOut);

    if (!formattedClockOut) {
      setErrorMessage("Heure invalide");
      return;
    }

    if (!attendanceId) {
      console.error("Cannot clock out: attendance ID is missing.");
      return;
    }

    try {
      setClockOutMode("submitting");

      const [hours, minutes] = formattedClockOut.split(":").map(Number);

      const clockOutDate = new Date();

      clockOutDate.setHours(hours, minutes, 0, 0);

      const clockOutISO = clockOutDate.toISOString();

      /*
       * =====================================================
       * OPTIMISTIC UPDATE
       * =====================================================
       *
       * Update this card immediately.
       */
      setLocalAttendance((previous) => {
        if (!previous) return null;

        return {
          ...previous,
          clockOut: clockOutISO,
        };
      });

      setClockOutValue(formattedClockOut);
      setDraftClockOut(formattedClockOut);

      /*
       * React Query mutation.
       */
      const updated = await updateAttendanceMutation.mutateAsync({
        _id: attendanceId,
        employeeId: attendance.employeeId,
        date: selectedDate,
        updates: {
          clockOut: clockOutISO,
        },
      });

      /*
       * Use the database result after success.
       */
      if (updated) {
        setLocalAttendance((previous) => {
          if (!previous) return updated;

          console.log("CLOCKOUT UPDATED", updated);
          return {
            ...previous,
            ...updated,
          };
        });
      }

      setClockOutMode("completed");

      toggleOff();
    } catch (error) {
      console.error("ERROR CLOCKING OUT:", error);

      /*
       * Restore the original attendance if the mutation fails.
       */
      setLocalAttendance(attendance);

      const originalClockOut = formatTime(attendance.clockOut);

      setClockOutValue(originalClockOut);
      setDraftClockOut(originalClockOut);

      setClockOutMode("editing");
      setErrorMessage("Impossible d'enregistrer l'heure.");
    }
  };

  /* =========================================================
     EDIT EXISTING CLOCK OUT
  ========================================================= */

  const handleEditClockOut = async () => {
    const formattedClockOut = formatTime(draftClockOut);
    if (!attendance.clockOut) return;
    if (!formattedClockOut) {
      setErrorMessage("Heure invalide");
      return false;
    }

    if (!localAttendance.clockOut) {
      console.error("Cannot update clock out: existing clock out is missing.");

      return false;
    }

    if (!attendanceId) {
      console.error("Cannot update clock out: attendance ID is missing.");

      return false;
    }

    try {
      const [hours, minutes] = formattedClockOut.split(":").map(Number);

      const updatedClockOut = new Date(localAttendance.clockOut);

      if (Number.isNaN(updatedClockOut.getTime())) {
        console.error(
          "Cannot update clock out: existing clock out is invalid:",
          localAttendance.clockOut
        );

        setErrorMessage("Heure invalide");

        return false;
      }

      updatedClockOut.setHours(hours, minutes, 0, 0);

      const clockOutISO = updatedClockOut.toISOString();

      /*
       * =====================================================
       * OPTIMISTIC UPDATE
       * =====================================================
       */

      setLocalAttendance((previous) => {
        if (!previous) return null;

        return {
          ...previous,
          clockOut: clockOutISO,
        };
      });

      setDraftClockOut(formattedClockOut);
      setClockOutValue(formattedClockOut);

      const updatedAttendance = await updateAttendanceMutation.mutateAsync({
        _id: attendanceId,
        employeeId: attendance.employeeId,
        date: selectedDate,
        updates: {
          clockOut: clockOutISO,
        },
      });

      if (updatedAttendance) {
        setLocalAttendance((previous) => {
          if (!previous) return updatedAttendance;

          return {
            ...previous,
            ...updatedAttendance,
          };
        });
      }

      toggleOff();

      return true;
    } catch (error) {
      console.error("ERROR EDITING CLOCK OUT:", error);

      /*
       * Restore previous value.
       */
      setLocalAttendance(attendance);

      const originalClockOut = formatTime(attendance.clockOut);

      setClockOutValue(originalClockOut);
      setDraftClockOut(originalClockOut);

      setErrorMessage("Impossible de modifier l'heure.");

      return false;
    }
  };

  /* =========================================================
     REFRESH ATTENDANCE
  ========================================================= */

  const refreshAttendance = () => {
    toggleOff?.();
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <Grid
      templateColumns={gridTemplate}
      alignItems="center"
      px={2}
      py={2}
      bg="#ffffff"
      borderWidth="0.3px"
      border="1px solid #E2E8F0"
      boxShadow="0 2px 10px rgba(15,23,42,.06)"
      width="78.5vw"
      minH="5rem"
      ml="1rem"
      mr="0.5rem"
    >
      {/* =====================================================
          EMPLOYEE NAME
      ====================================================== */}

      <HStack>
        <Image
          src={photoUrl || defaultAvatar}
          boxSize="70px"
          borderRadius="full"
          fit="cover"
        />

        <Text
          color="gray.800"
          fontWeight="600"
          fontSize="1.05rem"
          whiteSpace="normal"
          wordBreak="break-word"
          maxW="7rem"
          noOfLines={2}
        >
          {employee?.firstName ?? attendance.firstName}{" "}
          {employee?.lastName ?? attendance.lastName}
        </Text>
      </HStack>

      {/* =====================================================
          EMPLOYEE ID
      ====================================================== */}

      <Text color="gray.600" fontWeight="500" fontSize="1.05rem">
        {employee?.matricule ?? attendance.matricule}
      </Text>

      {/* =====================================================
          ROLE
      ====================================================== */}

      <Text color="gray.600" fontWeight="500" fontSize="1.05rem">
        {employee?.role ?? attendance.role}
      </Text>

      {/* =====================================================
          DEPARTMENT
      ====================================================== */}

      <Text color="gray.600" fontWeight="500" fontSize="1.05rem">
        {employee?.department ?? attendance.department}
      </Text>

      {/* =====================================================
          CLOCK IN
      ====================================================== */}

      <Box>
        <ClockIn
          isUnlocked={isUnlocked}
          date={selectedDate}
          attendance={localAttendance}
          onRefresh={refreshAttendance}
          awayStatus={
            localAttendance.status === "ABSENT" ||
            localAttendance.status === "CONGÉ"
              ? localAttendance.status
              : null
          }
        />
      </Box>

      {/* =====================================================
          CLOCK OUT
      ====================================================== */}

      <Box
        width="90px"
        minWidth="90px"
        display="flex"
        alignItems="center"
        justifyContent="flex-start"
      >
        {localAttendance.clockOut ? (
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
              right="1rem"
              value={draftClockOut}
              onChange={setDraftClockOut}
              submitOnBlur={false}
              selectAllOnFocus
              width="80px"
              onSubmit={handleEditClockOut}
              isDisabled={!isUnlocked || updateAttendanceMutation.isPending}
            >
              <EditablePreview
                color="purple.700"
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

                  setDraftClockOut(formatTime(clockOutValue));
                }}
                onBlur={() => {
                  if (!formatTime(draftClockOut)) {
                    setErrorMessage("Heure invalide");
                  }
                }}
              />
            </Editable>
          </Tooltip>
        ) : clockOutMode === "editing" || clockOutMode === "submitting" ? (
          <Tooltip
            label={errorMessage}
            bg="red.600"
            color="white"
            hasArrow
            placement="top"
            isOpen={!!errorMessage}
          >
            <Editable
              value={draftClockOut}
              onChange={setDraftClockOut}
              onSubmit={handleSubmitClockOut}
              submitOnBlur={false}
              selectAllOnFocus
              width="80px"
              isDisabled={clockOutMode === "submitting"}
            >
              <EditablePreview
                color="red.500"
                fontSize="18px"
                px={2}
                width="80px"
                animation={
                  clockOutMode === "submitting" ? "none" : "pulse 1.7s infinite"
                }
                sx={{
                  "@keyframes pulse": {
                    "0%": {
                      opacity: 1,
                    },
                    "50%": {
                      opacity: 0.3,
                    },
                    "100%": {
                      opacity: 1,
                    },
                  },
                }}
              />

              <EditableInput
                color="brown"
                fontSize="18px"
                width="80px"
                onFocus={() => {
                  setErrorMessage("");
                  setDraftClockOut(formatTime(draftClockOut));
                }}
                onBlur={() => {
                  if (!formatTime(draftClockOut)) {
                    setErrorMessage("Heure invalide");
                  }
                }}
              />
            </Editable>
          </Tooltip>
        ) : localAttendance.status === "ABSENT" ||
          localAttendance.status === "CONGÉ" ? (
          <Badge
            fontSize="0.9rem"
            bg={localAttendance.status === "CONGÉ" ? "#3182CE" : "#E53E3E"}
            color="gray.200"
            mt="0.25rem"
          >
            {localAttendance.status}
          </Badge>
        ) : (
          <Badge bg="#ECFDF5" color="#047857" fontSize="0.85rem">
            En cours
          </Badge>
        )}
      </Box>

      {/* =====================================================
          ACTION BUTTONS
      ====================================================== */}

      {isUnlocked ? (
        <Box position="relative" right="1rem">
          {!localAttendance.clockOut &&
          localAttendance.status !== "ABSENT" &&
          localAttendance.status !== "CONGÉ" ? (
            <Button
              bg="transparent"
              _hover={{
                bg: "transparent",
              }}
              color={clockOutMode === "editing" ? "red.300" : "yellow.600"}
              onClick={handleToggleClockOut}
              isDisabled={updateAttendanceMutation.isPending}
            >
              <GiClockwork size="1.8rem" />
            </Button>
          ) : (
            <Button
              bg="transparent"
              _hover={{
                bg: "transparent",
              }}
              color="red.600"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={onDelete}
            >
              <FaWindowClose size="1.1rem" />
            </Button>
          )}
        </Box>
      ) : (
        <Box>
          <FaLock size="1.3rem" color="#D4A017" />
        </Box>
      )}
    </Grid>
  );
};

export default memo(EmployeeAttendanceCard);
