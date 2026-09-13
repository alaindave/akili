import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  Stack,
  Text,
  Textarea,
  VStack,
  SimpleGrid,
} from "@chakra-ui/react";
import { FiCheckCircle, FiUser } from "react-icons/fi";
import Task from "../../../../common/types/Task";
import useAdminUser from "../../../../store/auth.store";
import { useEffect, useState } from "react";
import TaskResolutionPopover from "./TaskResolutionPopover";
import { CiCalendarDate, CiClock2 } from "react-icons/ci";
import useSyncStore from "../../../../store/sync.store";

interface Props {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function TaskDetailsDrawer({
  task,
  isOpen,
  onClose,
  onRefresh,
}: Props) {
  const [dbTask, setDbTask] = useState<Task | null>(null);
  const [comment, setComment] = useState("");

  const author = useAdminUser((store) => store.adminUser);
  const syncVersion = useSyncStore((store) => store.syncVersion);

  // ============================================================
  // LOAD TASK FROM SQLITE
  // ============================================================

  useEffect(() => {
    if (task?._id) {
      loadDbTask();
    }
  }, [task?._id, syncVersion]);

  const loadDbTask = async () => {
    if (!task?._id) return;

    try {
      const dbTask = await window.electron.tasks.getById(
        author.companyId,
        task._id
      );

      setDbTask(dbTask);

      console.log("TASK FROM SQLITE:", dbTask);
    } catch (error) {
      console.error("AN ERROR OCCURRED WHILE FETCHING DB TASK:", error);
    }
  };

  const currentTask = dbTask ?? task;

  // ============================================================
  // CLOSE
  // ============================================================

  const handleClose = () => {
    setDbTask(null);
    setComment("");
    onClose();
  };

  // ============================================================
  // COMMENT
  // ============================================================

  const handleTaskComment = async () => {
    if (!comment.trim()) {
      return;
    }

    if (!currentTask?._id) {
      return;
    }

    if (!author?._id) {
      console.error("CANNOT ADD COMMENT: ADMIN USER NOT AVAILABLE");
      return;
    }

    try {
      await window.electron.taskComments.create(author.companyId, {
        taskId: currentTask._id,
        author: author._id,
        comment: comment.trim(),
      });

      setComment("");

      await loadDbTask();
    } catch (error) {
      console.error("FAILED TO ADD TASK COMMENT:", error);
    }
  };

  // ============================================================
  // RESOLUTION
  // ============================================================

  const handleResolution = async (
    notes: string | undefined
  ): Promise<boolean> => {
    if (!currentTask) {
      return false;
    }

    if (!author) {
      console.error("CANNOT RESOLVE TASK: ADMIN USER NOT AVAILABLE");

      return false;
    }

    const resolvedBy = `${author.firstName} ${author.lastName}`;

    const updatedTask: Task = {
      ...currentTask,
      isResolved: 1,
      resolutionNotes: notes,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    };

    console.log("TASK TO UPDATE:", updatedTask);

    try {
      const result = await window.electron.tasks.update(
        author.companyId,
        updatedTask
      );

      console.log("TASK UPDATE RESULT:", result);

      await loadDbTask();

      onRefresh?.();

      return true;
    } catch (error) {
      console.error("AN ERROR OCCURRED DURING TASK UPDATE:", error);

      return false;
    }
  };

  // ============================================================
  // EMPTY STATE
  // ============================================================

  if (!currentTask) {
    return null;
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      placement="left"
      size={{
        base: "full",
        sm: "sm",
        md: "md",
        lg: "lg",
      }}
    >
      <DrawerOverlay />

      <DrawerContent
        maxW={{
          base: "100vw",
          sm: "420px",
          md: "520px",
          lg: "650px",
        }}
      >
        {/* =====================================================
            HEADER
        ====================================================== */}

        <DrawerHeader
          borderBottomWidth="1px"
          borderColor="gray.300"
          px={{
            base: 4,
            sm: 5,
            md: 6,
          }}
          py={{
            base: 4,
            md: 5,
          }}
        >
          <VStack
            align="stretch"
            spacing={{
              base: 4,
              md: 5,
            }}
          >
            {/* =================================================
                TASK HEADER
            ================================================== */}

            <Flex
              width="100%"
              justify="space-between"
              align="flex-start"
              gap={3}
            >
              {/* Task information */}

              <Box minW={0} flex="1">
                <Flex
                  direction={{
                    base: "column",
                    sm: "row",
                  }}
                  align={{
                    base: "flex-start",
                    sm: "center",
                  }}
                  gap={2}
                >
                  <Text
                    fontWeight="bold"
                    fontFamily="monospace"
                    fontSize={{
                      base: "0.95rem",
                      md: "1rem",
                    }}
                    color="gray.700"
                    wordBreak="break-word"
                  >
                    {currentTask.taskNumber}
                  </Text>
                </Flex>

                {/* Author */}

                <HStack mt={3} spacing={3} align="center">
                  <Avatar
                    size={{
                      base: "sm",
                      md: "md",
                    }}
                    name={`${currentTask.author.firstName} ${currentTask.author.lastName}`}
                  />

                  <Text
                    fontSize={{
                      base: "0.95rem",
                      md: "1.05rem",
                    }}
                    fontWeight="500"
                    color="gray.800"
                    wordBreak="break-word"
                  >
                    {currentTask.author.firstName} {currentTask.author.lastName}
                  </Text>
                </HStack>
              </Box>

              {/* Resolve button */}

              {!currentTask.isResolved && (
                <Box flexShrink={0}>
                  <TaskResolutionPopover onSubmit={handleResolution} />
                </Box>
              )}
            </Flex>

            {/* =================================================
                DATES
            ================================================== */}

            <SimpleGrid
              columns={{
                base: 1,
                sm: 2,
              }}
              spacing={3}
              width="100%"
              bg="gray.100"
              borderRadius="md"
              p={{
                base: 3,
                md: 4,
              }}
            >
              {/* Opened */}

              <Flex align="center" gap={3} minW={0}>
                <Flex
                  flexShrink={0}
                  fontSize={{
                    base: "1.5rem",
                    md: "1.7rem",
                  }}
                  color="blue.500"
                  align="center"
                  justify="center"
                >
                  <CiCalendarDate />
                </Flex>

                <Box minW={0}>
                  <Text fontSize="0.8rem" color="gray.500" mb={1}>
                    Ouverte le
                  </Text>

                  <Flex wrap="wrap" columnGap={2} rowGap={0}>
                    <Text
                      fontSize={{
                        base: "0.85rem",
                        md: "0.9rem",
                      }}
                      color="gray.700"
                    >
                      {currentTask.submittedAt
                        ? new Date(currentTask.submittedAt).toLocaleDateString(
                            "fr-FR"
                          )
                        : "-"}
                    </Text>

                    <Text
                      fontSize={{
                        base: "0.85rem",
                        md: "0.9rem",
                      }}
                      color="gray.700"
                    >
                      {currentTask.submittedAt
                        ? new Date(currentTask.submittedAt).toLocaleTimeString(
                            "fr-FR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "-"}
                    </Text>
                  </Flex>
                </Box>
              </Flex>

              {/* Deadline */}

              <Flex align="center" gap={3} minW={0}>
                <Flex
                  flexShrink={0}
                  fontSize={{
                    base: "1.5rem",
                    md: "1.7rem",
                  }}
                  color="blue.500"
                  align="center"
                  justify="center"
                >
                  <CiClock2 />
                </Flex>

                <Box minW={0}>
                  <Text fontSize="0.8rem" color="gray.500" mb={1}>
                    Date limite
                  </Text>

                  <Text
                    fontSize={{
                      base: "0.85rem",
                      md: "0.9rem",
                    }}
                    color="gray.700"
                  >
                    {currentTask.deadline
                      ? (() => {
                          const deadline = new Date(currentTask.deadline);

                          const today = new Date();

                          const isToday =
                            deadline.getFullYear() === today.getFullYear() &&
                            deadline.getMonth() === today.getMonth() &&
                            deadline.getDate() === today.getDate();

                          return isToday
                            ? "Aujourd'hui"
                            : deadline.toLocaleDateString("fr-FR");
                        })()
                      : "-"}
                  </Text>
                </Box>
              </Flex>
            </SimpleGrid>

            {/* =================================================
                SUBJECT + MESSAGE
            ================================================== */}

            <Flex>
              <Box width="100%">
                <Text
                  fontSize={{
                    base: "1.05rem",
                    sm: "1.15rem",
                    md: "1.2rem",
                  }}
                  fontWeight="600"
                  color="gray.900"
                  mb={2}
                  wordBreak="break-word"
                >
                  {currentTask.subject}
                </Text>
                <Text
                  fontSize={{
                    base: "0.98rem",
                    sm: "1rem",
                    md: "1.05rem",
                  }}
                  fontWeight="400"
                  color="gray.700"
                  fontFamily="body"
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                >
                  {currentTask.message}
                </Text>
              </Box>
              <Badge
                mb="1rem"
                colorScheme={currentTask.isResolved ? "green" : "yellow"}
                alignSelf={{
                  base: "flex-start",
                  sm: "center",
                }}
              >
                {currentTask.isResolved ? "Résolue" : "Ouverte"}
              </Badge>
            </Flex>
          </VStack>
        </DrawerHeader>

        {/* =====================================================
            BODY
        ====================================================== */}

        <DrawerBody
          px={{
            base: 4,
            sm: 5,
            md: 6,
          }}
          py={{
            base: 4,
            md: 5,
          }}
        >
          <VStack
            align="stretch"
            spacing={{
              base: 5,
              md: 6,
            }}
          >
            {/* =================================================
                RECIPIENTS
            ================================================== */}

            <Box>
              <Text
                fontWeight="bold"
                mb={3}
                fontSize={{
                  base: "1rem",
                  md: "1.1rem",
                }}
                color="gray.800"
              >
                Destinataires
              </Text>

              <Stack spacing={3}>
                {currentTask.recipients?.map((user) => (
                  <HStack key={user._id} spacing={3} minW={0}>
                    <Avatar
                      size="sm"
                      flexShrink={0}
                      name={`${user.firstName} ${user.lastName}`}
                    />

                    <Text
                      fontSize={{
                        base: "0.9rem",
                        md: "1rem",
                      }}
                      color="gray.700"
                      wordBreak="break-word"
                    >
                      {user.firstName} {user.lastName}
                    </Text>
                  </HStack>
                ))}
              </Stack>
            </Box>

            {/* =================================================
                RESOLUTION
            ================================================== */}

            {currentTask.isResolved && (
              <Box>
                <Divider borderColor="gray.300" mb={5} />

                <VStack align="stretch" spacing={4}>
                  {/* Resolved date */}

                  <HStack align="flex-start" spacing={3}>
                    <Icon
                      as={FiCheckCircle}
                      color="green.500"
                      boxSize={5}
                      mt={1}
                      flexShrink={0}
                    />

                    <Box minW={0}>
                      <Text fontSize="0.8rem" color="gray.500" mb={1}>
                        Résolue le
                      </Text>

                      <HStack>
                        <Text
                          fontSize={{
                            base: "0.7rem",
                            md: "0.75rem",
                          }}
                          color="gray.700"
                          wordBreak="break-word"
                        >
                          {currentTask.resolvedAt
                            ? new Date(
                                currentTask.resolvedAt
                              ).toLocaleDateString("fr-FR")
                            : "-"}
                        </Text>
                        <Text
                          fontSize={{
                            base: "0.7rem",
                            md: "0.75rem",
                          }}
                          color="gray.700"
                          wordBreak="break-word"
                        >
                          {currentTask.resolvedAt
                            ? new Date(currentTask.resolvedAt)
                                .toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                                .replaceAll(" ", " à ")
                            : "-"}
                        </Text>
                      </HStack>
                    </Box>
                  </HStack>

                  {/* Resolved by */}

                  {currentTask.resolvedBy && (
                    <HStack ml="1.1rem" spacing={3}>
                      <Text
                        fontSize={{
                          base: "0.8rem",
                          md: "0.85rem",
                        }}
                        color="gray.700"
                        wordBreak="break-word"
                      >
                        par {currentTask.resolvedBy}
                      </Text>
                    </HStack>
                  )}

                  {/* Resolution notes */}

                  {currentTask.resolutionNotes && (
                    <Box
                      p={{
                        base: 3,
                        md: 4,
                      }}
                      bg="gray.100"
                      borderRadius="md"
                      width="100%"
                    >
                      <Text
                        fontWeight="bold"
                        mb={2}
                        fontSize={{
                          base: "1rem",
                          md: "1rem",
                        }}
                      >
                        Notes de résolution
                      </Text>

                      <Text
                        fontFamily="mono"
                        fontSize={{
                          base: "0.8rem",
                          md: "0.9rem",
                        }}
                        color="gray.700"
                        whiteSpace="pre-wrap"
                        wordBreak="break-word"
                      >
                        {currentTask.resolutionNotes}
                      </Text>
                    </Box>
                  )}
                </VStack>
              </Box>
            )}

            {/* =================================================
                COMMENTS
            ================================================== */}

            <Box>
              <Divider borderColor="gray.300" mb={5} />

              <Text
                fontWeight="bold"
                mb={4}
                fontSize={{
                  base: "1rem",
                  md: "1rem",
                }}
                color="gray.800"
              >
                Commentaires ({currentTask.comments?.length ?? 0})
              </Text>

              <Stack spacing={4}>
                {currentTask.comments?.map((taskComment) => (
                  <Box
                    key={taskComment._id}
                    borderWidth="1px"
                    borderColor="gray.200"
                    borderRadius="md"
                    p={{
                      base: 3,
                      md: 4,
                    }}
                    bg="white"
                  >
                    {/* Comment author */}

                    <HStack align="flex-start" spacing={3}>
                      <Avatar
                        size="sm"
                        flexShrink={0}
                        name={`${taskComment.author.firstName} ${taskComment.author.lastName}`}
                      />

                      <Box flex="1" minW={0}>
                        <Flex
                          direction={{
                            base: "column",
                            sm: "row",
                          }}
                          justify="space-between"
                          align={{
                            base: "flex-start",
                            sm: "center",
                          }}
                          gap={1}
                        >
                          <Text
                            fontWeight="semibold"
                            fontSize={{
                              base: "1rem",
                              md: "1rem",
                            }}
                            color="gray.800"
                            wordBreak="break-word"
                          >
                            {taskComment.author.firstName}{" "}
                            {taskComment.author.lastName}
                          </Text>

                          <Text
                            fontSize="0.85rem"
                            color="gray.500"
                            flexShrink={0}
                          >
                            {taskComment.createdAt
                              ? `${new Date(
                                  taskComment.createdAt
                                ).toLocaleDateString("fr-FR")} ${new Date(
                                  taskComment.createdAt
                                ).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Africa/Bujumbura",
                                })}`
                              : ""}
                          </Text>
                        </Flex>

                        {/* Comment text */}

                        <Text
                          mt="0.5rem"
                          ml="0.5rem"
                          fontFamily="body"
                          fontSize={{
                            base: "0.95rem",
                            md: "1rem",
                          }}
                          color="gray.700"
                          whiteSpace="pre-wrap"
                          wordBreak="break-word"
                        >
                          {taskComment.comment}
                        </Text>
                      </Box>
                    </HStack>
                  </Box>
                ))}

                {/* Empty comments */}

                {(!currentTask.comments ||
                  currentTask.comments.length === 0) && (
                  <Text color="gray.500" fontSize="0.9rem">
                    Aucun commentaire pour le moment.
                  </Text>
                )}
              </Stack>
            </Box>
          </VStack>
        </DrawerBody>

        {/* =====================================================
            FOOTER / COMMENT INPUT
        ====================================================== */}

        <DrawerFooter
          borderTopWidth="1px"
          borderColor="gray.200"
          px={{
            base: 3,
            sm: 4,
            md: 5,
          }}
          py={{
            base: 3,
            md: 4,
          }}
        >
          <Flex
            width="100%"
            direction={{
              base: "column",
              sm: "row",
            }}
            gap={2}
            align={{
              base: "stretch",
              sm: "flex-end",
            }}
          >
            <Textarea
              flex="1"
              minH={{
                base: "70px",
                sm: "45px",
              }}
              maxH="140px"
              resize="vertical"
              placeholder="Écrivez vos commentaires..."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              fontSize={{
                base: "0.9rem",
                md: "0.95rem",
              }}
            />

            <Button
              colorScheme="blue"
              onClick={handleTaskComment}
              isDisabled={!comment.trim()}
              width={{
                base: "100%",
                sm: "auto",
              }}
              minW={{
                sm: "110px",
              }}
              flexShrink={0}
            >
              Commenter
            </Button>
          </Flex>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
