import {
  Badge,
  Box,
  Button,
  Editable,
  EditableInput,
  EditablePreview,
  Flex,
  Icon,
  IconButton,
  Image,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { GiClockwork } from "react-icons/gi";
import { GoDotFill } from "react-icons/go";
import { BsThreeDotsVertical } from "react-icons/bs";
import { Link } from "react-router-dom";
import Leave from "../../../../../common/types/Leave";
import "../../../../styles/App.css";
import AddClockInNotesPopover from "../../attendance/components/AddClockInNotesPopover";
import AbsenceNotesPopover from "../../attendance/components/AbsenceNotesPopover";
import defaultAvatar from "../../../../assets/default-avatar.jpeg";
import { useErrorToast } from "../../../../hooks/useErrorToast";
import {
  useAttendanceRecord,
  useCreateAttendance,
  useCreateAbsenceLeave,
  useUpdateAttendance,
} from "../../attendance/hooks/useAttendance";
import { useEmployee, useUpdateEmployee } from "../hooks/useEmployees";
import useAdminUser from "../../../../../store/auth.store";

interface Props {
  employeeId: string;
}

/* =========================================================
   CLOCK FORMATTER
========================================================= */

function formatClockInTime(input: string): string | null {
  const cleaned = input.trim().replace(/[hH]/g, ":");

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
}

/* =========================================================
   CURRENT DATE
========================================================= */

const date = new Date();

const formatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formattedDate = formatter.format(date);

/* =========================================================
   COMPONENT
========================================================= */

const EmployeeCard = ({ employeeId }: Props) => {
  const [_clockIn, setClockIn] = useState("");

  const [isClockingIn, setIsClockingIn] = useState(false);
  const [displayClock, setDisplayClock] = useState(true);
  const [showEditable, setShowEditable] = useState(false);
  const [photo_url, setPhotoUrl] = useState("");

  const user = useAdminUser((store) => store.adminUser);

  /* =======================================================
     EMPLOYEE QUERY
  ======================================================= */

  const { data: employee, isLoading: loadingEmployee } =
    useEmployee(employeeId);

  /* =======================================================
     TOASTS
  ======================================================= */

  const toast = useToast();
  const showErrorMessage = useErrorToast();

  /* =======================================================
     ATTENDANCE QUERY
  ======================================================= */

  const {
    data: attendance = null,
    isLoading: loadingAttendance,
    refetch: refetchAttendance,
  } = useAttendanceRecord(user.companyId, employeeId, formattedDate);

  /* =======================================================
     ATTENDANCE MUTATIONS
  ======================================================= */

  const { mutateAsync: createAttendance, isPending: isCreatingAttendance } =
    useCreateAttendance(user.companyId);

  const { mutateAsync: updateAttendance, isPending: isUpdatingAttendance } =
    useUpdateAttendance(user.companyId);

  const { mutateAsync: createAbsenceLeave, isPending: isCreatingAbsenceLeave } =
    useCreateAbsenceLeave(user.companyId);

  /* =======================================================
     EMPLOYEE MUTATION
  ======================================================= */

  const { mutateAsync: updateEmployee, isPending: isUpdatingEmployee } =
    useUpdateEmployee();

  /* =======================================================
     COMBINED LOADING STATES
  ======================================================= */

  const isSubmittingAttendance = isCreatingAttendance || isUpdatingAttendance;

  const isSubmittingLeave = isCreatingAbsenceLeave || isUpdatingEmployee;

  /* =======================================================
     FETCH EMPLOYEE PHOTO
  ======================================================= */

  useEffect(() => {
    async function load() {
      if (!employee?.photo_path) {
        setPhotoUrl("");
        return;
      }

      try {
        const base64 = await window.electron.employees.getPhotoUrl(
          employee.photo_path
        );

        setPhotoUrl(`data:image/jpeg;base64,${base64}`);
      } catch (error) {
        console.error("FAILED TO LOAD EMPLOYEE PHOTO:", error);
        setPhotoUrl("");
      }
    }

    load();
  }, [employee?.photo_path]);

  /* =======================================================
     CLOCK IN EDIT
  ======================================================= */

  const handleToggleClockInEdit = () => {
    if (isClockingIn) {
      setClockIn("");
      setShowEditable(false);
      setIsClockingIn(false);

      return;
    }

    const clockIn = new Date();

    const currentClockIn = `${String(clockIn.getHours()).padStart(
      2,
      "0"
    )}:${String(clockIn.getMinutes()).padStart(2, "0")}`;

    setClockIn(currentClockIn);
    setShowEditable(true);
    setIsClockingIn(true);
  };

  /* =======================================================
     CLOCK IN SUBMIT
  ======================================================= */

  const handleClockInSubmit = async () => {
    if (!employee) return;

    const formatted = formatClockInTime(_clockIn);

    if (!formatted) {
      return;
    }

    const [hours, minutes] = formatted.split(":").map(Number);

    const clockIn = new Date();

    clockIn.setHours(hours, minutes, 0, 0);

    const attendanceDate = clockIn.toISOString().split("T")[0];

    try {
      const createdAttendance = await createAttendance({
        companyId: user.companyId,
        employeeId: employee._id,
        date: attendanceDate,
        clockIn: clockIn.toISOString(),
      });

      console.log("ATTENDANCE CREATION SUCCESS:", createdAttendance);

      setDisplayClock(false);
      setShowEditable(false);
      setIsClockingIn(false);
    } catch (error) {
      console.error("ERROR CREATING ATTENDANCE:", error);

      showErrorMessage(
        "Échec de l'enregistrement",
        error,
        "Impossible d'enregistrer l'heure d'arrivée."
      );
    }
  };

  /* =======================================================
     SAVE NOTES
  ======================================================= */

  const saveNotes = async (notes: string | undefined): Promise<boolean> => {
    if (!notes) {
      await refetchAttendance();
      return true;
    }

    try {
      if (!attendance?._id) {
        throw new Error("ATTENDANCE RECORD NOT FOUND");
      }

      await updateAttendance({
        _id: attendance._id,
        employeeId: attendance.employeeId,
        date: formattedDate,
        updates: {
          notes,
        },
      });

      return true;
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE SAVING NOTES:", error);

      return false;
    }
  };

  /* =======================================================
     CONGÉ / ABSENT
  ======================================================= */

  const handleMenuAction = async (action: "CONGÉ" | "ABSENT") => {
    if (!employee) {
      toast({
        title: "Employé introuvable",
        description: "Impossible de trouver l'employé.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-left",
      });

      return;
    }

    /* =====================================================
       CONGÉ
    ===================================================== */

    if (action === "CONGÉ") {
      try {
        const remainingLeave = employee.remainingLeave ?? 0;

        const leaveDays = 1;

        if (remainingLeave < leaveDays) {
          toast({
            title: "Solde de congé insuffisant",
            description: "L'employé ne dispose plus de jours de congé.",
            status: "info",
            duration: 5000,
            isClosable: true,
            position: "top-left",
          });

          return;
        }

        const today = new Date();

        const leaveDate = today.toISOString().split("T")[0];

        const leave: Partial<Leave> = {
          employeeId: employee._id,
          startDate: leaveDate,
          endDate: leaveDate,
          subject: "Absence approuvée",
          notes: "Absence convertie en congé.",
          status: "APPROUVÉ",
        };

        const savedLeave = await window.electron.leave.create(
          user.companyId,
          leave
        );

        console.log("LEAVE SUCCESSFULLY SAVED:", savedLeave);

        /* =================================================
           UPDATE EMPLOYEE LEAVE BALANCE

           React Query mutation will invalidate/refetch
           the employee query if configured that way.
        ================================================= */

        const updatedEmployee = await updateEmployee({
          companyId: user.companyId,
          _id: employee._id,
          data: {
            remainingLeave: remainingLeave - leaveDays,
          },
        });

        console.log("EMPLOYEE LEAVE BALANCE UPDATED:", updatedEmployee);

        /* =================================================
           CREATE ATTENDANCE
        ================================================= */

        const attendanceResult = await createAbsenceLeave({
          employeeId: employee._id,
          status: "CONGÉ",
          date: formattedDate,
        });

        console.log("ATTENDANCE RESULTS:", attendanceResult);

        toast({
          title: "Demande de congé",
          description: "Congé enregistré avec succès.",
          status: "success",
          duration: 4000,
          isClosable: true,
          position: "top-left",
        });
      } catch (error) {
        showErrorMessage(
          "Échec d'enregistrement de congé",
          error,
          "Impossible d'enregistrer le congé."
        );
      }

      return;
    }

    /* =====================================================
       ABSENT
    ===================================================== */

    if (action === "ABSENT") {
      try {
        const results = await createAbsenceLeave({
          employeeId: employee._id,
          status: "ABSENT",
          date: formattedDate,
        });

        console.log("ATTENDANCE RESULTS:", results);
      } catch (error) {
        showErrorMessage(
          "Échec d'enregistrement",
          error,
          "Impossible d'enregistrer l'absence."
        );
      }
    }
  };

  /* =======================================================
     EMPLOYEE LOADING / NOT FOUND
  ======================================================= */

  if (loadingEmployee) {
    return (
      <Flex
        width="100%"
        minHeight="5.2rem"
        bg="#ffffff"
        px="1rem"
        align="center"
      >
        <Text color="gray.500">Chargement de l'employé...</Text>
      </Flex>
    );
  }

  if (!employee) {
    return (
      <Flex
        width="100%"
        minHeight="5.2rem"
        bg="#ffffff"
        px="1rem"
        align="center"
      >
        <Text color="red.500">Employé introuvable</Text>
      </Flex>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <Flex
      width="100%"
      minWidth={0}
      minHeight={{
        base: "auto",
        sm: "5.2rem",
      }}
      bg="#ffffff"
      px={{
        base: "0.5rem",
        sm: "0.75rem",
        md: "1rem",
      }}
      py={{
        base: "0.65rem",
        sm: "0.45rem",
      }}
      position="relative"
      overflow="hidden"
      align="center"
      gap={{
        base: "0.6rem",
        sm: "0.8rem",
        md: "1rem",
      }}
    >
      {/* EMPLOYEE PHOTO */}

      <Box
        flexShrink={0}
        width={{
          base: "48px",
          sm: "56px",
          md: "64px",
        }}
      >
        <Link
          to={{
            pathname: `/employees_admin/employees_list/${employee._id}`,
          }}
          state={{ photo_url }}
        >
          <Image
            src={photo_url || defaultAvatar}
            width={{
              base: "48px",
              sm: "56px",
              md: "64px",
            }}
            height={{
              base: "48px",
              sm: "56px",
              md: "64px",
            }}
            borderRadius="full"
            objectFit="cover"
          />
        </Link>
      </Box>

      {/* EMPLOYEE INFORMATION */}

      <Box
        minWidth={0}
        flex={{
          base: "1 1 180px",
          md: "1 1 280px",
        }}
        overflow="hidden"
      >
        <Text
          color="gray.900"
          fontWeight="600"
          fontSize={{
            base: "0.98rem",
            sm: "1.05rem",
            md: "1.15rem",
            lg: "1.23rem",
          }}
          lineHeight="1.25"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {employee.firstName} {employee.lastName}
        </Text>

        <Flex
          align="center"
          gap={{
            base: "0.3rem",
            sm: "0.45rem",
          }}
          mt="0.25rem"
          minWidth={0}
        >
          <Text
            color="gray.700"
            fontSize={{
              base: "0.75rem",
              sm: "0.85rem",
              md: "0.95rem",
            }}
            fontWeight="500"
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
            maxWidth={{
              base: "80px",
              sm: "130px",
              md: "180px",
              lg: "220px",
            }}
          >
            {employee.role}
          </Text>

          <Box
            color="green.500"
            fontSize={{
              base: "9px",
              sm: "11px",
              md: "13px",
            }}
            flexShrink={0}
          >
            <GoDotFill />
          </Box>

          <Text
            color="gray.800"
            fontSize={{
              base: "0.72rem",
              sm: "0.8rem",
              md: "0.9rem",
            }}
            fontWeight="500"
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
            maxWidth={{
              base: "90px",
              sm: "140px",
              md: "200px",
              lg: "240px",
            }}
          >
            {employee.department}
          </Text>
        </Flex>
      </Box>

      {/* ATTENDANCE STATUS */}

      <Flex
        flexShrink={0}
        width={{
          base: "auto",
          sm: "110px",
          md: "135px",
          lg: "150px",
        }}
        justify="center"
        align="center"
      >
        {!loadingAttendance && attendance?.status === "CONGÉ" && (
          <Badge
            bg="#3182CE"
            color="gray.200"
            fontSize={{
              base: "0.65rem",
              sm: "0.75rem",
              md: "0.85rem",
            }}
            px={{
              base: "0.4rem",
              sm: "0.55rem",
            }}
            py="0.25rem"
            borderRadius="md"
            whiteSpace="nowrap"
          >
            En Congé
          </Badge>
        )}

        {!loadingAttendance && attendance?.status === "ABSENT" && (
          <AbsenceNotesPopover
            existingNotes={attendance?.notes}
            onSubmit={saveNotes}
            employeeId={employee._id}
            attendanceId={attendance._id}
          />
        )}

        {!loadingAttendance && attendance?.status === "PONCTUEL" && (
          <Badge
            bg="#38A169"
            color="gray.200"
            fontSize={{
              base: "0.65rem",
              sm: "0.75rem",
              md: "0.85rem",
            }}
            px={{
              base: "0.4rem",
              sm: "0.55rem",
            }}
            py="0.25rem"
            borderRadius="md"
            whiteSpace="nowrap"
          >
            À l'heure
          </Badge>
        )}

        {!loadingAttendance && attendance?.status === "RETARD" && (
          <AddClockInNotesPopover
            existingNotes={attendance?.notes}
            onSubmit={saveNotes}
          />
        )}
      </Flex>

      {/* CLOCK IN */}

      <Flex
        flexShrink={0}
        align="center"
        justify="center"
        minWidth={{
          base: "55px",
          sm: "80px",
          md: "100px",
        }}
        gap={{
          base: "0.25rem",
          sm: "0.5rem",
        }}
      >
        {!attendance && displayClock && (
          <Button
            color="#c89704"
            backgroundColor="transparent"
            _hover={{
              bg: "transparent",
            }}
            _active={{
              bg: "transparent",
            }}
            onClick={handleToggleClockInEdit}
            isDisabled={isSubmittingAttendance}
            minWidth="auto"
            width={{
              base: "34px",
              sm: "40px",
            }}
            height={{
              base: "34px",
              sm: "40px",
            }}
            p="0"
            flexShrink={0}
            position="relative"
            right="6rem"
          >
            <GiClockwork size="1.7rem" />
          </Button>
        )}

        <Box
          width={{
            base: "45px",
            sm: "60px",
            md: "70px",
          }}
          minWidth={0}
        >
          {showEditable && (
            <Editable
              visibility={showEditable ? "visible" : "hidden"}
              pointerEvents={showEditable ? "auto" : "none"}
              defaultValue={_clockIn}
              onChange={(clockIn) => setClockIn(clockIn)}
              submitOnBlur={false}
              onSubmit={handleClockInSubmit}
              width="100%"
              isDisabled={isSubmittingAttendance}
              position="relative"
              right="4rem"
            >
              <EditablePreview
                color="red.600"
                fontSize={{
                  base: "0.8rem",
                  sm: "0.95rem",
                  md: "1.1rem",
                }}
                animation="pulse 1.7s infinite"
                _focus={{
                  animation: "none",
                }}
                sx={{
                  "@keyframes pulse": {
                    "0%": { opacity: 1 },
                    "50%": { opacity: 0.3 },
                    "100%": { opacity: 1 },
                  },
                }}
              />

              <EditableInput
                color="gray.700"
                fontSize={{
                  base: "0.8rem",
                  sm: "0.95rem",
                  md: "1rem",
                }}
              />
            </Editable>
          )}
        </Box>
      </Flex>

      {/* OPTIONS MENU */}

      <Box
        flexShrink={0}
        width={{
          base: "30px",
          sm: "36px",
          md: "40px",
        }}
        display="flex"
        justifyContent="center"
        alignItems="center"
      >
        <Menu placement="left">
          <MenuButton
            as={IconButton}
            icon={
              <Icon
                as={BsThreeDotsVertical}
                boxSize={{
                  base: "1.1rem",
                  sm: "1.2rem",
                  md: "1.4rem",
                }}
              />
            }
            variant="ghost"
            size="md"
            aria-label="Options"
            flexShrink={0}
            isDisabled={!!attendance || isSubmittingLeave}
          />

          <Portal>
            <MenuList zIndex={9999} minW="140px">
              <MenuItem
                onClick={() => handleMenuAction("CONGÉ")}
                isDisabled={isSubmittingLeave}
                _hover={{
                  bg: "blue",
                  color: "#ffffff",
                }}
              >
                Congé
              </MenuItem>

              <MenuItem
                onClick={() => handleMenuAction("ABSENT")}
                isDisabled={isSubmittingLeave}
                _hover={{
                  bg: "brown",
                  color: "#ffffff",
                }}
              >
                Absence
              </MenuItem>
            </MenuList>
          </Portal>
        </Menu>
      </Box>
    </Flex>
  );
};

export default EmployeeCard;
