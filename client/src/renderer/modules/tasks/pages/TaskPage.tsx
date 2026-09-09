import {
  Box,
  Flex,
  Text,
  HStack,
  Button,
  useDisclosure,
  Grid,
} from "@chakra-ui/react";
import { FaSyncAlt } from "react-icons/fa";
import { useEffect, useState } from "react";
import Task from "../../../../common/types/Task";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import TaskTable from "../components/TaskTable";
import TaskSubmissionModal from "../components/TaskSubmissionModal";
import AdminUser from "../../../../common/types/AdminUser";
import SearchBar from "../../../components/SearchBar";
import TaskPriorityFilter from "../components/TaskPriorityFilter";
import TaskStatusFilter from "../components/TaskStatusFilter";

const TaskPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [adminUsersList, setAdminUsersList] = useState<AdminUser[]>([]);
  const user = useAdminUser((store) => store.adminUser);
  const syncVersion = useSyncStore((store) => store.syncVersion);

  const {
    isOpen: isCreateOpen,
    onOpen: onCreateOpen,
    onClose: onCreateClose,
  } = useDisclosure();

  useEffect(() => {
    console.log("TASK PAGE: SYNC COMPLETED, RELOADING TASKS");
    loadTasks();
    loadAdminUsers();
  }, [syncVersion]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const tasks = await window.electron.tasks.getUserTasks(
        user.companyId,
        user._id
      );
      console.log("FETCHED TASKS", tasks);
      setTasks(tasks);
    } catch (error) {
      console.log("AN ERROR OCCURED WHILE FETCHING LOADING TASKS:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    try {
      const admin_users = await window.electron.adminUsers.getAll(
        user.companyId
      );
      setAdminUsersList(admin_users);
    } catch (error) {
      console.log("AN ERROR OCCURED WHILE FETCHING ADMIN USERS:", error);
    }
  };

  return (
    <Flex direction="column" width="100%">
      <Flex width="100%" justify="space-between">
        <Box>
          <HStack>
            <Text
              color="#1F2937"
              fontSize="clamp(1.3rem, 1vw + 0.8rem, 1.4rem)"
              fontWeight="700"
              ml="1rem"
              mt="1.3rem"
            >
              Taches
            </Text>
            <Button
              bg="transparent"
              isLoading={loading}
              color="gray.800"
              _hover={{ bg: "transparent" }}
              fontSize="1rem"
              position="relative"
              top="0.7rem"
              right="1rem"
              onClick={loadTasks}
            >
              <FaSyncAlt />
            </Button>
          </HStack>
          <Text
            fontWeight="500"
            fontSize="clamp(1rem, 1vw + 0.8rem, 1rem)"
            color="gray.500"
            position="relative"
            bottom="0.5rem"
            left="1rem"
          >
            Gérez les taches
          </Text>
        </Box>
        <Button
          mt="1rem"
          mr="1rem"
          colorScheme="blue"
          onClick={() => onCreateOpen()}
        >
          Créer une nouvelle tache
        </Button>
      </Flex>
      <Grid templateColumns="6fr 2fr 2fr">
        <Flex
          width="200px"
          position="relative"
          top="2rem"
          left="1rem"
          wrap="wrap"
        >
          <SearchBar
            placeholderText="Rechercher une tache"
            onSearch={setSearchText}
          />
        </Flex>
        <Flex
          width="200px"
          position="relative"
          top="2rem"
          right="3rem"
          wrap="wrap"
        >
          <TaskPriorityFilter onFilterClicked={setPriorityFilter} />
        </Flex>
        <Flex
          width="200px"
          position="relative"
          top="2rem"
          right="2rem"
          wrap="wrap"
        >
          <TaskStatusFilter onFilterClicked={setStatusFilter} />
        </Flex>
      </Grid>
      <Box mt="3rem" ml="1rem">
        <TaskTable
          tasks={tasks}
          searchText={searchText}
          priorityFilter={priorityFilter}
          statusFilter={statusFilter}
        />
      </Box>
      <TaskSubmissionModal
        isOpen={isCreateOpen}
        onClose={onCreateClose}
        onRefresh={loadTasks}
        adminUsersList={adminUsersList}
        author={user}
      />
    </Flex>
  );
};

export default TaskPage;
