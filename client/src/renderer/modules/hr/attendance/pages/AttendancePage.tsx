import PageSubtitle from "../../../../components/common/PageSubtitle";
import { MdPunchClock } from "react-icons/md";
import {
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Switch,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaCheckDouble, FaLock, FaSyncAlt } from "react-icons/fa";
import { GiConfirmed } from "react-icons/gi";
import { PiSealCheck } from "react-icons/pi";
import { RiPresentationFill } from "react-icons/ri";
import { AttendanceWithEmployee } from "../../../../../common/types/hr/attendance/Attendance";
import { AttendanceDailyCheck } from "../../../../../common/types/hr/attendance/AttendanceDailyCheck";
import useAdminUser from "../../../../../store/auth.store";
import DateDropdown from "../../../../components/common/DateDropdown";
import DateRangePicker, {
  DateRange,
} from "../../../../components/common/DatePicker";
import SearchBar from "../../../../components/common/SearchBar";
import EmployeeFilterMenu from "../../employees/components/EmployeeFilterMenu";
import AddAttendanceModal from "../components/AttendanceAddModal";
import EmployeeAttendanceCard from "../components/AttendanceCard";
import {
  useAttendanceByDate,
  useDeleteAttendance,
  useMarkAbsent,
} from "../hooks/useAttendance";
import useSyncStore from "../../../../../store/sync.store";
import AttendanceStatusFilter from "../components/AttendanceStatusFilter";
import { useErrorToast } from "../../../../hooks/useErrorToast";
import DeletionDialog from "../../../../components/common/DeletionDialog";

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

  const [statusFilter, setStatusFilter] = useState("");

  const [filter, setFilter] = useState("");

  const [, setTime] = useState(today);
  const [absenceSuccessDate, setAbsenceSuccessDate] = useState<string | null>(
    null
  );

  const [checkLoading, setCheckLoading] = useState(false);
  const [verificationSuccessDate, setVerificationSuccessDate] = useState<
    string | null
  >(null);

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
  const syncVersion = useSyncStore((store) => store.syncVersion);

  /* ================= TOAST ================= */

  const toast = useToast();
  const showErrorMessage = useErrorToast();

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

  // Effects run after the refreshed employee list has committed to the page.
  useEffect(() => {
    if (!absenceSuccessDate || isMarkingAbsent || attendanceFetching) return;
    setAbsenceSuccessDate(null);
    if (absenceSuccessDate !== selectedDate) return;
    toast({
      title: "Absences enregistrées",
      description: "Les absences ont été enregistrées avec succès.",
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top-left",
    });
  }, [
    absenceSuccessDate,
    selectedDate,
    isMarkingAbsent,
    attendanceFetching,
    attendances,
    toast,
  ]);

  /* =========================================================
     ERROR HANDLING
  ========================================================= */

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
    refetchAttendance();
    loadDailyCheck();
  }, [syncVersion, selectedDate, statusFilter]);

  const loadDailyCheck = async () => {
    try {
      const dailyCheck: AttendanceDailyCheck | null =
        await window.electron.hr.attendanceDailyCheck.getByDate(
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
      const result = await window.electron.sync.sync(user.companyId);
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
    try {
      await markAbsentMutation();
      await loadDailyCheck();
      setAbsenceSuccessDate(selectedDate);
    } catch (error) {
      showErrorMessage(
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

      const result: AttendanceDailyCheck =
        await window.electron.hr.attendanceDailyCheck.verify({
          companyId: user.companyId,
          date: selectedDate,
          verifiedBy: user._id,
        });

      console.log("VERIFIED ATTENDANCES", result);

      setDailyCheck(result);
      setCanVerify(
        Boolean(result.markAbsentCompleted && result.markLeaveCompleted)
      );
      await loadDailyCheck();
      await attendanceDailyCheckSync();
      setVerificationSuccessDate(selectedDate);
    } catch (error) {
      showErrorMessage(
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

      const result =
        await window.electron.hr.attendanceDailyCheck.notifyManager({
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
      await loadDailyCheck();
      await attendanceDailyCheckSync();
    } catch (error) {
      showErrorMessage(
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
    if (user.role !== "ADMIN" && user.role !== "MANAGER") return;

    try {
      setCheckLoading(true);

      const result = await window.electron.hr.attendanceDailyCheck.lock({
        companyId: user.companyId,
        date: selectedDate,
        lockedBy: user._id,
        lockedByRole: user.role,
      });

      console.log("LOCKED ATTENDANCE", result);

      toast({
        title: "Présence confirmée",
        description: "La liste de présence a été confirmée et verrouillée.",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-left",
      });
      await loadDailyCheck();
      await attendanceDailyCheckSync();
    } catch (error) {
      showErrorMessage(
        "Échec de la confirmation",
        error,
        "Impossible de confirmer et verrouiller la liste de présence."
      );
    } finally {
      setCheckLoading(false);
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

  // Show success only after the confirmation action has rendered without a spinner.
  useEffect(() => {
    if (!verificationSuccessDate) return;
    if (verificationSuccessDate !== selectedDate) {
      setVerificationSuccessDate(null);
      return;
    }
    if (
      checkLoading ||
      (attendanceAction !== "CONFIRM" && attendanceAction !== "NOTIFY_MANAGER")
    )
      return;
    setVerificationSuccessDate(null);
    toast({
      title: "Présence vérifiée",
      description: "La liste de présence a été vérifiée avec succès.",
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top-left",
    });
  }, [
    verificationSuccessDate,
    selectedDate,
    checkLoading,
    attendanceAction,
    toast,
  ]);

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <Flex
      position="relative"
      direction="column"
      w="100%"
      minW={0}
      h="100%"
      minH={0}
      overflow="hidden"
      p="1rem"
      pb={{ base: "calc(46px + 1rem)", md: "calc(52px + 1rem)" }}
      bg="#F8FAFC"
    >
      {/* =====================================================
          HEADER
      ===================================================== */}
      <Flex direction="column" flex="1" minW={0} minH={0}>
        <Flex direction="column" gap={4} mb={4} flexShrink={0}>
          <Flex justify="space-between" align="flex-start" gap={3}>
            <Box minW={0}>
              <HStack spacing={1}>
                <Text color="#03143B" fontSize="1.4rem" fontWeight="700">
                  Présences
                </Text>
                <Button
                  aria-label="Actualiser les présences"
                  variant="ghost"
                  size="sm"
                  minW={8}
                  px={2}
                  onClick={loadData}
                  isLoading={loading}
                >
                  <FaSyncAlt />
                </Button>
              </HStack>
              <PageSubtitle>Gérez la liste de présence</PageSubtitle>
            </Box>
            <Box flexShrink={0}>
              {dailyCheck?.status === "LOCKED" ? (
                <Flex
                  role="img"
                  aria-label="Présences verrouillées"
                  title="Présences verrouillées"
                  align="center"
                  justify="center"
                  boxSize="40px"
                  color="#D4A017"
                >
                  <FaLock size="1.6rem" />
                </Flex>
              ) : (
                <Button
                  colorScheme="blue"
                  size="sm"
                  h="40px"
                  px={3}
                  leftIcon={<MdPunchClock size="1.2rem" />}
                  onClick={onAddAttendanceOpen}
                  _hover={{ backgroundColor: "#4F46E5" }}
                >
                  Pointer
                </Button>
              )}
            </Box>
          </Flex>
          <Grid
            templateColumns="repeat(auto-fit, minmax(min(100%, 220px), 1fr))"
            gap={3}
            sx={{
              ".chakra-menu__menu-button": {
                width: "100%",
                minWidth: 0,
                fontSize: "0.875rem",
                paddingInline: 3,
              },
              ".chakra-menu__menu-button p": {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
              ".chakra-menu__menu-list": {
                marginLeft: 0,
                left: "auto",
                bottom: "auto",
                maxWidth: "calc(100vw - 2rem)",
              },
            }}
          >
            <Box minW={0}>
              <SearchBar
                placeholderText="Rechercher un employé"
                onSearch={setSearchText}
              />
            </Box>
            <Box minW={0}>
              <EmployeeFilterMenu onFilterClicked={setFilter} />
            </Box>
            <Box minW={0}>
              <AttendanceStatusFilter onFilterClicked={setStatusFilter} />
            </Box>
          </Grid>
        </Flex>
        <Box
          flex="1"
          minH={0}
          overflow="auto"
          maxW="100%"
          borderRadius="md"
          overscrollBehavior="contain"
        >
          <Box minW={attendances.length ? "960px" : 0}>
            {/* =====================================================
            TABLE HEADER
        ===================================================== */}
            {attendances.length !== 0 && (
              <Grid
                templateColumns={gridTemplate}
                px={2}
                fontWeight="600"
                bg="#F8F9FB"
                borderWidth="0.3px"
                border="1px solid #E2E8F0"
                boxShadow="0 2px 10px rgba(15,23,42,.06)"
                height="3.5rem"
                width="100%"
                overflowY="hidden"
                overflowX="hidden"
                position="sticky"
                top={0}
                zIndex={1}
              >
                <Text color="gray.800" fontSize="0.99rem" mt="0.7rem">
                  Employé
                </Text>
                <Text color="gray.800" fontSize="1rem" mt="0.7rem">
                  ID
                </Text>
                <Text color="gray.800" fontSize="0.99rem" mt="0.7rem">
                  Poste
                </Text>
                <Text color="gray.800" fontSize="0.99rem" mt="0.7rem">
                  Departement
                </Text>
                <Text color="gray.800" fontSize="0.99rem" mt="0.7rem">
                  Arrivée
                </Text>
                <Text color="gray.800" fontSize="0.99rem" mt="0.7rem">
                  Départ
                </Text>
                <Text color="gray.800" fontSize="0.99rem" mt="0.7rem">
                  Actions
                </Text>
              </Grid>
            )}
            {/* =====================================================
            BODY
        ===================================================== */}
            <Box>
              {attendanceLoading ? (
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
                  mt={3}
                  width="100%"
                  minHeight={{
                    base: "200px",
                    md: "300px",
                  }}
                  align="center"
                  justify="center"
                  bg="#ffffff"
                  border="1px solid #A0AEC0"
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
                  .filter((a) => !statusFilter || a.status === statusFilter)
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
          </Box>
        </Box>
      </Flex>
      {/* =====================================================
          FOOTER
      ===================================================== */}
      <Flex
        flexShrink={0}
        bg="#F8FAFC"
        mt={4}
        gap={3}
        wrap="wrap"
        align="center"
        width="100%"
        minW={0}
        sx={{
          "& > button": {
            minHeight: "38px",
            height: "auto",
            padding: "8px 12px",
            fontSize: "0.875rem",
            whiteSpace: "normal",
            maxWidth: "100%",
            marginRight: 0,
          },
        }}
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

        {attendanceAction === "MARK_ABSENT" && (
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

        <Box
          flex="1 1 280px"
          minW={0}
          maxW="100%"
          sx={{
            ".chakra-form-control": {
              minWidth: 0,
              flex: "1 1 110px",
              width: "auto",
            },
            ".react-datepicker-wrapper": { width: "100%" },
            ".date-range-picker-input": {
              width: "100%",
              height: "38px",
              fontSize: "0.875rem",
              paddingLeft: 2,
              paddingRight: 6,
            },
          }}
        >
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </Box>

        <Box
          flex="1 1 190px"
          minW={0}
          maxW="100%"
          fontSize="0.875rem"
          fontWeight="600"
        >
          <DateDropdown
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onChange={setSelectedDate}
          />
        </Box>

        {dailyCheck?.status === "MANAGER_NOTIFIED" ||
        dailyCheck?.status === "LOCKED" ? null : (
          <Box color="red" flexShrink={0} p={1}>
            <Switch
              colorScheme="red"
              sx={{
                "span.chakra-switch__track:not([data-checked])": {
                  backgroundColor: "gray.800",
                },
              }}
              aria-label="Autoriser la modification des présences"
              size="md"
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
