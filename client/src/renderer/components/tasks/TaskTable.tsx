import { useModule } from "../../context/ModuleContext";
import {
  Badge,
  Box,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import Task from "../../../common/types/task/Task";

interface TaskTableProps {
  tasks: Pick<
    Task,
    | "_id"
    | "taskNumber"
    | "author"
    | "subject"
    | "priority"
    | "deadline"
    | "isResolved"
  >[];
  searchText: string;
  priorityFilter: string;
  statusFilter: string;
}

const TaskTable = ({
  tasks,
  searchText,
  priorityFilter,
  statusFilter,
}: TaskTableProps) => {
  const { module } = useModule();
  const navigate = useNavigate();

  const formatDeadline = (deadline: string | Date) => {
    const date = new Date(deadline);

    if (Number.isNaN(date.getTime())) {
      return "— - - -";
    }

    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "HAUTE":
        return "red";
      case "MOYENNE":
        return "orange";
      case "BASSE":
        return "green";
      default:
        return "gray";
    }
  };

  const normalizedSearch = searchText.replace(/[\s-]/g, "").toLowerCase();

  const filteredTasks = tasks
    .filter((task) => {
      if (!normalizedSearch) return true;

      if (normalizedSearch.startsWith("ta")) {
        return (
          task.taskNumber
            ?.replace(/[\s-]/g, "")
            .toLowerCase()
            .includes(normalizedSearch) ?? false
        );
      }

      const subject = task.subject?.toLowerCase() ?? "";
      const authorName = `${task.author?.firstName ?? ""} ${
        task.author?.lastName ?? ""
      }`.toLowerCase();

      return (
        subject.includes(normalizedSearch) ||
        authorName.includes(normalizedSearch)
      );
    })
    .filter((task) => !priorityFilter || task.priority === priorityFilter)
    .filter((task) => {
      if (!statusFilter) return true;

      const isResolved = statusFilter === "RESOLVED" ? 1 : 0;
      return task.isResolved === isResolved;
    });

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="xl"
      boxShadow="sm"
      width="81vw"
      maxWidth="100%"
      minWidth={0}
      overflow="hidden"
    >
      <TableContainer
        width="100%"
        maxHeight="calc(100vh - 240px)"
        overflowY="auto"
        overflowX="auto"
        sx={{
          overscrollBehaviorY: "contain",
          WebkitOverflowScrolling: "touch",
          "&::-webkit-scrollbar": {
            width: "8px",
            height: "8px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#CBD5E0",
            borderRadius: "8px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "#A0AEC0",
          },
        }}
      >
        <Table variant="simple" size="md">
          <Thead position="sticky" top={0} zIndex={2} bg="gray.50">
            <Tr>
              <Th>Numéro de tâche</Th>
              <Th>Auteur</Th>
              <Th>Sujet</Th>
              <Th>Priorité</Th>
              <Th>Date limite</Th>
              <Th>Statut</Th>
            </Tr>
          </Thead>

          <Tbody>
            {filteredTasks.length === 0 ? (
              <Tr>
                <Td colSpan={6} textAlign="center" py={10}>
                  <Text color="gray.500" fontSize="sm">
                    Aucune tâche à afficher
                  </Text>
                </Td>
              </Tr>
            ) : (
              filteredTasks.map((task) => (
                <Tr
                  key={task._id}
                  _hover={{ bg: "gray.50" }}
                  transition="background 0.15s ease"
                >
                  <Td>
                    <Text
                      maxW="200px"
                      fontSize={{ base: "0.5rem", md: "0.9rem" }}
                      fontWeight="600"
                      color="blue.600"
                      whiteSpace="normal"
                      cursor="pointer"
                      onClick={() =>
                        navigate(
                          `/${module.toLowerCase()}/tasks/details/${task._id}`
                        )
                      }
                    >
                      {task.taskNumber}
                    </Text>
                  </Td>

                  <Td>
                    <Text fontSize="md" color="gray.700">
                      {task.author?.firstName ?? ""}{" "}
                      {task.author?.lastName ?? ""}
                    </Text>
                  </Td>

                  <Td maxW="320px">
                    <Text
                      fontSize="md"
                      fontWeight="600"
                      color="gray.700"
                      noOfLines={2}
                      maxW="200px"
                      whiteSpace="normal"
                    >
                      {task.subject}
                    </Text>
                  </Td>

                  <Td>
                    <Badge
                      colorScheme={getPriorityColor(task.priority)}
                      borderRadius="full"
                      px={2.5}
                      py={1}
                      fontSize="xs"
                    >
                      {task.priority}
                    </Badge>
                  </Td>

                  <Td>
                    <Text fontSize="md" color="gray.600">
                      {formatDeadline(task.deadline)}
                    </Text>
                  </Td>

                  <Td>
                    <HStack spacing={2}>
                      <Badge
                        colorScheme={task.isResolved ? "green" : "orange"}
                        borderRadius="full"
                        px={2.5}
                        py={1}
                      >
                        {task.isResolved ? "Résolue" : "Ouverte"}
                      </Badge>
                    </HStack>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
        {/* Extra scroll space so the last row can move above the bottom edge. */}
        <Box height="24px" aria-hidden="true" />
      </TableContainer>
    </Box>
  );
};

export default TaskTable;
