import { useEffect } from "react";
import { useTimeOffMotifs } from "../hooks/useTimeOff";
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
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  VStack,
  Select,
  Checkbox,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import Employee from "../../../../../common/types/hr/employees/Employee";
import type { EmployeeDocument } from "../../../../../common/types/hr/employees/EmployeeDocuments";
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
  onCreate?: (
    input: Parameters<typeof window.electron.hr.timeOff.create>[1]
  ) => Promise<unknown>;
}

const errorMessage = "Ce champ est obligatoire";

const schema = z.object({
  startDate: z.string().min(1, { message: errorMessage }),
  endDate: z.string().min(1, { message: errorMessage }),
  motifId: z.string().trim().min(1, { message: errorMessage }),
  notes: z.string(),
});

type TimeOffData = z.infer<typeof schema>;

const TimeOffSubmissionModal = ({
  isOpen,
  onClose,
  onRefresh,
  employees,
  onCreate,
}: Props) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useAdminUser((store) => store.adminUser);
  const { data: motifs = [] } = useTimeOffMotifs(user.companyId);
  const [documentOptions, setDocumentOptions] = useState<
    Array<Pick<EmployeeDocument, "_id" | "originalName">>
  >([]);
  const [supportingDocumentIds, setSupportingDocumentIds] = useState<string[]>(
    []
  );
  const [isPartialDay, setIsPartialDay] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<TimeOffData>({
    resolver: zodResolver(schema),
    defaultValues: { motifId: "", notes: "" },
  });

  const selectedMotif = motifs.find((motif) => motif._id === watch("motifId"));

  useEffect(() => {
    let active = true;
    if (!employee?._id) {
      setDocumentOptions([]);
      setSupportingDocumentIds([]);
      return;
    }
    void window.electron.hr.employees_documents
      .getByEmployee(user.companyId, employee._id)
      .then((documents: EmployeeDocument[]) => {
        if (active)
          setDocumentOptions(
            documents
              .filter((document) => !document.isDeleted)
              .map(({ _id, originalName }) => ({ _id, originalName }))
          );
      })
      .catch(() => {
        if (active) setDocumentOptions([]);
      });
    setSupportingDocumentIds([]);
    return () => {
      active = false;
    };
  }, [employee?._id, user.companyId]);

  const handleMenuClick = (employee: Employee) => {
    console.log("EMPLOYEE SELECTED: ", employee);
    setEmployee(employee);
  };

  const handleFormClose = () => {
    setEmployee(null);
    reset({ motifId: "", notes: "" });
    setSupportingDocumentIds([]);
    setIsPartialDay(false);
    onClose();
    setErrorMessage("");
  };

  //Handle time off submission
  const onSubmit = async (timeOffData: TimeOffData) => {
    setIsSubmitting(true);
    if (!employee?._id) {
      console.error("NO EMPLOYEE SELECTED");
      setIsSubmitting(false);
      return;
    }
    try {
      const motif = motifs.find(
        (item) => item._id === timeOffData.motifId && item.isActive
      );
      if (!motif) throw new Error("Choisissez un motif actif.");
      if (motif.requiresJustification && !timeOffData.notes.trim())
        throw new Error("Une justification est requise pour ce motif.");
      if (motif.requiresSupportingDocument && !supportingDocumentIds.length)
        throw new Error("Un document justificatif est requis pour ce motif.");
      if (isPartialDay && (!startTime || !endTime || startTime >= endTime))
        throw new Error("Les heures de la journée partielle sont invalides.");
      const input = {
        employeeId: employee._id,
        motifId: motif._id,
        startDate: timeOffData.startDate,
        endDate: timeOffData.endDate,
        submittedMonth: new Date().toISOString().slice(0, 7),
        isPartialDay,
        ...(isPartialDay ? { startTime, endTime } : {}),
        notes: timeOffData.notes,
        supportingDocumentIds,
      };
      if (onCreate) await onCreate(input);
      else await window.electron.hr.timeOff.create(user.companyId, input);
      setEmployee(null);
      setSupportingDocumentIds([]);
      setErrorMessage("");
      onRefresh?.();
      reset();
      onClose();
    } catch (error: any) {
      console.error("Unable to save time off request:", error.message);
      console.error(
        "Unable to save time off request:error status",
        error.status
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer la demande TimeOff."
      );
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

                  <Text fontSize="0.9rem" color="gray.500" fontWeight="400">
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
                        fontSize="0.92rem"
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
                        fontSize="0.92rem"
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
                        fontSize="0.92rem"
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
                        fontSize="0.92rem"
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
                  TIME OFF DATES
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
                        fontSize="0.92rem"
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
                    <Box mt="0.5rem">
                      <FormLabel
                        fontSize="0.92rem"
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
                    MOTIF + NOTES
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
                      {/* Motif */}
                      <Box>
                        <FormLabel
                          fontSize="0.92rem"
                          fontWeight="600"
                          color="gray.600"
                          mb={1}
                        >
                          <HStack spacing={1.5}>
                            <FaRegNoteSticky color="#F2B705" />
                            <Text>Motif</Text>
                          </HStack>
                        </FormLabel>
                        <Select
                          placeholder="Choisir un motif"
                          {...register("motifId")}
                        >
                          {motifs
                            .filter((motif) => motif.isActive)
                            .map((motif) => (
                              <option key={motif._id} value={motif._id}>
                                {motif.label}
                              </option>
                            ))}
                        </Select>
                        {errors.motifId && (
                          <Text mt={1} fontSize="0.7rem" color="red.500">
                            {errors.motifId.message}
                          </Text>
                        )}
                        {selectedMotif && (
                          <Text mt={1} fontSize="xs" color="gray.600">
                            {selectedMotif.requiresApproval
                              ? "Approbation requise"
                              : "Approbation non requise"}
                            {selectedMotif.deductFromLeaveBalance
                              ? " · Déduction du solde de congé"
                              : ""}
                            {selectedMotif.requiresSupportingDocument
                              ? " · Justificatif obligatoire"
                              : ""}
                          </Text>
                        )}
                      </Box>
                      {/* Notes */}
                      <Box mt="1rem">
                        <FormLabel
                          fontSize="0.92rem"
                          fontWeight="600"
                          color="gray.600"
                          mb={1}
                        >
                          <HStack spacing={1.5}>
                            <FaRegNoteSticky color="#F2B705" />
                            <Text>
                              Justification{" "}
                              {selectedMotif?.requiresJustification
                                ? "(obligatoire)"
                                : ""}
                            </Text>
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
                      <Checkbox
                        mt={3}
                        isChecked={isPartialDay}
                        onChange={(event) =>
                          setIsPartialDay(event.target.checked)
                        }
                      >
                        Journée partielle
                      </Checkbox>
                      {isPartialDay && (
                        <HStack mt={2}>
                          <Input
                            aria-label="Heure de début"
                            type="time"
                            value={startTime}
                            onChange={(event) =>
                              setStartTime(event.target.value)
                            }
                          />
                          <Input
                            aria-label="Heure de fin"
                            type="time"
                            value={endTime}
                            onChange={(event) => setEndTime(event.target.value)}
                          />
                        </HStack>
                      )}
                      {selectedMotif?.requiresSupportingDocument && (
                        <Box mt={3}>
                          <Text fontSize="sm" fontWeight="600" mb={2}>
                            Document justificatif obligatoire
                          </Text>
                          {documentOptions.length ? (
                            documentOptions.map((document) => (
                              <Checkbox
                                key={document._id}
                                display="block"
                                isChecked={supportingDocumentIds.includes(
                                  document._id
                                )}
                                onChange={(event) =>
                                  setSupportingDocumentIds((current) =>
                                    event.target.checked
                                      ? [...current, document._id]
                                      : current.filter(
                                          (id) => id !== document._id
                                        )
                                  )
                                }
                              >
                                {document.originalName}
                              </Checkbox>
                            ))
                          ) : (
                            <Text fontSize="sm" color="orange.600">
                              Aucun document disponible dans le dossier de cet
                              employé.
                            </Text>
                          )}
                        </Box>
                      )}
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

export default TimeOffSubmissionModal;
