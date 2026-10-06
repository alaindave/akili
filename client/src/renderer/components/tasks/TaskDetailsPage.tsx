import { useModule } from "../../context/ModuleContext";
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
import type Task from "../../../common/types/task/Task";
import useAdminUser from "../../../store/auth.store";
import useSyncStore from "../../../store/sync.store";
import useTaskStore from "../../../store/task.store";
import TaskResolutionPopover from "./TaskResolutionPopover";

export default function TaskDetailsPage() {
  const { module } = useModule();
  const { _id } = useParams();
  const [loadedTask, setTask] = useState<Task | null>(null);
  const [comment, setComment] = useState("");
  const author = useAdminUser((store) => store.adminUser);
  const task =
    loadedTask?.module === module &&
    loadedTask._id === _id &&
    loadedTask.companyId === author.companyId
      ? loadedTask
      : null;
  const addComment = useTaskStore((store: any) => store.addComment);
  const syncVersion = useSyncStore((store) => store.syncVersion);

  useEffect(() => {
    loadTask();
  }, [_id, syncVersion, module, author.companyId]);

  const loadTask = async () => {
    if (!_id) return;

    setTask(null);
    try {
      const result = await window.electron.tasks.tasks.getById(
        author.companyId,
        _id,
        module
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
    if (!task || !comment.trim()) {
      return;
    }

    try {
      await addComment(author.companyId, task?._id, author, comment, module);
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

  const formatDate = (value?: string, includeTime = false) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          ...(includeTime
            ? ({ hour: "2-digit", minute: "2-digit" } as const)
            : {}),
        });
  };
  const labelStyle = {
    fontSize: "xs",
    fontWeight: "600",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "#737373",
  };

  return (
    <Flex
      direction="column"
      w="100%"
      height="100%"
      minH={0}
      bg="#f2f2f2"
      color="#171717"
      overflow="hidden"
    >
      <Flex
        as="nav"
        aria-label="Actions de la tâche"
        px={{ base: 4, md: 8 }}
        py={4}
        align="center"
        justify="space-between"
        gap={3}
        borderBottom="1px solid #dedede"
        flexShrink={0}
      >
        <Button
          as={Link}
          to={`/${module.toLowerCase()}/tasks`}
          leftIcon={<FaArrowLeftLong />}
          variant="ghost"
          color="#404040"
          size="sm"
          _hover={{ bg: "#e5e5e5" }}
        >
          Toutes les tâches
        </Button>
        {task && !task.isResolved && (
          <TaskResolutionPopover onSubmit={handleResolution} />
        )}
      </Flex>

      <Box
        flex="1"
        minH={0}
        overflowY="auto"
        px={{ base: 3, md: 8 }}
        py={{ base: 5, md: 10 }}
      >
        <Box
          as="article"
          aria-label="Fiche de tâche"
          maxW="900px"
          mx="auto"
          bg="white"
          border="1px solid #dedede"
          boxShadow="0 4px 24px rgba(0, 0, 0, 0.05)"
          px={{ base: 6, md: 12, lg: 16 }}
          py={{ base: 8, md: 14 }}
          sx={{ "@media print": { border: 0, boxShadow: "none", padding: 0 } }}
        >
          {!task ? (
            <Text color="#737373">
              Tâche indisponible ou en cours de chargement…
            </Text>
          ) : (
            <VStack align="stretch" spacing={9}>
              <Box as="header" borderBottom="2px solid #262626" pb={7}>
                <Flex
                  justify="space-between"
                  align="center"
                  gap={3}
                  wrap="wrap"
                  mb={7}
                >
                  <Box>
                    <Text
                      fontFamily="mono"
                      fontSize="sm"
                      color="#737373"
                      mb={3}
                    >
                      {task.taskNumber}
                    </Text>
                    <Text
                      as="h1"
                      fontFamily="Georgia, 'Times New Roman', serif"
                      fontSize={{ base: "2xl", md: "4xl" }}
                      fontWeight="normal"
                      lineHeight="1.25"
                      overflowWrap="anywhere"
                    >
                      {task.subject}
                    </Text>{" "}
                  </Box>
                  <Badge
                    bg={task.isResolved ? "#262626" : "white"}
                    color={task.isResolved ? "white" : "#404040"}
                    border="1px solid #404040"
                    borderRadius="2px"
                    px={3}
                    py={1}
                    fontWeight="500"
                    fontSize="xs"
                  >
                    {task.isResolved ? "Résolue" : "Ouverte"}
                  </Badge>
                </Flex>
              </Box>

              <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={7}>
                <Box>
                  <Text {...labelStyle} mb={2}>
                    Auteur
                  </Text>
                  <Text fontWeight="600">
                    {task.author
                      ? `${task.author.firstName} ${task.author.lastName}`
                      : "Auteur inconnu"}
                  </Text>
                  <Text fontSize="sm" color="#737373" mt={1}>
                    Ouverte le {formatDate(task.submittedAt, true)}
                  </Text>
                </Box>
                <Box>
                  <Text {...labelStyle} mb={2}>
                    Destinataires
                  </Text>
                  {task.recipients?.length ? (
                    task.recipients.map((recipient) => (
                      <Text key={recipient._id} overflowWrap="anywhere">
                        {recipient.firstName} {recipient.lastName}
                      </Text>
                    ))
                  ) : (
                    <Text color="#737373">Aucun destinataire</Text>
                  )}
                </Box>
                <Box>
                  <Text {...labelStyle} mb={2}>
                    Date limite
                  </Text>
                  <Text>{formatDate(task.deadline)}</Text>
                </Box>
              </Grid>

              <Divider borderColor="#dedede" />
              <Box as="section">
                <Text as="h2" {...labelStyle} mb={4}>
                  Description
                </Text>
                <Text
                  fontSize="md"
                  lineHeight="1.9"
                  whiteSpace="pre-wrap"
                  overflowWrap="anywhere"
                >
                  {task.message}
                </Text>
              </Box>

              {!!task.isResolved && (
                <Box as="section" borderLeft="3px solid #404040" pl={5} py={1}>
                  <Text as="h2" {...labelStyle} mb={3}>
                    Résolution
                  </Text>
                  <Text fontSize="sm" color="#525252" mb={3}>
                    {task.resolvedBy
                      ? `Résolue par ${task.resolvedBy}`
                      : "Tâche résolue"}
                    {task.resolvedAt
                      ? ` · ${formatDate(task.resolvedAt, true)}`
                      : ""}
                  </Text>
                  {task.resolutionNotes && (
                    <Text
                      whiteSpace="pre-wrap"
                      overflowWrap="anywhere"
                      lineHeight="1.8"
                    >
                      {task.resolutionNotes}
                    </Text>
                  )}
                </Box>
              )}

              <Divider borderColor="#dedede" />
              <Box as="section">
                <HStack justify="space-between" mb={6}>
                  <Text as="h2" {...labelStyle}>
                    Commentaires
                  </Text>
                  <Text fontFamily="mono" fontSize="xs" color="#737373">
                    {task.comments?.length ?? 0}
                  </Text>
                </HStack>
                <Stack spacing={6}>
                  {task.comments?.length ? (
                    task.comments.map((entry) => (
                      <HStack key={entry._id} align="start" spacing={3}>
                        <Avatar
                          size="sm"
                          bg="#f5f5f5"
                          color="#525252"
                          border="1px solid #dedede"
                          name={
                            entry.author
                              ? `${entry.author.firstName} ${entry.author.lastName}`
                              : "Utilisateur"
                          }
                        />
                        <Box flex="1" minW={0}>
                          <Flex
                            justify="space-between"
                            gap={2}
                            wrap="wrap"
                            mb={2}
                          >
                            <Text fontSize="sm" fontWeight="600">
                              {entry.author
                                ? `${entry.author.firstName} ${entry.author.lastName}`
                                : "Utilisateur"}
                            </Text>
                            <Text fontSize="xs" color="#737373">
                              {formatDate(entry.createdAt, true)}
                            </Text>
                          </Flex>
                          <Text
                            fontSize="sm"
                            lineHeight="1.8"
                            whiteSpace="pre-wrap"
                            overflowWrap="anywhere"
                          >
                            {entry.comment}
                          </Text>
                        </Box>
                      </HStack>
                    ))
                  ) : (
                    <Text fontSize="sm" color="#737373">
                      Aucun commentaire pour le moment.
                    </Text>
                  )}
                </Stack>
              </Box>

              <Box as="section" pt={2}>
                <Text
                  as="label"
                  htmlFor="task-comment"
                  display="block"
                  {...labelStyle}
                  mb={3}
                >
                  Ajouter un commentaire
                </Text>
                <Textarea
                  id="task-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Écrivez votre commentaire…"
                  resize="vertical"
                  minH="110px"
                  bg="white"
                  borderColor="#d4d4d4"
                  borderRadius="2px"
                  fontSize="sm"
                  lineHeight="1.8"
                  _placeholder={{ color: "#737373" }}
                  _hover={{ borderColor: "#737373" }}
                  focusBorderColor="#404040"
                />
                <Flex justify="flex-end" mt={3}>
                  <Button
                    bg="#262626"
                    color="white"
                    borderRadius="2px"
                    size="sm"
                    px={5}
                    _hover={{ bg: "#404040" }}
                    onClick={handleTaskComment}
                    isDisabled={!comment.trim()}
                  >
                    Ajouter le commentaire
                  </Button>
                </Flex>
              </Box>

              <Flex
                as="footer"
                borderTop="1px solid #dedede"
                pt={5}
                justify="space-between"
                gap={3}
                color="#737373"
              >
                <Text fontSize="xs">Suivi des tâches</Text>
                <Text fontSize="xs" fontFamily="mono">
                  {task.taskNumber}
                </Text>
              </Flex>
            </VStack>
          )}
        </Box>
      </Box>
    </Flex>
  );
}
