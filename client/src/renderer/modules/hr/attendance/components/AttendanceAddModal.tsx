import {
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import TimePicker from "react-time-picker";
import "react-datepicker/dist/react-datepicker.css";
import "react-time-picker/dist/TimePicker.css";
import Employee from "../../../../../common/types/Employee";
import useAdminUser from "../../../../../store/auth.store";

interface AddAttendanceModalProps {
  date: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

type AttendanceType = "PRESENT" | "ABSENT" | "CONGÉ";

const AddAttendanceModal = ({
  date,
  isOpen,
  onClose,
  onCreated,
}: AddAttendanceModalProps) => {
  const toast = useToast();

  const [employeeId, setEmployeeId] = useState("");
  const [attendanceType, setAttendanceType] =
    useState<AttendanceType>("PRESENT");

  const [clockIn, setClockIn] = useState<string | null>("08:00");
  const [clockOut, setClockOut] = useState<string | null>("16:30");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);
  const user = useAdminUser((store) => store.adminUser);

  useEffect(() => {
    if (!isOpen) return;

    loadEmployeesWithoutAttendance();
  }, [isOpen, date]);

  const loadEmployeesWithoutAttendance = async () => {
    try {
      setLoadingEmployees(true);

      const result =
        await window.electron.attendance.getEmployeesWithoutAttendance(
          user.companyId,
          date
        );

      console.log(`EMPLOYEES WITHOUT ATTENDANCE RECORD FOR ${date}`, result);

      setEmployees(result);
    } catch (error) {
      console.error("FAILED TO LOAD EMPLOYEES WITHOUT ATTENDANCE", error);

      toast({
        title: "Erreur",
        description: "Impossible de charger les employés sans présence.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-left",
      });
    } finally {
      setLoadingEmployees(false);
    }
  };

  const resetForm = () => {
    setEmployeeId("");
    setAttendanceType("PRESENT");
    setClockIn("08:00");
    setClockOut("16:30");
  };

  const handleClose = () => {
    if (saving) return;
    resetForm();
    onClose();
  };

  const handleAttendanceTypeChange = (value: string) => {
    setAttendanceType(value as AttendanceType);
  };

  const handleSubmit = async () => {
    if (!employeeId) {
      toast({
        title: "Employé requis",
        description: "Veuillez sélectionner un employé.",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "top-left",
      });

      return;
    }

    const employee = employees.find((item) => item._id === employeeId);

    console.log("FETCHED EMPLOYEE IN THE MODAL:", employee);

    if (!employee) {
      toast({
        title: "Employé introuvable",
        description: "Impossible de trouver l'employé sélectionné.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-left",
      });

      return;
    }

    try {
      setSaving(true);

      /*
       * =====================================================
       * ABSENT
       * =====================================================
       */
      if (attendanceType === "ABSENT") {
        await window.electron.attendance.createAbsenceLeave(
          user.companyId,
          employee._id,
          "ABSENT",
          date
        );

        toast({
          title: "Absence enregistrée",
          description: `${employee.firstName} ${employee.lastName} a été marqué(e) absent(e).`,
          status: "success",
          duration: 5000,
          isClosable: true,
          position: "top-left",
        });

        onCreated?.();
        handleClose();
        return;
      }

      /*
       * =====================================================
       * CONGÉ
       * =====================================================
       */
      if (attendanceType === "CONGÉ") {
        const remainingLeave = employee.remainingLeave ?? 0;

        if (remainingLeave < 1) {
          toast({
            title: "Solde de congé insuffisant",
            description: "L'employé ne dispose d'aucun jour de congé restant.",
            status: "warning",
            duration: 5000,
            isClosable: true,
            position: "top-left",
          });

          return;
        }

        /*
         * Create the leave.
         */
        await window.electron.leave.create(user.companyId, {
          employeeId: employee._id,
          startDate: date,
          endDate: date,
          subject: "Congé",
          notes: "Absence convertie en congé.",
          status: "APPROUVÉ",
        });

        /*
         * Deduct one day from the employee's balance.
         */
        await window.electron.employees.update(user.companyId, employee._id, {
          remainingLeave: remainingLeave - 1,
        });

        /*
         * Create the corresponding attendance record.
         */
        await window.electron.attendance.createAbsenceLeave(
          user.companyId,
          employee._id,
          "CONGÉ",
          date
        );

        toast({
          title: "Congé enregistré",
          description: `Le congé de ${employee.firstName} ${employee.lastName} a été enregistré avec succès.`,
          status: "success",
          duration: 5000,
          isClosable: true,
          position: "top-left",
        });
        onCreated?.();
        handleClose();
        return;
      }

      /*
       * =====================================================
       * PRESENT
       * =====================================================
       */

      if (!clockIn) {
        toast({
          title: "Heure d'arrivée requise",
          description: "Veuillez sélectionner une heure d'arrivée.",
          status: "warning",
          duration: 5000,
          isClosable: true,
          position: "top-left",
        });

        return;
      }

      if (!clockOut) {
        toast({
          title: "Heure de départ requise",
          description: "Veuillez sélectionner une heure de départ.",
          status: "warning",
          duration: 5000,
          isClosable: true,
          position: "top-left",
        });

        return;
      }

      const [clockInhours, clockInMinutes] = clockIn.split(":");
      const clockInDate = new Date(date);
      clockInDate.setHours(
        parseInt(clockInhours),
        parseInt(clockInMinutes),
        0,
        0
      );
      const [clockOutHours, clockOutMinutes] = clockOut.split(":");
      const clockOutDate = new Date(date);
      clockOutDate.setHours(
        parseInt(clockOutHours),
        parseInt(clockOutMinutes),
        0,
        0
      );

      await window.electron.attendance.create(user.companyId, {
        employeeId,
        date,
        clockIn: clockInDate.toISOString(),
        clockOut: clockOutDate.toISOString(),
        status: "PRESENT",
      });

      toast({
        title: "Présence ajoutée",
        description: "La présence a été ajoutée avec succès.",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "top-left",
      });

      onCreated?.();
      handleClose();
    } catch (error) {
      console.error(`FAILED TO CREATE ${attendanceType} ATTENDANCE`, error);

      const message =
        error instanceof Error ? error.message : "Une erreur est survenue.";

      toast({
        title:
          attendanceType === "CONGÉ"
            ? "Échec de l'enregistrement du congé"
            : attendanceType === "ABSENT"
            ? "Échec de l'enregistrement de l'absence"
            : "Échec de l'ajout de la présence",
        description: message,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-left",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="lg">
      <ModalOverlay backdropFilter="blur(4px)" />

      <ModalContent borderRadius="14px">
        <ModalHeader>
          Ajouter une présence
          <Text fontSize="sm" fontWeight="400" color="gray.500" mt="0.3rem">
            Ajoutez manuellement une présence manquante.
          </Text>
        </ModalHeader>

        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={5} align="stretch">
            {/* DATE */}
            <FormControl>
              <FormLabel fontWeight="600">Date</FormLabel>

              <Box
                border="1px solid"
                borderColor="gray.300"
                borderRadius="8px"
                px="0.7rem"
                py="0.6rem"
                bg="gray.50"
                height="3rem"
              >
                <Text fontSize="1.1rem" fontWeight="500" color="gray.700">
                  {new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR")}
                </Text>
              </Box>
            </FormControl>

            {/* EMPLOYEE */}
            <FormControl>
              <FormLabel fontWeight="600">Employé</FormLabel>

              <Select
                placeholder={
                  loadingEmployees
                    ? "Chargement des employés..."
                    : employees.length === 0
                    ? "Tous les employés ont une présence"
                    : "Sélectionner un employé"
                }
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);

                  /*
                   * Reset the attendance type when switching
                   * employees.
                   */
                  setAttendanceType("PRESENT");
                }}
                isDisabled={
                  loadingEmployees || employees.length === 0 || saving
                }
              >
                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </Select>

              {employees.length > 0 && (
                <Text fontSize="xs" color="gray.500" mt="1">
                  {employees.length} employé(s) sans présence pour cette date.
                </Text>
              )}
            </FormControl>

            <Divider />

            {/* ATTENDANCE TYPE */}
            <FormControl>
              <FormLabel fontWeight="600">Type de présence</FormLabel>

              <RadioGroup
                value={attendanceType}
                onChange={handleAttendanceTypeChange}
              >
                <Stack direction="row" spacing={6}>
                  <Radio value="PRESENT" isDisabled={saving}>
                    PRÉSENT
                  </Radio>

                  <Radio value="ABSENT" isDisabled={saving || !employeeId}>
                    ABSENT
                  </Radio>

                  <Radio value="CONGÉ" isDisabled={saving || !employeeId}>
                    CONGÉ
                  </Radio>
                </Stack>
              </RadioGroup>

              {!employeeId && (
                <Text fontSize="xs" color="gray.500" mt="2">
                  Sélectionnez d'abord un employé.
                </Text>
              )}

              {saving && attendanceType !== "PRESENT" && (
                <Text fontSize="xs" color="blue.500" mt="2">
                  Enregistrement en cours...
                </Text>
              )}
            </FormControl>

            {/* TIMES */}
            {attendanceType === "PRESENT" && (
              <HStack spacing={4} align="start">
                {/* CLOCK IN */}
                <FormControl>
                  <FormLabel fontWeight="600">Heure d'arrivée</FormLabel>

                  <Box
                    border="1px solid"
                    borderColor="gray.300"
                    borderRadius="8px"
                    px="0.7rem"
                    py="0.35rem"
                  >
                    <TimePicker
                      value={clockIn}
                      onChange={setClockIn}
                      format="HH:mm"
                      disableClock
                      clearIcon={null}
                      disabled={saving}
                    />
                  </Box>
                </FormControl>

                {/* CLOCK OUT */}
                <FormControl>
                  <FormLabel fontWeight="600">Heure de départ</FormLabel>

                  <Box
                    border="1px solid"
                    borderColor="gray.300"
                    borderRadius="8px"
                    px="0.7rem"
                    py="0.35rem"
                  >
                    <TimePicker
                      value={clockOut}
                      onChange={setClockOut}
                      format="HH:mm"
                      disableClock
                      clearIcon={null}
                      disabled={saving}
                    />
                  </Box>
                </FormControl>
              </HStack>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="ghost"
            mr={3}
            onClick={handleClose}
            isDisabled={saving}
          >
            Annuler
          </Button>

          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isLoading={saving}
            loadingText="Ajout..."
            isDisabled={
              !employeeId || loadingEmployees || employees.length === 0
            }
          >
            Ajouter
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddAttendanceModal;
