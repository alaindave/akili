import {
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Spacer,
  Switch,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaCheckDouble, FaDownload, FaLock, FaSyncAlt } from "react-icons/fa";
import { FaCirclePlus } from "react-icons/fa6";
import { GiConfirmed } from "react-icons/gi";
import { PiSealCheck } from "react-icons/pi";
import { RiPresentationFill } from "react-icons/ri";
import { AttendanceWithEmployee } from "../../../../../common/types/Attendance";
import { AttendanceDailyCheck } from "../../../../../common/types/AttendanceDailyCheck";
import useAdminUser from "../../../../../store/auth.store";
import DateDropdown from "../../../../components/DateDropdown";
import DateRangePicker, { DateRange } from "../../../../components/DatePicker";
import DeletionDialog from "../../../../components/DeletionDialog";
import SearchBar from "../../../../components/SearchBar";
import EmployeeFilterMenu from "../../employees/components/EmployeeFilterMenu";
import AddAttendanceModal from "../components/AttendanceAddModal";
import EmployeeAttendanceCard from "../components/AttendanceCard";
import {
  useAttendanceByDate,
  useDeleteAttendance,
  useMarkAbsent,
} from "../hooks/useAttendance";

/* ================= SHIMMER ================= */

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -468px 0 }
  100% { background-position: 468px 0 }
}
`;

const Shimmer = ({
  width = "100%",
  height = "18px",
}: {
  width?: string;
  height?: string;
}) => (
  <Box
    borderRadius="6px"
    height={height}
    width={width}
    bg="gray.300"
    animation="shimmer 1.4s ease infinite"
  />
);

/* ================= DATE ================= */

const date = new Date();

const formatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formattedDate = formatter.format(date);

const today = new Date();

const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

/* ================= ERROR FORMATTER ================= */

const formatErrorMessage = (error: Error | string): string => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Une erreur est survenue.";

  const ipcErrorPrefix = /^Error invoking remote method '[^']+':\s*Error:\s*/;

  return message.replace(ipcErrorPrefix, "").trim();
};

/* =========================================================
   PAGE
========================================================= */

const EmployeeAttendancePage = () => {
  /* ================= STATE ================= */

  const [attendance, setAttendance] = useState<AttendanceWithEmployee>(
    {} as AttendanceWithEmployee
  );

  const [selectedDate, setSelectedDate] = useState(formattedDate);

  const [searchText, setSearchText] = useState("");

  const [filter, setFilter] = useState("");

  const [time, setTime] = useState(today);

  const [checkLoading, setCheckLoading] = useState(false);

  const [canVerify, setCanVerify] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(thirtyDaysAgo),
    endDate: new Date(today),
  });

  const [dailyCheck, setDailyCheck] = useState<AttendanceDailyCheck | null>(
    null
  );

  const [unlocked, setUnlocked] = useState(false);

  /* ================= DISCLOSURES ================= */

  const { isOpen, onOpen, onClose } = useDisclosure();

  const {
    isOpen: isAddAttendanceOpen,
    onOpen: onAddAttendanceOpen,
    onClose: onAddAttendanceClose,
  } = useDisclosure();

  /* ================= STORES ================= */

  const user = useAdminUser((store) => store.adminUser);

  /* ================= TOAST ================= */

  const toast = useToast();

  /* =========================================================
     REACT QUERY
  ========================================================= */
  const {
    data: attendances = [],
    isLoading: attendanceLoading,
    isFetching: attendanceFetching,
    refetch: refetchAttendance,
  } = useAttendanceByDate(user.companyId, selectedDate);

  /*
   * Delete attendance mutation.
   */
  const { mutateAsync: deleteAttendance, isPending: isDeleting } =
    useDeleteAttendance(user.companyId);

  /*
   * Mark absent mutation.
   */
  const { mutateAsync: markAbsentMutation, isPending: isMarkingAbsent } =
    useMarkAbsent(user.companyId, selectedDate);

  const loading = attendanceLoading || attendanceFetching;

  /* =========================================================
     ERROR HANDLING
  ========================================================= */

  const showActionError = (
    title: string,
    error: unknown,
    fallbackMessage: string
  ) => {
    console.error(title, error);

    const message =
      error instanceof Error || typeof error === "string"
        ? formatErrorMessage(error)
        : fallbackMessage;

    toast({
      title,
      description: message,
      status: "error",
      duration: 3000,
      isClosable: true,
      position: "top-left",
    });
  };

  /* =========================================================
     GRID
  ========================================================= */

  const gridTemplate = `
    1.6fr 1.5fr 1.3fr 1.3fr 1fr 1fr 0.8fr
  `;

  /* =========================================================
     CLOCK
  ========================================================= */

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);

    return () => clearInterval(interval);
  }, []);

  /* =========================================================
     DAILY CHECK
  ========================================================= */

  useEffect(() => {
    loadDailyCheck();
  }, [selectedDate]);

  const loadDailyCheck = async () => {
    try {
      const dailyCheck: AttendanceDailyCheck | null =
        await window.electron.attendanceDailyCheck.getByDate(
          user.companyId,
          selectedDate
        );

      console.log("DAILY CHECK RETRIEVED", dailyCheck);

      if (!dailyCheck) {
        setCanVerify(false);
        setDailyCheck(null);
        return;
      }

      setDailyCheck(dailyCheck);

      if (dailyCheck.markAbsentCompleted && dailyCheck.markLeaveCompleted) {
        setCanVerify(true);
      } else {
        setCanVerify(false);
      }
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE CHECKING CAN VERIFY", error);
    }
  };

  /* =========================================================
     MANUAL REFRESH
  ========================================================= */

  const loadData = async () => {
    try {
      await Promise.all([refetchAttendance(), loadDailyCheck()]);
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE LOADING DATA:", error);
    }
  };

  /* =========================================================
     ATTENDANCE DAILY CHECK SYNC
  ========================================================= */

  const attendanceDailyCheckSync = async () => {
    try {
      const result = await window.electron.sync(user.companyId);

      if (!result.success) {
        console.error(result.message);
      }

      await loadDailyCheck();
    } catch (error) {
      console.error(
        "AN ERROR OCCURED WHILE SYNCING ATTENDANCE DAILY CHECK:",
        error
      );
    }
  };

  /* =========================================================
     DELETE ATTENDANCE
  ========================================================= */

  const handleDelete = async () => {
    if (!attendance?._id) return;

    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    try {
      await deleteAttendance(attendance._id);
      onClose();
      setAttendance({} as AttendanceWithEmployee);

      toast({
        title: "Présence supprimée",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("ERROR DELETING ATTENDANCE:", error);

      toast({
        title: "Erreur",
        description: "Impossible de supprimer la présence.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /* =========================================================
     MARK ABSENT
  ========================================================= */

  const markAbsent = async () => {
    console.log("SELECTED DATE", selectedDate);
    try {
      window.electron.sync(user.companyId).catch((error) => {
        console.error("IMMEDIATE SYNC FAILED:", error);
      });

      const result = await markAbsentMutation();

      console.log("MARK ABSENT RESULT", result);

      if (result?.completed) {
        await loadDailyCheck();

        toast({
          title: "Absences enregistrées",
          description: "Les absences ont été enregistrées avec succès.",
          status: "success",
          duration: 3000,
          isClosable: true,
          position: "top-left",
        });

        return;
      }

      toast({
        title: "Weekend",
        description:
          "Service indisponible les weekends. Les absences doivent être enregistrées manuellement.",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "top-left",
      });
    } catch (error) {
      showActionError(
        "Échec d'enregistrement d'absences",
        error,
        "Impossible d'enregistrer les absents."
      );
    }
  };

  /* =========================================================
     VERIFY
  ========================================================= */

  const verify = async () => {
    try {
      setCheckLoading(true);

      const result = await window.electron.attendanceDailyCheck.verify({
        companyId: user.companyId,
        date: selectedDate,
        verifiedBy: user._id,
      });

      console.log("VERIFIED ATTENDANCES", result);

      toast({
        title: "Présence vérifiée",
        description: "La liste de présence a été vérifiée avec succès.",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-left",
      });

      await attendanceDailyCheckSync();
    } catch (error) {
      showActionError(
        "Échec de la vérification",
        error,
        "Impossible de vérifier la liste de présence."
      );
    } finally {
      setCheckLoading(false);
    }
  };

  /* =========================================================
     NOTIFY MANAGER
  ========================================================= */

  const notify = async () => {
    try {
      setCheckLoading(true);

      const result = await window.electron.attendanceDailyCheck.notifyManager({
        companyId: user.companyId,
        date: selectedDate,
      });

      console.log("NOTIFIED MANAGER ATTENDANCES", result);

      toast({
        title: "Manager notifié",
        description:
          "La demande de confirmation a été envoyée au gestionnaire.",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-left",
      });

      await attendanceDailyCheckSync();
    } catch (error) {
      showActionError(
        "Échec de la notification",
        error,
        "Impossible de notifier le manager."
      );
    } finally {
      setCheckLoading(false);
    }
  };

  /* =========================================================
     LOCK
  ========================================================= */

  const lock = async () => {
    try {
      setCheckLoading(true);

      const result = await window.electron.attendanceDailyCheck.lock({
        companyId: user.companyId,
        date: selectedDate,
        lockedBy: user._id,
        lockedByRole: user.role,
      });

      console.log("LOCKED ATTENDANCE", result);

      await attendanceDailyCheckSync();

      toast({
        title: "Présence confirmée",
        description: "La liste de présence a été confirmée et verrouillée.",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-left",
      });
    } catch (error) {
      showActionError(
        "Échec de la confirmation",
        error,
        "Impossible de confirmer et verrouiller la liste de présence."
      );
    } finally {
      setCheckLoading(false);
    }
  };

  /* =========================================================
     DOWNLOAD
  ========================================================= */

  const download = async () => {
    try {
      const result = await window.electron.attendanceReports.savePdf(
        selectedDate
      );

      if (result.canceled) {
        return;
      }

      console.log("DOWNLOAD RESULTS:", result);
    } catch (error) {
      console.error(
        "AN ERROR OCCURED WHILE DOWNLOADING THE ATTENDANCE REPORT",
        error
      );
    }
  };

  /* =========================================================
     ATTENDANCE ACTION
  ========================================================= */

  const getAttendanceAction = () => {
    if (!canVerify) {
      return "MARK_ABSENT";
    }

    if (dailyCheck?.status === "OPEN") {
      return "VERIFY";
    }

    if (dailyCheck?.status === "VERIFIED") {
      return user.role === "ADMIN" ? "NOTIFY_MANAGER" : "CONFIRM";
    }

    if (dailyCheck?.status === "MANAGER_NOTIFIED") {
      return user.role === "ADMIN"
        ? "WAITING_CONFIRMATION"
        : user.role === "MANAGER"
        ? "CONFIRM"
        : null;
    }

    if (dailyCheck?.status === "LOCKED") {
      return "LOCKED";
    }

    return null;
  };

  const attendanceAction = getAttendanceAction();

  const isItWeekend = (date: Date | string) => {
    const now = new Date(date);
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return true;
    return false;
  };
  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <Flex direction="column" ml="0.02rem" width="100vw" h="95.1vh" bg="#F8FAFC">
      {/* =====================================================
          HEADER
      ===================================================== */}
      <Flex direction="column" bg="#F8F9FB" height="10rem" width="80vw">
        <Flex>
          <Box>
            <HStack>
              <Text
                color="#1F2937"
                fontSize="clamp(1.3rem, 1vw + 0.8rem, 1.4rem)"
                fontWeight="700"
                ml="1rem"
                mt="1.3rem"
              >
                Présences
              </Text>

              <Button
                bg="transparent"
                color="gray.800"
                _hover={{
                  bg: "transparent",
                }}
                fontSize="1rem"
                right="1rem"
                onClick={loadData}
                isLoading={loading}
                position="relative"
                top="0.8rem"
              >
                <FaSyncAlt />
              </Button>
            </HStack>

            <Text
              fontWeight="500"
              left="0.45rem"
              fontSize={{
                base: "0.85rem",
                sm: "0.9rem",
                md: "0.95rem",
                lg: "1rem",
              }}
              color="gray.500"
              position="relative"
              bottom="0.5rem"
              ml="0.5rem"
            >
              Gérez la liste de présence
            </Text>
          </Box>
          <Spacer />
          {dailyCheck?.status === "LOCKED" && (
            <Box mt="1.3rem">
              <FaLock size="2rem" color="#D4A017" />
            </Box>
          )}
          <Spacer />
          {/* ADD EMPLOYEE */}
          <Box>
            {dailyCheck?.status !== "LOCKED" ? (
              <Button
                colorScheme="blue"
                size="md"
                onClick={onAddAttendanceOpen}
                zIndex="1"
                mt="1.2rem"
                mr="1rem"
                _hover={{
                  backgroundColor: "#4F46E5",
                }}
              >
                <Box mr="0.5rem">
                  <FaCirclePlus size="1.2rem" />
                </Box>

                <Text>Ajouter un employé</Text>
              </Button>
            ) : null}
          </Box>
          <Button
            mt="1.2rem"
            fontSize="1.5rem"
            bg="transparent"
            onClick={download}
            _hover={{
              bg: "transparent",
            }}
          >
            <FaDownload />
          </Button>
        </Flex>

        {/* ===================================================
            FILTER + SEARCH
        =================================================== */}

        <Flex mt="2rem" justify="space-between">
          <Box mt="1.5rem" ml="0.5rem">
            <EmployeeFilterMenu onFilterClicked={setFilter} />
          </Box>

          <Box mt="1.5rem" mr="1rem">
            <SearchBar
              placeholderText="Rechercher un employé"
              onSearch={setSearchText}
            />
          </Box>
        </Flex>
      </Flex>
      {/* =====================================================
          TABLE HEADER
      ===================================================== */}
      {attendances.length !== 0 && (
        <Grid
          templateColumns={gridTemplate}
          px={10}
          fontWeight="600"
          bg="#F8F9FB"
          borderWidth="0.3px"
          border="1px solid #E2E8F0"
          boxShadow="0 2px 10px rgba(15,23,42,.06)"
          height="4.7rem"
          width="78.5vw"
          overflowY="hidden"
          overflowX="hidden"
          mt="3rem"
          ml="0.5rem"
        >
          <Text color="gray.800" fontSize="1rem" mt="0.7rem">
            Employé
          </Text>

          <Text color="gray.800" fontSize="1rem" mt="0.7rem">
            ID
          </Text>

          <Text color="gray.800" fontSize="1rem" mt="0.7rem">
            Poste
          </Text>

          <Text color="gray.800" fontSize="1rem" mt="0.7rem">
            Departement
          </Text>

          <Text color="gray.800" fontSize="1rem" mt="0.7rem">
            Arrivée
          </Text>

          <Text color="gray.800" fontSize="1rem" mt="0.7rem">
            Départ
          </Text>

          <Text color="gray.800" fontSize="1rem" mt="0.7rem">
            Actions
          </Text>
        </Grid>
      )}

      {/* =====================================================
          BODY
      ===================================================== */}
      <Box height="90vh" overflowY="auto" overflowX="hidden">
        {loading ? (
          <>
            <Box as="style">{shimmerKeyframes}</Box>

            <VStack spacing={3}>
              {[...Array(6)].map((_, i) => (
                <Shimmer key={i} height="40px" />
              ))}
            </VStack>
          </>
        ) : attendances.length === 0 ? (
          <Flex
            ml="0.5rem"
            mt="4rem"
            width="78vw"
            minHeight={{
              base: "180px",
              md: "220px",
            }}
            align="center"
            justify="center"
            bg="#ffffff"
            border="1px solid #E2E8F0"
            borderRadius="8px"
            px="20px"
            flexShrink={0}
          >
            <VStack spacing="6px">
              <Text
                fontSize={{
                  base: "1rem",
                  md: "1.1rem",
                }}
                fontWeight="500"
                color="gray.500"
                textAlign="center"
              >
                Pas de présence enregistrée
              </Text>
            </VStack>
          </Flex>
        ) : (
          attendances
            .filter((a) => !filter || a.department === filter)
            .filter((a) =>
              `${a.firstName} ${a.lastName}`
                .toLowerCase()
                .includes(searchText.toLowerCase())
            )
            .map((attendance) => (
              <EmployeeAttendanceCard
                key={attendance._id}
                attendance={attendance}
                selectedDate={selectedDate}
                gridTemplate={gridTemplate}
                onDelete={() => {
                  setAttendance(attendance);
                  onOpen();
                }}
                isUnlocked={unlocked}
                toggleOff={() => setUnlocked(false)}
              />
            ))
        )}
      </Box>
      {/* =====================================================
          FOOTER
      ===================================================== */}
      <Flex
        position="relative"
        width="80vw"
        height="5rem"
        justify="space-evenly"
      >
        {/* VERIFY */}

        {attendanceAction === "VERIFY" && (
          <Button
            colorScheme="blue"
            onClick={verify}
            mr="1rem"
            isLoading={checkLoading}
          >
            <HStack>
              <FaCheckDouble />

              <Text>Vérifier</Text>
            </HStack>
          </Button>
        )}

        {/* NOTIFY MANAGER */}

        {attendanceAction === "NOTIFY_MANAGER" && (
          <Button
            colorScheme="purple"
            onClick={notify}
            isLoading={checkLoading}
          >
            <HStack>
              <PiSealCheck size="1.1rem" />

              <Text>Confirmation</Text>
            </HStack>
          </Button>
        )}

        {/* WAITING */}

        {attendanceAction === "WAITING_CONFIRMATION" && (
          <Button colorScheme="orange" pointerEvents="none" mr="1rem">
            <HStack>
              <GiConfirmed />

              <Text>En attente de confirmation</Text>
            </HStack>
          </Button>
        )}

        {/* CONFIRM */}

        {attendanceAction === "CONFIRM" && (
          <Button colorScheme="green" onClick={lock} isLoading={checkLoading}>
            <HStack>
              <FaLock />

              <Text>Confirmer</Text>
            </HStack>
          </Button>
        )}

        {/* MARK ABSENT */}

        {attendanceAction === "MARK_ABSENT" && !isItWeekend(selectedDate) && (
          <Button
            colorScheme="red"
            onClick={markAbsent}
            isLoading={isMarkingAbsent}
            loadingText="Enregistrement..."
          >
            <HStack>
              <RiPresentationFill />

              <Text>Marquer les absences</Text>
            </HStack>
          </Button>
        )}

        <Box>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </Box>

        <Box fontSize="1.2rem" fontFamily="monospace" fontWeight="600">
          <DateDropdown
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onChange={setSelectedDate}
          />
        </Box>

        {dailyCheck?.status === "MANAGER_NOTIFIED" ||
        dailyCheck?.status === "LOCKED" ? null : (
          <Box mt="0.2rem">
            <Switch
              colorScheme="blue"
              size="lg"
              isChecked={unlocked}
              onChange={(e) => setUnlocked(e.target.checked)}
            />
          </Box>
        )}
      </Flex>
      {/* =====================================================
          ADD ATTENDANCE
      ===================================================== */}
      <AddAttendanceModal
        date={selectedDate}
        isOpen={isAddAttendanceOpen}
        onClose={onAddAttendanceClose}
        onCreated={() => {
          refetchAttendance();
        }}
      />
      {/* =====================================================
          DELETE DIALOG
      ===================================================== */}
      <DeletionDialog
        header="Supprimer de la liste de présence"
        onConfirmation={handleDelete}
        isOpen={isOpen}
        onClose={onClose}
        attendance={attendance}
        isDeleting={isDeleting}
      />
    </Flex>
  );
};

export default EmployeeAttendancePage;
