import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Grid,
  HStack,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { Link, useParams } from "react-router-dom";
import Task from "../../../../common/types/task/Task";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import useTaskStore from "../../../../store/task.store";
import TaskResolutionPopover from "../components/TaskResolutionPopover";

export default function TaskDetailsPage() {
  const { _id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [comment, setComment] = useState("");
  const author = useAdminUser((store) => store.adminUser);
  const addComment = useTaskStore((store: any) => store.addComment);
  const syncVersion = useSyncStore((store) => store.syncVersion);

  useEffect(() => {
    loadTask();
  }, [_id, syncVersion]);

  const loadTask = async () => {
    if (!_id) return;

    try {
      const result = await window.electron.tasks.tasks.getById(
        author.companyId,
        _id
      );
      if (!result) {
        return;
      }
      setTask(result);
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE FETCHING TASKS", error);
    }
  };

  const handleTaskComment = async () => {
    if (!comment.trim()) {
      return;
    }

    try {
      await addComment(author.companyId, task?._id, author, comment);
      setComment("");
      await loadTask();
      window.electron.sync.sync(author.companyId).catch((error: Error) => {
        console.error("IMMEDIATE SYNC FAILED:", error);
      });
    } catch (error) {
      console.error("FAILED TO ADD TASK COMMENT:", error);
    }
  };

  const handleResolution = async (
    notes: string | undefined
  ): Promise<boolean> => {
    if (!task) {
      return false;
    }

    if (!author) {
      console.error("CANNOT RESOLVE TASK: ADMIN USER NOT AVAILABLE");

      return false;
    }

    const resolvedBy = `${author.firstName} ${author.lastName}`;

    const updatedTask: Task = {
      ...task,
      isResolved: 1,
      resolutionNotes: notes,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    };

    try {
      await window.electron.tasks.tasks.update(author.companyId, updatedTask);

      useTaskStore.setState((state) => ({
        tasks: state.tasks.map((existingTask) =>
          existingTask._id === updatedTask._id
            ? {
                ...existingTask,
                ...updatedTask,
              }
            : existingTask
        ),
      }));
      window.electron.sync.sync(author.companyId).catch((error: Error) => {
        console.error("IMMEDIATE SYNC FAILED:", error);
      });
      await loadTask();
      return true;
    } catch (error) {
      console.error("AN ERROR OCCURED DURING TASK UPDATE:", error);

      return false;
    }
  };

  console.log("currentTask?.submittedAt", task);

  return (
    <Flex
      width="100%"
      height="93vh"
      minH={0}
      bg="gray.50"
      direction="column"
      overflow="hidden"
    >
      {/* =====================================================
          STICKY TOP BAR
      ====================================================== */}

      <Flex
        width="100%"
        height="68px"
        flexShrink={0}
        px={{ base: 4, md: 8 }}
        py={3}
        bg="white"
        borderBottom="1px solid"
        borderColor="gray.200"
        align="center"
        justify="space-between"
        zIndex={10}
      >
        <HStack>
          <Link to="/employees_admin/tasks">
            <Button variant="ghost" size="sm" _hover={{ bg: "transparent" }}>
              <FaArrowLeftLong />
            </Button>
          </Link>
          <Divider orientation="vertical" height="28px" />
          <VStack>
            <Text
              mt="0.2rem"
              fontSize="1.05rem"
              fontWeight="700"
              fontFamily="monospace"
              color="gray.800"
            >
              {task?.taskNumber}
            </Text>
            <Badge
              colorScheme={task?.isResolved ? "green" : "yellow"}
              borderRadius="full"
              fontSize="0.7rem"
            >
              {task?.isResolved ? "Résolue" : "Ouverte"}
            </Badge>
          </VStack>
        </HStack>

        <HStack spacing={4}>
          {!task?.isResolved && (
            <TaskResolutionPopover onSubmit={handleResolution} />
          )}
        </HStack>
      </Flex>

      {/* =====================================================
          SCROLLABLE CONTENT AREA
      ====================================================== */}

      <Box flex="1" minH={0} overflowY="auto" overflowX="hidden" width="100%">
        <Box
          width="100%"
          maxW="850px"
          mx="auto"
          px={{ base: 5, md: 8 }}
          py={{ base: 8, md: 12 }}
        >
          <VStack align="stretch" spacing={8}>
            {/* =================================================
                AUTHOR
            ================================================== */}
            <Grid templateColumns="3fr 2fr">
              <Box>
                <Text fontSize="1.1rem" fontWeight="600" color="gray.500">
                  Auteur
                </Text>

                <Box>
                  <Text fontSize="md" fontWeight="600" color="gray.800">
                    {task?.author
                      ? `${task.author.firstName} ${task.author.lastName}`
                      : "Auteur inconnu"}
                  </Text>
                  <HStack>
                    <Text fontSize="1rem" color="gray.600">
                      {task?.submittedAt &&
                        new Date(task.submittedAt).toLocaleDateString("fr-FR")}
                    </Text>
                    <Text fontSize="1rem" color="gray.600">
                      {task?.submittedAt &&
                        new Date(task.submittedAt).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                    </Text>
                  </HStack>
                </Box>
                {/* Deadline */}
                <HStack mt="1rem">
                  <Text fontSize="1.05rem" fontWeight="600">
                    Date limite:
                  </Text>
                  <Text fontSize="1rem">
                    {task?.deadline &&
                    new Date(task?.deadline).getDay() === new Date().getDay()
                      ? "Aujurd'hui"
                      : task?.deadline &&
                        new Date(task?.deadline).toLocaleDateString("fr-FR")}
                  </Text>
                </HStack>
              </Box>

              {/* <Divider /> */}

              {/* =================================================
                RECIPIENTS
            ================================================== */}

              <Box ml="3rem">
                <Text fontSize="md" fontWeight="600" color="gray.500" mb={3}>
                  Destinataires
                </Text>

                {task?.recipients?.length ? (
                  <Grid
                    templateColumns="repeat(2, minmax(0, 1fr))"
                    gap={2}
                    width="100%"
                  >
                    {task?.recipients.map((user) => (
                      <HStack key={user._id} spacing={1} px={1} py={1}>
                        <Text fontSize="md" color="gray.800">
                          {user.firstName} {user.lastName}
                        </Text>
                      </HStack>
                    ))}
                  </Grid>
                ) : (
                  <Text fontSize="sm" color="gray.500">
                    Aucun destinataire.
                  </Text>
                )}
              </Box>
            </Grid>

            <Divider borderColor="gray.400" />

            {/* =================================================
                SUBJECT
            ================================================== */}

            <VStack>
              <Text
                fontSize="1.2rem"
                fontWeight="600"
                color="gray.700"
                lineHeight="1.1"
              >
                {task?.subject}
              </Text>

              <Text
                fontSize="1rem"
                color="gray.700"
                lineHeight="1.8"
                whiteSpace="normal"
              >
                {task?.message}
              </Text>
            </VStack>

            <Divider borderColor="gray.400" />

            {/* =================================================
                RESOLUTION
            ================================================== */}

            {task?.isResolved && (
              <Flex
                direction="column"
                bg="green.50"
                border="1px solid"
                borderColor="green.200"
                borderRadius="lg"
                p={4}
              >
                <Flex justify="space-between">
                  <Text
                    ml="0.5rem"
                    mt="0.5rem"
                    fontWeight="600"
                    color="green.700"
                  >
                    Tâche résolue
                  </Text>
                  <Box mb={3}>
                    {task.resolvedBy && (
                      <Text ml="1rem" fontSize="md" color="gray.800" mt={1}>
                        {task.resolvedBy}
                      </Text>
                    )}
                    {task.resolvedAt && (
                      <Text ml="1rem" fontSize="sm" color="gray.600">
                        {new Date(task.resolvedAt).toLocaleDateString("fr-FR")}{" "}
                        {"à"}{" "}
                        {new Date(task.resolvedAt).toLocaleString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    )}
                  </Box>
                </Flex>

                {task.resolutionNotes && (
                  <Box>
                    <Text
                      ml="1rem"
                      mt="0.5rem"
                      fontSize="md"
                      fontWeight="600"
                      color="gray.600"
                    >
                      Notes
                    </Text>

                    <Text
                      ml="1rem"
                      mt="0.5rem"
                      fontSize="md"
                      color="gray.700"
                      whiteSpace="pre-wrap"
                    >
                      {task.resolutionNotes}
                    </Text>
                  </Box>
                )}
              </Flex>
            )}

            {/* =================================================
                COMMENTS
            ================================================== */}

            <Box>
              <Flex align="center" justify="space-between" mb={4}>
                <Text fontSize="md" fontWeight="600" color="gray.500">
                  Commentaires
                </Text>

                <Badge borderRadius="full" colorScheme="gray" px={3}>
                  {task?.comments?.length ?? 0}
                </Badge>
              </Flex>

              <Stack spacing={5}>
                {task?.comments?.length ? (
                  task?.comments.map((comment) => (
                    <Box key={comment._id}>
                      <HStack align="start" spacing={3}>
                        <Avatar
                          size="sm"
                          name={
                            comment.author
                              ? `${comment.author.firstName} ${comment.author.lastName}`
                              : "Utilisateur"
                          }
                        />

                        <Box flex={1}>
                          <VStack spacing={2} align="baseline">
                            <Text
                              fontSize="md"
                              fontWeight="600"
                              color="gray.800"
                            >
                              {comment.author
                                ? `${comment.author.firstName} ${comment.author.lastName}`
                                : "Utilisateur"}
                            </Text>

                            {comment.createdAt && (
                              <Text
                                position="relative"
                                bottom="0.5rem"
                                fontSize="sm"
                                color="gray.400"
                              >
                                {new Date(comment.createdAt).toLocaleDateString(
                                  "fr-FR"
                                )}{" "}
                                {"à"}{" "}
                                {new Date(comment.createdAt).toLocaleString(
                                  "fr-FR",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </Text>
                            )}
                          </VStack>

                          <Text
                            fontSize="md"
                            color="gray.700"
                            whiteSpace="pre-wrap"
                            lineHeight="1.6"
                          >
                            {comment.comment}
                          </Text>
                        </Box>
                      </HStack>
                    </Box>
                  ))
                ) : (
                  <Text fontSize="md" color="gray.500">
                    Aucun commentaire pour le moment.
                  </Text>
                )}
              </Stack>
            </Box>

            {/* =================================================
                ADD COMMENT
            ================================================== */}

            <Box pb={10}>
              <HStack align="end" spacing={3}>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ecrivez votre commentaire..."
                  resize="vertical"
                  minH="80px"
                  bg="white"
                />

                <Button
                  colorScheme="blue"
                  onClick={handleTaskComment}
                  isDisabled={!comment.trim()}
                  minW="120px"
                >
                  Commenter
                </Button>
              </HStack>
            </Box>
          </VStack>
        </Box>
      </Box>
    </Flex>
  );
}
