import {
  Box,
  Button,
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
  onRefresh: () => void;
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
      onRefresh();
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
    <Modal size="5xl" isOpen={isOpen} onClose={onClose}>
      <ModalOverlay backdropFilter="auto" backdropBlur="0.5rem" />
      <ModalContent bg="#08162b">
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader color="#08162b" position="relative" left="120px">
            <HStack>
              <Box position="relative" left="120px">
                <p
                  style={{
                    color: "#ffffff",
                    fontSize: "21px",
                    fontWeight: "600",
                  }}
                >
                  Demande de congé
                </p>
              </Box>
              <Box position="relative" left="150px">
                <Menu>
                  <MenuButton
                    backgroundColor="transparent"
                    as={Button}
                    _hover={{ bg: "transparent" }}
                  >
                    {employee?._id ? (
                      <HStack spacing={2}>
                        <Text
                          color="#ffffff"
                          fontSize="22px"
                          position="relative"
                        >
                          {employee?.firstName} {employee?.lastName}
                        </Text>
                        <Text
                          color="#ffffff"
                          fontSize="18px"
                          position="relative"
                        >
                          #{employee.matricule}
                        </Text>
                      </HStack>
                    ) : (
                      <p style={{ color: "#ffffff", fontSize: "16px" }}>
                        Cliquez ici pour choisir un employé
                      </p>
                    )}
                  </MenuButton>
                  <MenuList
                    _expanded={{
                      bg: "transparent",
                    }}
                    maxH="450px"
                    overflowY="auto"
                  >
                    {employees.map((employee) => (
                      <MenuItem
                        key={employee._id}
                        onClick={() => handleMenuClick(employee)}
                        color="black"
                        _hover={{
                          backgroundColor: "#08162b",
                          color: "#ffffff",
                        }}
                      >
                        <Text>
                          {employee.firstName} {employee.lastName}
                        </Text>
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>
              </Box>
            </HStack>
          </ModalHeader>
          <ModalCloseButton onClick={handleFormClose} />
          <ModalBody>
            <FormControl>
              <VStack spacing="10px">
                <HStack>
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdPerson2 color="#F2B705" size="1.3rem" />
                      </Box>
                      <FormLabel
                        color="#e6ebfe"
                        marginBottom="10px"
                        fontSize="1.1rem"
                      >
                        Nom
                      </FormLabel>
                    </HStack>
                    <Input
                      type="text"
                      color="#e6ebfe"
                      fontSize="1.1rem"
                      width="250px"
                      value={employee?.lastName || ""}
                      isReadOnly
                    />
                  </Box>
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdPerson2 color="#F2B705" size="1.3rem" />
                      </Box>
                      <FormLabel
                        color="#e6ebfe"
                        marginBottom="10px"
                        fontSize="1.1rem"
                      >
                        {" "}
                        Prenom
                      </FormLabel>
                    </HStack>
                    <Input
                      type="text"
                      color="#e6ebfe"
                      fontSize="1.1rem"
                      width="250px"
                      value={employee?.firstName || ""}
                      isReadOnly
                    />
                  </Box>
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdWork color="#F2B705" size="1.3rem" />
                      </Box>
                      <FormLabel
                        color="#e6ebfe"
                        marginBottom="10px"
                        fontSize="1.1rem"
                      >
                        {" "}
                        Poste
                      </FormLabel>
                    </HStack>
                    <Input
                      type="text"
                      color="#e6ebfe"
                      fontSize="1.1rem"
                      width="250px"
                      value={employee?.role || ""}
                      isReadOnly
                    />
                  </Box>
                </HStack>

                <HStack>
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdFactory color="#F2B705" size="1.3rem" />
                      </Box>
                      <FormLabel
                        color="#e6ebfe"
                        marginBottom="10px"
                        fontSize="1.1rem"
                      >
                        {" "}
                        Departement
                      </FormLabel>
                    </HStack>
                    <Input
                      color="#e6ebfe"
                      fontSize="1.1rem"
                      type="text"
                      width="250px"
                      value={employee?.department || ""}
                      isReadOnly
                    />
                  </Box>
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <FaCalendarDays color="#F2B705" size="1.3rem" />
                      </Box>
                      <FormLabel
                        color="#e6ebfe"
                        marginBottom="10px"
                        fontSize="1.1rem"
                      >
                        {" "}
                        Date de début de congé
                      </FormLabel>
                    </HStack>
                    <Controller
                      control={control}
                      name="startDate"
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
                          yearDropdownItemNumber={100}
                          customInput={
                            <Input
                              color="#e6ebfe"
                              fontSize="1.1rem"
                              width="300px"
                              borderWidth="1px"
                            />
                          }
                        />
                      )}
                    />
                    {errors.startDate && (
                      <Text className="text-danger">
                        {errors.startDate.message}
                      </Text>
                    )}
                  </Box>
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <FaCalendarDays color="#F2B705" size="1.3rem" />
                      </Box>
                      <FormLabel
                        color="#e6ebfe"
                        marginBottom="10px"
                        fontSize="1.1rem"
                      >
                        {" "}
                        Date de fin de congé
                      </FormLabel>
                    </HStack>
                    <Controller
                      control={control}
                      name="endDate"
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
                          yearDropdownItemNumber={100}
                          customInput={
                            <Input
                              color="#e6ebfe"
                              fontSize="1.1rem"
                              width="300px"
                              borderWidth="1px"
                            />
                          }
                        />
                      )}
                    />
                    {errors.endDate && (
                      <Text className="text-danger">
                        {errors.endDate.message}
                      </Text>
                    )}
                  </Box>
                </HStack>
                <VStack>
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <FaRegNoteSticky color="#F2B705" size="1.3rem" />
                      </Box>
                      <FormLabel
                        color="#e6ebfe"
                        marginBottom="10px"
                        fontSize="1.1rem"
                      >
                        {" "}
                        Sujet
                      </FormLabel>
                    </HStack>
                    <Input
                      height="40px"
                      color="#e6ebfe"
                      fontSize="1.1rem"
                      width="300px"
                      borderWidth="1px"
                      {...register("subject")}
                    />
                    {errors.subject && (
                      <Text className="text-danger">
                        {errors.subject.message}
                      </Text>
                    )}
                  </Box>
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <FaRegNoteSticky color="#F2B705" size="1.3rem" />
                      </Box>
                      <FormLabel
                        color="#e6ebfe"
                        marginBottom="10px"
                        fontSize="1.1rem"
                      >
                        {" "}
                        Motif
                      </FormLabel>
                    </HStack>
                    <Textarea
                      color="gray.200"
                      fontSize="1.1rem"
                      height="300px"
                      width="350px"
                      resize="none"
                      placeholder="Decrivez brievement le motif de votre demande..."
                      _placeholder={{ opacity: 1, color: "gray.500" }}
                      {...register("notes")}
                    />
                    {errors.notes && (
                      <Text className="text-danger">
                        {errors.notes.message}
                      </Text>
                    )}
                  </Box>
                </VStack>
              </VStack>
            </FormControl>
          </ModalBody>

          <ModalFooter bg="#08162b">
            <HStack position="relative" right="2rem">
              <Text
                fontWeight="500"
                fontSize="1.1rem"
                position="relative"
                top="10px"
                right="20px"
                color="red.300"
              >
                {errorMessage}
              </Text>
              <Button
                borderRadius="10px"
                borderColor="black"
                bg="#F2B705"
                borderWidth="0.5px"
                colorScheme=" #320b01"
                color="black"
                mr={3}
                type="submit"
                isLoading={isSubmitting}
                loadingText="Patientez..."
                spinnerPlacement="start"
                isDisabled={isSubmitting}
              >
                <HStack>
                  <Box>
                    <FaSave />
                  </Box>
                  <Text fontSize="1rem"> Soumettre</Text>
                </HStack>
              </Button>
              <Button
                borderColor="#ffffff"
                borderRadius="10px"
                bg="#08162b"
                borderWidth="0.5px"
                colorScheme=" #320b01"
                color="#1a000d"
                mr={3}
                onClick={handleFormClose}
              >
                <HStack>
                  <Box>
                    <RxCrossCircled color="#ffffff" size="18px" />
                  </Box>
                  <Text color="#ffffff" fontSize="1rem">
                    Annuler
                  </Text>
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
