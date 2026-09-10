import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  VStack,
  SimpleGrid,
  Tag,
  TagLabel,
  TagCloseButton,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FaSave } from "react-icons/fa";
import { IoIosCheckmarkCircle } from "react-icons/io";
import { MdTask } from "react-icons/md";
import { RxCrossCircled } from "react-icons/rx";
import { z } from "zod";

import DatePicker from "react-datepicker";
import AdminUser from "../../../../common/types/AdminUser";
import User from "../../../../common/types/User";
import { Priority } from "../../../../common/types/Task";
import useAdminUser from "../../../../store/auth.store";

interface Props {
  author: Omit<User, "password" | "notes">;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  adminUsersList: AdminUser[];
}

const validationMessage = "Remplissez tous les champs!";

const schema = z.object({
  subject: z.string().min(1, { message: validationMessage }),
  message: z.string().min(1, { message: validationMessage }),
  deadline: z.string().min(1, { message: validationMessage }),
});

type TaskData = z.infer<typeof schema>;

const TaskSubmissionModal = ({
  author,
  isOpen,
  onClose,
  onRefresh,
  adminUsersList,
}: Props) => {
  const user = useAdminUser((store) => store.adminUser);

  const [recipient, setRecipient] = useState<AdminUser>({} as AdminUser);

  const [taskRecipients, setTaskRecipients] = useState<AdminUser[]>([]);

  const [errorMessage, setErrorMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [priority, setPriority] = useState<Priority>("MOYENNE");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskData>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: "",
      message: "",
      deadline: "",
    },
  });

  // ============================================================
  // RECIPIENTS
  // ============================================================

  const handleSelectRecipients = () => {
    if (!recipient?._id) {
      setErrorMessage("Veuillez sélectionner un destinataire");
      return;
    }

    setErrorMessage("");

    const alreadySelected = taskRecipients.some((r) => r._id === recipient._id);

    if (alreadySelected) {
      setErrorMessage("Ce destinataire a déjà été sélectionné");
      return;
    }

    setTaskRecipients((prev) => [...prev, recipient]);

    setRecipient({} as AdminUser);
  };

  const handleRecipientDelete = (id: string) => {
    setTaskRecipients((prev) => prev.filter((r) => r._id !== id));
  };

  // ============================================================
  // CLOSE / RESET
  // ============================================================

  const handleFormClose = () => {
    setRecipient({} as AdminUser);
    setTaskRecipients([]);
    setPriority("MOYENNE");
    setErrorMessage("");

    reset();

    onClose();
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  const onSubmit = async (task: TaskData) => {
    if (taskRecipients.length === 0) {
      setErrorMessage("Veuillez sélectionner un destinataire");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const result = await window.electron.tasks.create(user.companyId, {
        companyId: user.companyId,
        author,
        subject: task.subject,
        message: task.message,
        recipients: taskRecipients,
        deadline: task.deadline,
        priority,
      });

      console.log("TASK SUCCESSFULLY CREATED:", result);

      setRecipient({} as AdminUser);
      setTaskRecipients([]);
      setPriority("MOYENNE");

      reset();

      onRefresh();
      onClose();

      window.electron.sync(user.companyId).catch((error) => {
        console.error("IMMEDIATE SYNC FAILED:", error);
      });
    } catch (error: any) {
      console.error("UNABLE TO SAVE TASK:", error);

      setErrorMessage("Une erreur est survenue. Veuillez contacter ADB Tech!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleFormClose}
      size={{ base: "full", sm: "lg", md: "2xl", lg: "4xl" }}
      isCentered
      scrollBehavior="inside"
    >
      <ModalOverlay backdropFilter="auto" backdropBlur="0.5rem" />

      <ModalContent
        bg="gray.100"
        maxH={{ base: "100vh", md: "90vh" }}
        overflow="hidden"
      >
        <form
          onSubmit={handleSubmit(onSubmit, (formErrors) => {
            console.error("FORM ERRORS:", formErrors);
          })}
        >
          {/* =====================================================
              HEADER
          ===================================================== */}

          <ModalHeader px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }}>
            <Flex
              direction={{ base: "column", md: "row" }}
              justify="space-between"
              align={{ base: "stretch", md: "center" }}
              gap={{ base: 4, md: 6 }}
              pr={{ base: 8, md: 10 }}
            >
              {/* TITLE */}

              <Box minW={0}>
                <HStack spacing={2} align="center">
                  <Box
                    color="blue.700"
                    fontSize={{
                      base: "1.35rem",
                      md: "1.6rem",
                    }}
                    flexShrink={0}
                  >
                    <MdTask />
                  </Box>

                  <Text
                    color="blue.700"
                    fontFamily="heading"
                    fontSize={{
                      base: "1.3rem",
                      md: "1.6rem",
                    }}
                    fontWeight="700"
                  >
                    Nouvelle tâche
                  </Text>
                </HStack>

                <Text
                  ml={{ base: 0, md: "2rem" }}
                  color="gray.500"
                  fontSize={{
                    base: "0.85rem",
                    md: "1rem",
                  }}
                  position="relative"
                  bottom="0.4rem"
                >
                  Créer une nouvelle tâche
                </Text>
              </Box>

              {/* =================================================
                  RECIPIENT SELECTOR
              ================================================= */}

              <Flex
                direction={{ base: "column", sm: "row" }}
                align={{ base: "stretch", sm: "center" }}
                gap={2}
                width={{ base: "100%", md: "auto" }}
              >
                <Menu>
                  <MenuButton
                    as={Button}
                    variant="outline"
                    bg="white"
                    borderColor="gray.300"
                    color={recipient?._id ? "blue.600" : "gray.600"}
                    width={{
                      base: "100%",
                      sm: "auto",
                    }}
                    maxW={{ base: "100%", md: "280px" }}
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                    onClick={() => setErrorMessage("")}
                    _hover={{
                      bg: "gray.50",
                    }}
                  >
                    {recipient?._id
                      ? `${recipient.firstName} ${recipient.lastName}`
                      : "Choisissez un destinataire"}
                  </MenuButton>

                  <MenuList
                    maxH="300px"
                    overflowY="auto"
                    maxW={{
                      base: "calc(100vw - 32px)",
                      md: "320px",
                    }}
                  >
                    {adminUsersList?.map((adminUser: AdminUser) => (
                      <MenuItem
                        key={adminUser._id}
                        onClick={() => setRecipient(adminUser)}
                        color="gray.800"
                        _hover={{
                          bg: "gray.100",
                        }}
                      >
                        {adminUser.firstName} {adminUser.lastName}
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>

                <Button
                  type="button"
                  isDisabled={!recipient?._id}
                  onClick={handleSelectRecipients}
                  bg="transparent"
                  color="green.500"
                  minW="40px"
                  px={2}
                  _hover={{
                    bg: "green.50",
                  }}
                  _disabled={{
                    opacity: 0.4,
                  }}
                >
                  <IoIosCheckmarkCircle size="1.4rem" />
                </Button>
              </Flex>
            </Flex>
          </ModalHeader>

          <ModalCloseButton onClick={handleFormClose} />

          {/* =====================================================
              BODY
          ===================================================== */}

          <ModalBody
            bg="white"
            px={{ base: 4, md: 6 }}
            py={{ base: 4, md: 5 }}
            overflowY="auto"
          >
            <VStack align="stretch" spacing={{ base: 4, md: 5 }}>
              {/* =================================================
                  SUBJECT / DEADLINE / PRIORITY
              ================================================= */}

              <SimpleGrid
                columns={{
                  base: 1,
                  sm: 2,
                  lg: 3,
                }}
                spacing={4}
              >
                {/* SUBJECT */}

                <FormControl isInvalid={!!errors.subject}>
                  <FormLabel mb={1} fontWeight="600" fontSize="0.95rem">
                    Sujet
                  </FormLabel>

                  <Input
                    {...register("subject")}
                    color="gray.800"
                    fontWeight="600"
                    fontSize={{
                      base: "1rem",
                      md: "1.1rem",
                    }}
                    height="42px"
                    bg="white"
                    borderColor="gray.300"
                    placeholder="Ex: Préparer rapport de caisse"
                    _placeholder={{
                      fontSize: "0.95rem",
                      fontWeight: "400",
                      color: "gray.400",
                    }}
                    _hover={{
                      borderColor: "gray.400",
                    }}
                    _focus={{
                      borderColor: "blue.400",
                      boxShadow: "0 0 0 1px #63B3ED",
                    }}
                  />

                  {errors.subject && (
                    <Text mt={1} color="red.500" fontSize="0.8rem">
                      {errors.subject.message}
                    </Text>
                  )}
                </FormControl>

                {/* DEADLINE */}

                <FormControl isInvalid={!!errors.deadline}>
                  <FormLabel mb={1} fontWeight="600" fontSize="0.95rem">
                    Date limite
                  </FormLabel>

                  <Controller
                    control={control}
                    name="deadline"
                    render={({ field }) => (
                      <DatePicker
                        selected={field.value ? new Date(field.value) : null}
                        onChange={(date: Date | null) => {
                          if (!date) {
                            field.onChange("");
                            return;
                          }

                          const year = date.getFullYear();

                          const month = String(date.getMonth() + 1).padStart(
                            2,
                            "0"
                          );

                          const day = String(date.getDate()).padStart(2, "0");

                          field.onChange(`${year}-${month}-${day}`);
                        }}
                        locale="fr"
                        dateFormat="dd/MM/yyyy"
                        showYearDropdown
                        scrollableYearDropdown
                        yearDropdownItemNumber={80}
                        customInput={
                          <Input
                            color="gray.800"
                            fontWeight="600"
                            fontSize={{
                              base: "1rem",
                              md: "1.1rem",
                            }}
                            width="100%"
                            height="42px"
                            bg="white"
                            borderColor="gray.300"
                            placeholder="Sélectionner une date"
                            _placeholder={{
                              fontSize: "0.95rem",
                              fontWeight: "400",
                              color: "gray.400",
                            }}
                          />
                        }
                      />
                    )}
                  />

                  {errors.deadline && (
                    <Text mt={1} color="red.500" fontSize="0.8rem">
                      {errors.deadline.message}
                    </Text>
                  )}
                </FormControl>

                {/* PRIORITY */}

                <FormControl>
                  <FormLabel mb={1} fontWeight="600" fontSize="0.95rem">
                    Priorité
                  </FormLabel>

                  <Menu>
                    <MenuButton
                      as={Button}
                      width="100%"
                      height="42px"
                      bg="white"
                      border="1px solid"
                      borderColor="gray.300"
                      textAlign="left"
                      fontWeight="600"
                      color="gray.800"
                      _hover={{
                        bg: "gray.50",
                      }}
                    >
                      {priority === "HAUTE"
                        ? "Haute"
                        : priority === "MOYENNE"
                        ? "Moyenne"
                        : "Basse"}
                    </MenuButton>

                    <MenuList>
                      <MenuItem onClick={() => setPriority("HAUTE")}>
                        Haute
                      </MenuItem>

                      <MenuItem onClick={() => setPriority("MOYENNE")}>
                        Moyenne
                      </MenuItem>

                      <MenuItem onClick={() => setPriority("BASSE")}>
                        Basse
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </FormControl>
              </SimpleGrid>

              {/* =================================================
                  DESCRIPTION
              ================================================= */}

              <FormControl isInvalid={!!errors.message}>
                <FormLabel mb={1} fontWeight="600" fontSize="0.95rem">
                  Description de la tâche
                </FormLabel>

                <Textarea
                  {...register("message")}
                  minH={{
                    base: "180px",
                    sm: "220px",
                    md: "280px",
                    lg: "320px",
                  }}
                  height={{
                    base: "180px",
                    sm: "220px",
                    md: "280px",
                    lg: "320px",
                  }}
                  resize="vertical"
                  bg="white"
                  borderColor="gray.300"
                  color="gray.800"
                  fontWeight="500"
                  fontSize={{
                    base: "1rem",
                    md: "1.1rem",
                  }}
                  placeholder="Décrivez la tâche en détail..."
                  _placeholder={{
                    color: "gray.400",
                    fontWeight: "400",
                  }}
                  _hover={{
                    borderColor: "gray.400",
                  }}
                  _focus={{
                    borderColor: "yellow.400",
                    boxShadow: "0 0 0 1px #F4C20D",
                  }}
                />
                <Flex
                  mt="0.5rem"
                  width="100%"
                  direction={{
                    base: "column",
                    sm: "row",
                  }}
                  justify="flex-end"
                  align={{
                    base: "stretch",
                    sm: "center",
                  }}
                  gap={3}
                >
                  {/* CREATE */}
                  <Button
                    type="submit"
                    borderRadius="8px"
                    bg="#F2B705"
                    color="black"
                    borderWidth="1px"
                    borderColor="#D9A000"
                    isLoading={isSubmitting}
                    loadingText="Patientez..."
                    spinnerPlacement="start"
                    isDisabled={isSubmitting}
                    leftIcon={<FaSave />}
                    width={{
                      base: "100%",
                      sm: "auto",
                    }}
                    minW={{ sm: "120px" }}
                    _hover={{
                      bg: "#E5AA00",
                    }}
                  >
                    Créer
                  </Button>
                  {/* CANCEL */}

                  <Button
                    type="button"
                    borderColor="#08162b"
                    borderRadius="8px"
                    bg="#08162b"
                    color="white"
                    borderWidth="1px"
                    onClick={handleFormClose}
                    leftIcon={<RxCrossCircled color="white" size="18px" />}
                    width={{
                      base: "100%",
                      sm: "auto",
                    }}
                    minW={{ sm: "120px" }}
                    _hover={{
                      bg: "#12233d",
                    }}
                  >
                    Annuler
                  </Button>
                </Flex>

                {errors.message && (
                  <Text mt={1} color="red.500" fontSize="0.8rem">
                    {errors.message.message}
                  </Text>
                )}
              </FormControl>

              {/* =================================================
                  SELECTED RECIPIENTS
              ================================================= */}

              {taskRecipients.length > 0 && (
                <Box>
                  <Text
                    mb={2}
                    fontSize="0.9rem"
                    fontWeight="600"
                    color="gray.600"
                  >
                    Destinataires sélectionnés
                  </Text>

                  <Flex wrap="wrap" gap={2}>
                    {taskRecipients.map((selectedRecipient) => (
                      <Tag
                        key={selectedRecipient._id}
                        size={{
                          base: "md",
                          md: "lg",
                        }}
                        borderRadius="md"
                        colorScheme="blue"
                      >
                        <TagLabel>
                          {selectedRecipient.firstName}{" "}
                          {selectedRecipient.lastName}
                        </TagLabel>

                        <TagCloseButton
                          onClick={() =>
                            handleRecipientDelete(selectedRecipient._id)
                          }
                        />
                      </Tag>
                    ))}
                  </Flex>
                </Box>
              )}

              {/* GENERAL ERROR */}

              {errorMessage && (
                <Text
                  color="red.500"
                  fontSize={{
                    base: "0.85rem",
                    md: "0.95rem",
                  }}
                  fontWeight="500"
                >
                  {errorMessage}
                </Text>
              )}
            </VStack>
          </ModalBody>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default TaskSubmissionModal;
