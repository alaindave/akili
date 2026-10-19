import PageSubtitle from "../../../../components/common/PageSubtitle";
import {
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Text,
  Textarea,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell } from "react-icons/fa";
import { IoReloadOutline } from "react-icons/io5";

import type AdminUser from "../../../../../common/types/shared/AdminUser";
import type Employee from "../../../../../common/types/hr/employees/Employee";
import type Leave from "../../../../../common/types/hr/leave/Leave";
import type Task from "../../../../../common/types/task/Task";

import useAdminUser from "../../../../../store/auth.store";
import useSyncStore from "../../../../../store/sync.store";
import useTaskStore from "../../../../../store/task.store";
import useDashboardTasksStore, { dashboardTaskScope } from "../../../../../store/dashboardTasks.store";

import ReminderModal from "../../../../components/common/ReminderModal";
import EmployeeDashboard from "../components/EmployeeDashboard";
import QuickActions from "../components/EmployeeQuickActions";
import TaskSubmissionModal from "../../../../components/tasks/TaskSubmissionModal";
import TaskCard from "../../../../components/tasks/TaskCard";
import { useAttendanceByDate } from "../../attendance/hooks/useAttendance";

const attendanceDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const EmployeeAdminPage = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [adminUsersList, setAdminUsersList] = useState<AdminUser[]>([]);
  const [time, setTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const adminStore = useAdminUser();
  const user = useAdminUser((store) => store.adminUser);
  const today = attendanceDateFormatter.format(time);
  const { data: attendances = [], refetch: refetchAttendance } =
    useAttendanceByDate(user.companyId, today);
  const [notes, setNotes] = useState(user.notes);
  const saveNotes = useAdminUser((store) => store.saveNotes);
  const loadTopTasks = useTaskStore((store) => store.loadTopTasks);
  const scope = dashboardTaskScope(user.companyId, user._id, "HR");
  const dismissed = useDashboardTasksStore(store => store.dismissed[scope]);
  const dismiss = useDashboardTasksStore(store => store.dismiss);
  const restore = useDashboardTasksStore(store => store.restore);
  const allTasks = useTaskStore((store) => store.tasks);
  const tasks = allTasks.filter((task) => task.module === "HR" && task.companyId === user.companyId && !dismissed?.includes(task._id));
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const previousSyncVersion = useRef(syncVersion);

  console.log("ADMIN USER STORE", adminStore);

  const {
    isOpen: isCreateOpen,
    onOpen: onCreateOpen,
    onClose: onCreateClose,
  } = useDisclosure();

  const {
    isOpen: isReminderOpen,
    onOpen: onReminderOpen,
    onClose: onReminderClose,
  } = useDisclosure();

  const lateCount = attendances.filter(
    (attendance) => attendance.status === "RETARD"
  );

  const dailyAttendance = attendances.filter(
    (attendance) =>
      attendance.status === "PONCTUEL" || attendance.status === "RETARD"
  );

  const loadData = async () => {
    try {
      setLoading(true);

      const employees = await window.electron.hr.employees.getAll(
        user.companyId
      );

      setEmployees(employees);

      console.log("FETCHED SYNCED EMPLOYEES:", employees);

      const leaves = await window.electron.hr.leave.getOngoingLeaves(
        user.companyId,
        today
      );

      setLeaves(leaves);

      console.log("FETCHED ONGOING LEAVES:", leaves);

      const admin_users = await window.electron.company.adminUsers.getAll(
        user.companyId
      );

      setAdminUsersList(admin_users);

      console.log("FETCHED ADMIN USERS:", admin_users);
    } catch (error) {
      console.error("ERROR LOADING DASHBOARD DATA:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    if (!user?._id) {
      console.warn("CANNOT LOAD TASKS: NO ADMIN USER");
      return;
    }

    try {
      console.log("LOADING TOP TASKS FOR USER:", user._id);
      await loadTopTasks(user.companyId, user._id, "HR");
      console.log("TOP TASKS LOADED SUCCESSFULLY");
    } catch (error) {
      console.error("AN ERROR OCCURRED WHILE FETCHING TASKS:", error);
    }
  };

  useEffect(() => {
    console.log("EMPLOYEE ADMIN PAGE: INITIAL LOAD");
    loadData();

    const interval = setInterval(() => {
      setTime(new Date());
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Sync writes directly to SQLite, so refresh the shared attendance cache too.
  useEffect(() => {
    void refetchAttendance();
  }, [syncVersion, today, user.companyId, refetchAttendance]);

  useEffect(() => {
    if (previousSyncVersion.current === syncVersion) {
      return;
    }
    previousSyncVersion.current = syncVersion;
    console.log("SYNC VERSION CHANGED:", syncVersion);
    console.log("SYNC COMPLETED: RELOADING DASHBOARD DATA AND TASKS");
    loadData();
    loadTasks();
  }, [syncVersion]);

  useEffect(() => {
    if (!notes?.trim()) {
      return;
    }

    if (notes === user.notes) {
      return;
    }

    const timeout = setTimeout(() => {
      handleNotesSubmission();
    }, 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, [notes]);

  const handleTaskRefresh = async () => {
    try {
      console.log("MANUALLY REFRESHING TASKS...");

      await loadTasks();
    } catch (error) {
      console.error("AN ERROR OCCURRED WHILE REFRESHING TASKS:", error);
    }
  };

  const handleTaskCreate = () => {
    console.log("TASK CREATE CLICKED");

    onCreateOpen();
  };

  const handleTaskClick = (task: Task) => {
    navigate(`/hr/tasks/details/${task._id}`);
  };

  const handleTaskDelete = (_id: string) => dismiss(scope, _id);

  const handleNotesSubmission = () => {
    window.electron.auth.offlineUsers
      .saveNotes(user.companyId, user._id, notes ?? "")
      .then((res: Response) => {
        console.log("NOTES SUCCESSFULLY SAVED:", res);

        setNotes(notes);
        saveNotes(notes ?? "");
      })
      .catch((error: Error) =>
        console.error("AN ERROR OCCURRED WHILE SAVING NOTES:", error)
      );
  };

  const handleOpenReminder = () => {
    if (!notes?.trim()) {
      return;
    }

    onReminderOpen();
  };

  return (
    <Flex
      direction="column"
      w="100%"
      minW={0}
      h="100%"
      minH={0}
      bg="#F8FAFC"
      border="none"
      overflow="hidden"
      p={{ base: 3, md: 6 }}
      pb={{ base: "calc(46px + 1rem)", md: "calc(52px + 1rem)" }}
      position="relative"
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <Flex
        flexShrink={0}
        justify="space-between"
        align={{
          base: "flex-start",
          md: "center",
        }}
        flexDir={{
          base: "column",
          md: "row",
        }}
        gap={3}
      >
        <Box>
          <HStack>
            <Text
              fontSize="clamp(1.3rem, 1vw + 0.8rem, 1.4rem)"
              fontWeight="700"
              color="#03143B"
            >
              Tableau de bord
            </Text>
          </HStack>

          <PageSubtitle position="relative" bottom="0.3rem">
            Vue d'ensemble de votre gestion de personnel
          </PageSubtitle>
        </Box>

        {/* ===================================================
            MANUAL TASK REFRESH
        ==================================================== */}

        <Button mb="1rem" colorScheme="blue" onClick={() => { restore(scope); void loadTasks(); }}>
          <Box>
            <IoReloadOutline />
          </Box>

          <Text ml="0.5rem">Taches</Text>
        </Button>
      </Flex>

      <Box flex="1" minH={0} minW={0} overflowY="auto" overflowX="hidden">
        <Flex direction="column" minH="100%" minW={0} px={2} pb={2}>
          {/* =====================================================
              DASHBOARD
          ====================================================== */}

          <Box mt="3rem" flexShrink={0}>
            <EmployeeDashboard
              employeeCount={employees.length}
              attendanceCount={dailyAttendance.length}
              leaveCount={leaves.length}
              lateCount={lateCount.length}
            />
          </Box>

          {/* =====================================================
              MAIN GRID
          ====================================================== */}

          <Grid
            templateColumns={{
              base: "minmax(0, 1fr)",
              xl: tasks.length ? "minmax(0, 1.2fr) minmax(0, 1fr)" : "minmax(0, 1fr)",
            }}
            templateAreas={{
              base: tasks.length ? '"tasks" "notes"' : '"notes"',
              xl: tasks.length ? '"notes tasks"' : '"notes"',
            }}
            alignItems="start"
            columnGap={6}
            rowGap="3rem"
            flexShrink={0}
            pt={{ base: 6, xl: 12 }}
          >
            {/* ===================================================
                NOTES
            ==================================================== */}

            <Box
              border="1px solid rgba(255,255,255,0.12)"
              boxShadow="0 2px 8px rgba(0,0,0,0.2)"
              borderRadius="5px"
              bg="#F8FAFC"
              p={5}
              display="flex"
              flexDir="column"
              gridArea="notes"
              minW={0}
              w="100%"
              maxW={tasks.length ? undefined : "42rem"}
              justifySelf="center"
              h="18rem"
              position="relative"
            >
              <Flex align="center" gap={2} mb={3}>
                <Text
                  color="#1F2937"
                  fontSize="clamp(1.3rem, 1vw + 0.8rem, 1.3rem)"
                  fontWeight="600"
                >
                  Notes
                </Text>
              </Flex>

              <Textarea
                placeholder={
                  "Bienvenue sur LeatherWorks.\nÉcrivez vos notes ici..."
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                bg="#091735"
                border="1px solid rgba(255,255,255,0.1)"
                _hover={{
                  borderColor: "yellow.300",
                }}
                _focus={{
                  borderColor: "yellow.400",
                  boxShadow: "0 0 0 1px #F4C20D",
                }}
                flex="1"
                minH={0}
                resize="none"
                color="#ffffff"
                fontSize={{ base: "1rem", sm: "1rem", md: "1.1rem" }}
                fontWeight="500"
                fontFamily="body"
                _placeholder={{
                  color: "#6B7280",
                }}
              />

              <Button
                position="absolute"
                top="0.5rem"
                right="1.3rem"
                colorScheme="blue"
                width="6rem"
                height="3rem"
                onClick={handleOpenReminder}
                isDisabled={!notes?.trim()}
              >
                <Box mr="0.4rem">
                  <FaBell />
                </Box>
                Rappel
              </Button>
            </Box>

            {/* ===================================================
                TASKS
            ==================================================== */}

            <Box
              gridArea="tasks"
              h="auto"
              maxH="42vh"
              overflowY="auto"
              overflowX="hidden"
              overscrollBehaviorY="contain"
              display={tasks.length ? "flex" : "none"}
              flexDir="column"
              minH={0}
              minW={0}
            >
              {tasks.map((task) => (
                <Box
                  key={task._id}
                  flexShrink={0}
                  mt="0.1rem"
                  ml={{
                    base: 0,
                    xl: 8,
                  }}
                >
                  <TaskCard
                    task={task}
                    onTaskClick={handleTaskClick}
                    onTaskDelete={handleTaskDelete}
                  />
                </Box>
              ))}
            </Box>
          </Grid>

        </Flex>
      </Box>

      {/* Quick actions stay above the fixed lower application bar. */}
      <Box pt={4} px={2} flexShrink={0} minW={0}>
        <QuickActions onTaskCreate={handleTaskCreate} employees={employees} />
      </Box>

      <TaskSubmissionModal
        isOpen={isCreateOpen}
        onClose={onCreateClose}
        onRefresh={handleTaskRefresh}
        adminUsersList={adminUsersList}
        author={user!}
      />

      {/* =====================================================
          REMINDER
      ====================================================== */}

      <ReminderModal
        isReminderOpen={isReminderOpen}
        onReminderClose={onReminderClose}
        notes={notes ?? ""}
      />
      {/* =====================================================
          LEAVE SUBMISSION MODAL
      ====================================================== */}
    </Flex>
  );
};

export default EmployeeAdminPage;
