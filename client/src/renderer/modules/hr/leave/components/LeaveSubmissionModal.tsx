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
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import Employee from "../../../../../common/types/Employee";
import DatePicker from "react-datepicker";
import { FaSave } from "react-icons/fa";
import { RxCrossCircled } from "react-icons/rx";
import { MdFactory, MdPerson2, MdWork } from "react-icons/md";
import { FaCalendarDays } from "react-icons/fa6";
import { FaRegNoteSticky } from "react-icons/fa6";
import useAdminUser from "../../../../../store/auth.store";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  employees: Employee[];
}

const errorMessage = "Ce champ est obligatoire";

const schema = z.object({
  startDate: z.string().min(1, { message: errorMessage }),
  endDate: z.string().min(1, { message: errorMessage }),
  subject: z.string().min(1, { message: errorMessage }),
  notes: z.string().min(1, { message: errorMessage }),
});

type LeaveData = z.infer<typeof schema>;

const LeaveSubmissionModal = ({
  isOpen,
  onClose,
  onRefresh,
  employees,
}: Props) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useAdminUser((store) => store.adminUser);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<LeaveData>({ resolver: zodResolver(schema) });

  const handleMenuClick = (employee: Employee) => {
    console.log("EMPLOYEE SELECTED: ", employee);
    setEmployee(employee);
  };

  const handleFormClose = () => {
    setEmployee(null);
    reset();
    onClose();
    setErrorMessage("");
  };

  //Handle leave submission
  const onSubmit = async (leaveData: LeaveData) => {
    setIsSubmitting(true);
    if (!employee?._id) {
      console.error("NO EMPLOYEE SELECTED");
      return;
    }
    try {
      const leave = await window.electron.leave.create(user.companyId, {
        employeeId: employee._id,
        ...leaveData,
      });
      console.log("LEAVE CREATION SUCCESS:", leave);
      setEmployee(null);
      setErrorMessage("");
      onRefresh?.();
      reset();
      onClose();
    } catch (error: any) {
      console.error("Unable to save leave:", error.message);
      console.error("Unable to save leave:error status", error.status);
      if (error.status == "400")
        setErrorMessage("Une demande de congé existe deja pour cet employé");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal size="5xl" isOpen={isOpen} onClose={handleFormClose} isCentered>
      <ModalOverlay backdropFilter="auto" backdropBlur="0.5rem" />

      <ModalContent
        bg="white"
        borderRadius="14px"
        boxShadow="0 12px 40px rgba(0, 0, 0, 0.15)"
        overflow="hidden"
        maxH="90vh"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* =====================================================
            HEADER
        ===================================================== */}
          <ModalHeader
            bg="gray.50"
            borderBottom="1px solid"
            borderColor="gray.200"
            py={4}
            px={6}
          >
            <HStack justify="space-between" align="center">
              <HStack spacing={3}>
                <Box
                  w="38px"
                  h="38px"
                  borderRadius="10px"
                  bg="#FFF8E1"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <FaRegNoteSticky color="#F2B705" size="18px" />
                </Box>

                <Box>
                  <Text fontSize="1.15rem" fontWeight="700" color="gray.800">
                    Demande de congé
                  </Text>

                  <Text fontSize="0.8rem" color="gray.500" fontWeight="400">
                    Remplissez les informations de la demande
                  </Text>
                </Box>
              </HStack>

              {/* Employee selector */}
              <Menu>
                <MenuButton
                  as={Button}
                  variant="outline"
                  size="sm"
                  borderColor="gray.300"
                  bg="white"
                  color="gray.700"
                  _hover={{
                    bg: "gray.50",
                    borderColor: "#F2B705",
                  }}
                  _active={{
                    bg: "gray.50",
                  }}
                >
                  {employee?._id ? (
                    <HStack spacing={2}>
                      <Box
                        w="28px"
                        h="28px"
                        borderRadius="full"
                        bg="#FFF8E1"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <MdPerson2 color="#F2B705" size="16px" />
                      </Box>

                      <Box textAlign="left">
                        <Text
                          fontSize="0.9rem"
                          fontWeight="600"
                          color="gray.800"
                        >
                          {employee.firstName} {employee.lastName}
                        </Text>

                        <Text fontSize="0.7rem" color="gray.500">
                          #{employee.matricule}
                        </Text>
                      </Box>
                    </HStack>
                  ) : (
                    <HStack spacing={2}>
                      <MdPerson2 color="#F2B705" size="17px" />

                      <Text fontSize="0.85rem">Choisir un employé</Text>
                    </HStack>
                  )}
                </MenuButton>

                <MenuList
                  bg="white"
                  borderColor="gray.200"
                  boxShadow="0 8px 25px rgba(0,0,0,0.12)"
                  maxH="300px"
                  overflowY="auto"
                  zIndex={20}
                >
                  {employees.map((employee) => (
                    <MenuItem
                      key={employee._id}
                      onClick={() => handleMenuClick(employee)}
                      color="gray.700"
                      _hover={{
                        bg: "#FFF8E1",
                        color: "gray.900",
                      }}
                    >
                      <HStack spacing={2}>
                        <MdPerson2 color="#F2B705" size="16px" />

                        <Box>
                          <Text fontSize="0.85rem" fontWeight="500">
                            {employee.firstName} {employee.lastName}
                          </Text>

                          <Text fontSize="0.7rem" color="gray.500">
                            #{employee.matricule}
                          </Text>
                        </Box>
                      </HStack>
                    </MenuItem>
                  ))}
                </MenuList>
              </Menu>
            </HStack>
          </ModalHeader>

          {/* =====================================================
            BODY
        ===================================================== */}
          <ModalBody px={6} py={5}>
            <FormControl>
              <VStack spacing={4} align="stretch">
                {/* -------------------------------------------------
                  EMPLOYEE INFORMATION
              ------------------------------------------------- */}
                <Box>
                  <Text
                    fontSize="0.75rem"
                    fontWeight="700"
                    color="gray.500"
                    textTransform="uppercase"
                    letterSpacing="0.04em"
                    mb={3}
                  >
                    Informations de l'employé
                  </Text>

                  <Box
                    display="grid"
                    gridTemplateColumns="repeat(4, 1fr)"
                    gap={3}
                  >
                    {/* Last name */}
                    <Box>
                      <FormLabel
                        fontSize="0.78rem"
                        fontWeight="600"
                        color="gray.600"
                        mb={1}
                      >
                        <HStack spacing={1.5}>
                          <MdPerson2 color="#F2B705" />
                          <Text>Nom</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        size="sm"
                        bg="gray.50"
                        borderColor="gray.300"
                        color="gray.700"
                        value={employee?.lastName || ""}
                        isReadOnly
                        _readOnly={{
                          cursor: "default",
                        }}
                      />
                    </Box>

                    {/* First name */}
                    <Box>
                      <FormLabel
                        fontSize="0.78rem"
                        fontWeight="600"
                        color="gray.600"
                        mb={1}
                      >
                        <HStack spacing={1.5}>
                          <MdPerson2 color="#F2B705" />
                          <Text>Prénom</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        size="sm"
                        bg="gray.50"
                        borderColor="gray.300"
                        color="gray.700"
                        value={employee?.firstName || ""}
                        isReadOnly
                        _readOnly={{
                          cursor: "default",
                        }}
                      />
                    </Box>

                    {/* Role */}
                    <Box>
                      <FormLabel
                        fontSize="0.78rem"
                        fontWeight="600"
                        color="gray.600"
                        mb={1}
                      >
                        <HStack spacing={1.5}>
                          <MdWork color="#F2B705" />
                          <Text>Poste</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        size="sm"
                        bg="gray.50"
                        borderColor="gray.300"
                        color="gray.700"
                        value={employee?.role || ""}
                        isReadOnly
                        _readOnly={{
                          cursor: "default",
                        }}
                      />
                    </Box>

                    {/* Department */}
                    <Box>
                      <FormLabel
                        fontSize="0.78rem"
                        fontWeight="600"
                        color="gray.600"
                        mb={1}
                      >
                        <HStack spacing={1.5}>
                          <MdFactory color="#F2B705" />
                          <Text>Département</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        size="sm"
                        bg="gray.50"
                        borderColor="gray.300"
                        color="gray.700"
                        value={employee?.department || ""}
                        isReadOnly
                        _readOnly={{
                          cursor: "default",
                        }}
                      />
                    </Box>
                  </Box>
                </Box>

                {/* -------------------------------------------------
                  LEAVE DATES
              ------------------------------------------------- */}
                <Flex justify="space-evenly">
                  <VStack>
                    <Text
                      fontSize="0.75rem"
                      fontWeight="700"
                      color="gray.500"
                      textTransform="uppercase"
                      letterSpacing="0.04em"
                      mb={3}
                      position="relative"
                      right="1.5rem"
                    >
                      Période du congé
                    </Text>
                    {/* Start date */}
                    <Box>
                      <FormLabel
                        fontSize="0.78rem"
                        fontWeight="600"
                        color="gray.600"
                        mb={1}
                      >
                        <HStack spacing={1.5}>
                          <FaCalendarDays color="#F2B705" />
                          <Text>Date de début</Text>
                        </HStack>
                      </FormLabel>
                      <Controller
                        control={control}
                        name="startDate"
                        render={({ field }) => (
                          <DatePicker
                            selected={
                              field.value ? new Date(field.value) : null
                            }
                            onChange={(date: Date | null) => {
                              if (!date) {
                                field.onChange("");
                                return;
                              }
                              const year = date.getFullYear();
                              const month = String(
                                date.getMonth() + 1
                              ).padStart(2, "0");
                              const day = String(date.getDate()).padStart(
                                2,
                                "0"
                              );
                              field.onChange(`${year}-${month}-${day}`);
                            }}
                            locale="fr"
                            dateFormat="dd/MM/yyyy"
                            showYearDropdown
                            scrollableYearDropdown
                            yearDropdownItemNumber={100}
                            customInput={
                              <Input
                                size="sm"
                                bg="white"
                                borderColor="gray.300"
                                color="gray.700"
                                width="100%"
                                _hover={{
                                  borderColor: "gray.400",
                                }}
                                _focus={{
                                  borderColor: "#F2B705",
                                  boxShadow: "0 0 0 1px #F2B705",
                                }}
                              />
                            }
                          />
                        )}
                      />
                      {errors.startDate && (
                        <Text mt={1} fontSize="0.7rem" color="red.500">
                          {errors.startDate.message}
                        </Text>
                      )}
                    </Box>
                    {/* End date */}
                    <Box>
                      <FormLabel
                        fontSize="0.78rem"
                        fontWeight="600"
                        color="gray.600"
                        mb={1}
                      >
                        <HStack spacing={1.5}>
                          <FaCalendarDays color="#F2B705" />
                          <Text>Date de fin</Text>
                        </HStack>
                      </FormLabel>
                      <Controller
                        control={control}
                        name="endDate"
                        render={({ field }) => (
                          <DatePicker
                            selected={
                              field.value ? new Date(field.value) : null
                            }
                            onChange={(date: Date | null) => {
                              if (!date) {
                                field.onChange("");
                                return;
                              }
                              const year = date.getFullYear();
                              const month = String(
                                date.getMonth() + 1
                              ).padStart(2, "0");
                              const day = String(date.getDate()).padStart(
                                2,
                                "0"
                              );
                              field.onChange(`${year}-${month}-${day}`);
                            }}
                            locale="fr"
                            dateFormat="dd/MM/yyyy"
                            showYearDropdown
                            scrollableYearDropdown
                            yearDropdownItemNumber={100}
                            customInput={
                              <Input
                                size="sm"
                                bg="white"
                                borderColor="gray.300"
                                color="gray.700"
                                width="100%"
                                _hover={{
                                  borderColor: "gray.400",
                                }}
                                _focus={{
                                  borderColor: "#F2B705",
                                  boxShadow: "0 0 0 1px #F2B705",
                                }}
                              />
                            }
                          />
                        )}
                      />
                      {errors.endDate && (
                        <Text mt={1} fontSize="0.7rem" color="red.500">
                          {errors.endDate.message}
                        </Text>
                      )}
                    </Box>
                  </VStack>
                  {/* -------------------------------------------------
                    SUBJECT + NOTES
                  ------------------------------------------------- */}
                  <Box>
                    <Text
                      fontSize="0.75rem"
                      fontWeight="700"
                      color="gray.500"
                      textTransform="uppercase"
                      letterSpacing="0.04em"
                      mb={3}
                    >
                      Détails de la demande
                    </Text>
                    <Box>
                      {/* Subject */}
                      <Box>
                        <FormLabel
                          fontSize="0.78rem"
                          fontWeight="600"
                          color="gray.600"
                          mb={1}
                        >
                          <HStack spacing={1.5}>
                            <FaRegNoteSticky color="#F2B705" />
                            <Text>Sujet</Text>
                          </HStack>
                        </FormLabel>
                        <Input
                          size="sm"
                          bg="white"
                          borderColor="gray.300"
                          color="gray.700"
                          {...register("subject")}
                          _hover={{
                            borderColor: "gray.400",
                          }}
                          _focus={{
                            borderColor: "#F2B705",
                            boxShadow: "0 0 0 1px #F2B705",
                          }}
                        />
                        {errors.subject && (
                          <Text mt={1} fontSize="0.7rem" color="red.500">
                            {errors.subject.message}
                          </Text>
                        )}
                      </Box>
                      {/* Notes */}
                      <Box>
                        <FormLabel
                          fontSize="0.78rem"
                          fontWeight="600"
                          color="gray.600"
                          mb={1}
                        >
                          <HStack spacing={1.5}>
                            <FaRegNoteSticky color="#F2B705" />
                            <Text>Motif</Text>
                          </HStack>
                        </FormLabel>
                        <Textarea
                          size="md"
                          bg="white"
                          borderColor="gray.300"
                          color="gray.700"
                          height="75px"
                          resize="none"
                          placeholder="Décrivez brièvement le motif de votre demande..."
                          _placeholder={{
                            color: "gray.400",
                          }}
                          _hover={{
                            borderColor: "gray.400",
                          }}
                          _focus={{
                            borderColor: "#F2B705",
                            boxShadow: "0 0 0 1px #F2B705",
                          }}
                          {...register("notes")}
                        />
                        {errors.notes && (
                          <Text mt={1} fontSize="0.7rem" color="red.500">
                            {errors.notes.message}
                          </Text>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Flex>

                {/* Error */}
                {errorMessage && (
                  <Box
                    bg="red.50"
                    border="1px solid"
                    borderColor="red.200"
                    borderRadius="8px"
                    px={3}
                    py={2}
                  >
                    <Text fontSize="0.8rem" color="red.600" fontWeight="500">
                      {errorMessage}
                    </Text>
                  </Box>
                )}
              </VStack>
            </FormControl>
          </ModalBody>

          {/* =====================================================
            FOOTER
        ===================================================== */}
          <ModalFooter
            bg="gray.50"
            borderTop="1px solid"
            borderColor="gray.200"
            px={6}
            py={3}
          >
            <HStack spacing={3}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                borderColor="gray.300"
                color="gray.600"
                borderRadius="8px"
                onClick={handleFormClose}
                _hover={{
                  bg: "gray.100",
                  borderColor: "gray.400",
                }}
              >
                <HStack spacing={2}>
                  <RxCrossCircled size="16px" />
                  <Text>Annuler</Text>
                </HStack>
              </Button>

              <Button
                type="submit"
                size="sm"
                borderRadius="8px"
                bg="#F2B705"
                color="gray.900"
                fontWeight="600"
                isLoading={isSubmitting}
                loadingText="Patientez..."
                spinnerPlacement="start"
                isDisabled={isSubmitting}
                _hover={{
                  bg: "#DFA700",
                }}
                _active={{
                  bg: "#C99600",
                }}
              >
                <HStack spacing={2}>
                  <FaSave />
                  <Text>Soumettre</Text>
                </HStack>
              </Button>
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default LeaveSubmissionModal;
