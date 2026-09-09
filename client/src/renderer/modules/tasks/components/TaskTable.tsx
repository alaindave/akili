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
import Task from "../../../../common/types/Task";

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

  const filteredTasks = tasks.filter((task) => {
    const search = searchText.replace(/[\s-]/g, "").toLowerCase();

    if (!search) {
      return true;
    }

    // Search by task number when search starts with "TACHE"
    if (search.startsWith("TA".toLowerCase())) {
      return task.taskNumber
        ?.replace(/[\s-]/g, "")
        .toLowerCase()
        .includes(search);
    }

    // Otherwise search by subject or author
    const subject = task.subject?.toLowerCase() ?? "";

    const authorName = `${task.author?.firstName ?? ""} ${
      task.author?.lastName ?? ""
    }`.toLowerCase();

    return subject.includes(search) || authorName.includes(search);
  });

  const statusMapping = (status: string): number => {
    if (status === "RESOLVED") return 1;
    return 0;
  };

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="xl"
      boxShadow="sm"
      maxW="78vw"
    >
      <TableContainer
        maxW="78vw"
        maxH="70vh"
        borderWidth="1px"
        borderRadius="lg"
        overflowY="auto"
      >
        <Table variant="simple">
          <Thead position="sticky" top={0} bg="gray.50" zIndex={1}>
            <Tr>
              <Th>Numero de tache</Th>
              <Th>Auteur</Th>
              <Th>Sujet</Th>
              <Th>Priorite</Th>
              <Th>Date limite</Th>
              <Th>Statut</Th>
            </Tr>
          </Thead>

          <Tbody>
            {tasks.length === 0 ? (
              <Tr>
                <Td colSpan={6} textAlign="center" py={10}>
                  <Text color="gray.500" fontSize="sm">
                    Pas de taches a afficher
                  </Text>
                </Td>
              </Tr>
            ) : (
              filteredTasks
                .filter(
                  (task) => !priorityFilter || task.priority === priorityFilter
                )
                .filter(
                  (task) =>
                    !statusFilter ||
                    task.isResolved === statusMapping(statusFilter)
                )
                .map((task) => (
                  <Tr
                    key={task._id}
                    _hover={{
                      bg: "gray.50",
                    }}
                    transition="background 0.15s ease"
                  >
                    {/* Task Number */}
                    <Td>
                      <Text
                        maxW="200px"
                        fontSize="md"
                        fontWeight="600"
                        color="blue.600"
                        whiteSpace="normal"
                        onClick={() =>
                          navigate(`/employees_admin/tasks/details/${task._id}`)
                        }
                        style={{ cursor: "pointer" }}
                      >
                        {task.taskNumber}
                      </Text>
                    </Td>

                    {/* Author */}
                    <Td>
                      <Text fontSize="md" color="gray.700">
                        {task.author.firstName}
                        {""} {task.author.lastName}
                      </Text>
                    </Td>

                    {/* Subject */}
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

                    {/* Priority */}
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

                    {/* Deadline */}
                    <Td>
                      <Text fontSize="md" color="gray.600">
                        {formatDeadline(task.deadline)}
                      </Text>
                    </Td>

                    {/* Status */}
                    <Td>
                      {task.isResolved ? (
                        <HStack spacing={2}>
                          <Badge
                            colorScheme="green"
                            borderRadius="full"
                            px={2.5}
                            py={1}
                          >
                            Resolue
                          </Badge>
                        </HStack>
                      ) : (
                        <HStack spacing={2}>
                          <Badge
                            colorScheme="orange"
                            borderRadius="full"
                            px={2.5}
                            py={1}
                          >
                            Ouverte
                          </Badge>
                        </HStack>
                      )}
                    </Td>
                  </Tr>
                ))
            )}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default TaskTable;
