import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import type Employee from "../../../../../common/types/Employee";

import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";

import { fr } from "date-fns/locale";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { Controller, useForm } from "react-hook-form";

import { FaEdit, FaSave, FaUserEdit } from "react-icons/fa";
import { FaCalendarDays } from "react-icons/fa6";
import { GiRelationshipBounds, GiRotaryPhone } from "react-icons/gi";
import { IoCalendarNumberSharp, IoHome } from "react-icons/io5";
import { LuCircleDollarSign } from "react-icons/lu";
import { MdFactory, MdOutlineNumbers, MdPerson2, MdWork } from "react-icons/md";
import { RxCrossCircled } from "react-icons/rx";

import { z } from "zod";

import { useUpdateEmployee } from "../hooks/useEmployees";
import useAdminUser from "../../../../../store/auth.store";

registerLocale("fr", fr);

interface Props {
  _id: string | undefined;
  employee: Employee | null;
}

const errorMessage = "Ce champ est obligatoire";

const schema = z.object({
  firstName: z.string().min(1, { message: errorMessage }),

  lastName: z.string().min(1, { message: errorMessage }),

  matricule: z.string().min(1, { message: errorMessage }),

  dateBirth: z.string().min(1, { message: errorMessage }),

  role: z.string().min(1, { message: errorMessage }),

  department: z.string().min(1, { message: errorMessage }),

  dateHired: z.string().min(1, { message: errorMessage }),

  telephone: z
    .string()
    .min(1, "Le numéro de téléphone est obligatoire")
    .regex(/^\+?[0-9]{1,15}$/, "Numéro de téléphone invalide"),

  address: z.string().min(1, { message: errorMessage }),

  emergencyContact: z.string().min(1, { message: errorMessage }),

  relationship: z.string().min(1, { message: errorMessage }),

  contactPhone: z.string().min(1, { message: errorMessage }),

  salary: z.number().min(1, { message: errorMessage }),
});

type EmployeeData = z.infer<typeof schema>;

const inputStyles = {
  bg: "white",
  color: "#1F2937",
  borderColor: "#CBD5E1",
  borderWidth: "1px",
  borderRadius: "6px",
  height: "38px",
  _hover: {
    borderColor: "#94A3B8",
  },
  _focus: {
    borderColor: "#F2B705",
    boxShadow: "0 0 0 1px #F2B705",
  },
};

const labelStyles = {
  color: "#374151",
  fontSize: "13px",
  fontWeight: "600",
  marginBottom: "5px",
};

const iconColor = "#D39A00";

const UpdateEmployee = ({ _id, employee }: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [serverErrorMessage, setServerErrorMessage] = useState("");

  const companyId = useAdminUser((store) => store.adminUser.companyId);

  const updateEmployee = useUpdateEmployee();

  if (!employee) {
    return null;
  }

  const {
    firstName,
    lastName,
    matricule,
    dateBirth,
    role,
    department,
    dateHired,
    salary,
    address,
    telephone,
    emergencyContact,
    relationship,
    contactPhone,
  } = employee;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EmployeeData>({
    resolver: zodResolver(schema),

    defaultValues: {
      firstName,
      lastName,
      matricule,
      dateBirth,
      role,
      department,
      dateHired,
      salary,
      address,
      telephone,
      emergencyContact,
      relationship,
      contactPhone,
    },
  });

  useEffect(() => {
    reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      matricule: employee.matricule,
      role: employee.role,
      department: employee.department,
      salary: employee.salary,
      telephone: employee.telephone,
      emergencyContact: employee.emergencyContact,
      relationship: employee.relationship,
      contactPhone: employee.contactPhone,
      address: employee.address,
      dateHired: employee.dateHired,
      dateBirth: employee.dateBirth,
    });
  }, [employee, reset]);

  const onSubmit = async (data: EmployeeData) => {
    if (!_id) {
      setServerErrorMessage("Impossible de modifier cet employé.");
      return;
    }

    setServerErrorMessage("");

    try {
      console.log("INFO TO UPDATE:", data);

      const updatedEmployee = await updateEmployee.mutateAsync({
        companyId,
        _id,
        data,
      });

      console.log("EMPLOYEE SUCCESSFULLY UPDATED:", updatedEmployee);

      if (!updatedEmployee) return;

      reset({
        firstName: updatedEmployee.firstName,
        lastName: updatedEmployee.lastName,
        matricule: updatedEmployee.matricule,
        dateBirth: updatedEmployee.dateBirth,
        role: updatedEmployee.role,
        department: updatedEmployee.department,
        dateHired: updatedEmployee.dateHired,
        salary: updatedEmployee.salary,
        address: updatedEmployee.address,
        telephone: updatedEmployee.telephone,
        emergencyContact: updatedEmployee.emergencyContact,
        relationship: updatedEmployee.relationship,
        contactPhone: updatedEmployee.contactPhone,
      });

      onClose();
    } catch (error) {
      console.error("AN ERROR OCCURRED WHILE UPDATING EMPLOYEE:", error);

      setServerErrorMessage(
        "Une erreur s'est produite. Veuillez contacter ADB Tech."
      );
    }
  };

  const handleFormClosed = () => {
    if (updateEmployee.isPending) {
      return;
    }

    setServerErrorMessage("");
    onClose();
  };

  const renderDatePicker = (name: "dateBirth" | "dateHired", minDate: Date) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <DatePicker
          selected={field.value ? new Date(field.value) : null}
          onChange={(date: Date | null) => {
            field.onChange(date ? date.toISOString().split("T")[0] : "");
          }}
          locale="fr"
          dateFormat="dd/MM/yyyy"
          isClearable
          showYearDropdown
          scrollableYearDropdown
          yearDropdownItemNumber={80}
          minDate={minDate}
          maxDate={new Date()}
          customInput={<Input {...inputStyles} width="100%" />}
        />
      )}
    />
  );

  return (
    <>
      <Button
        bg="#4F46E5"
        color="white"
        height="40px"
        px={4}
        borderRadius="6px"
        _hover={{
          bg: "#4338CA",
        }}
        onClick={onOpen}
      >
        {" "}
        <FaEdit size="1rem" />
        <Text ml="0.6rem" fontSize="14px">
          Modifier
        </Text>
      </Button>

      <Modal
        size="5xl"
        isOpen={isOpen}
        onClose={handleFormClosed}
        returnFocusOnClose={false}
        isCentered
      >
        <ModalOverlay backdropFilter="auto" backdropBlur="0.3rem" />

        <ModalContent
          bg="white"
          color="#1F2937"
          borderRadius="10px"
          overflow="hidden"
          boxShadow="0 20px 50px rgba(15, 23, 42, 0.18)"
          width="min(1100px, 92vw)"
          maxH="90vh"
        >
          <form
            onSubmit={handleSubmit(
              (data) => {
                console.log("VALID SUBMIT", data);
                onSubmit(data);
              },
              (errors) => {
                console.log("VALIDATION ERRORS", errors);
              }
            )}
          >
            {/* ======================================================
            HEADER
        ====================================================== */}

            <ModalHeader
              bg="#F8FAFC"
              borderBottom="1px solid #E2E8F0"
              px={6}
              py={4}
            >
              <Flex justify="space-between">
                <HStack spacing={3}>
                  <Flex
                    height="44px"
                    width="44px"
                    borderRadius="8px"
                    bg="#FFF8DD"
                    border="1px solid #F2B705"
                    justifyContent="center"
                    alignItems="center"
                    flexShrink={0}
                  >
                    <FaUserEdit color={iconColor} size="1.5rem" />
                  </Flex>
                  <Box>
                    <Text
                      fontSize="19px"
                      fontWeight="700"
                      color="#1F2937"
                      lineHeight="1.2"
                    >
                      Modification de l'employé
                    </Text>
                    <Text
                      color="#64748B"
                      fontSize="13px"
                      mt={1}
                      fontWeight="400"
                    >
                      Modifiez les informations de l'employé
                    </Text>
                  </Box>
                </HStack>
                <Button
                  bg="#F2B705"
                  color="#1F2937"
                  height="38px"
                  px={5}
                  fontWeight="700"
                  border="1px solid #D39A00"
                  isLoading={updateEmployee.isPending}
                  loadingText="Patientez..."
                  spinnerPlacement="start"
                  isDisabled={updateEmployee.isPending}
                  type="submit"
                  _hover={{
                    bg: "#E0A900",
                  }}
                  _active={{
                    bg: "#CC9900",
                  }}
                >
                  <HStack spacing={2}>
                    <FaSave size="14px" />
                    <Text fontSize="14px">Enregistrer</Text>
                  </HStack>
                </Button>
              </Flex>
            </ModalHeader>

            {/* ======================================================
            BODY
        ====================================================== */}

            <ModalBody px={6} py={4} overflow="hidden">
              <VStack spacing={3} align="stretch">
                {/* ==================================================
                PERSONAL INFORMATION
            ================================================== */}

                <Box>
                  <Text
                    fontSize="12px"
                    fontWeight="700"
                    color="#64748B"
                    textTransform="uppercase"
                    letterSpacing="0.6px"
                    mb={2}
                  >
                    Informations personnelles
                  </Text>

                  <Grid templateColumns="repeat(3, 1fr)" gap={3}>
                    {/* NOM */}

                    <FormControl isInvalid={!!errors.lastName}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <MdPerson2 color={iconColor} size="15px" />
                          <Text>Nom</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        type="text"
                        {...inputStyles}
                        {...register("lastName")}
                      />

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.lastName?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>

                    {/* PRENOM */}

                    <FormControl isInvalid={!!errors.firstName}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <MdPerson2 color={iconColor} size="15px" />
                          <Text>Prénom</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        type="text"
                        {...inputStyles}
                        {...register("firstName")}
                      />

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.firstName?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>

                    {/* DATE NAISSANCE */}

                    <FormControl isInvalid={!!errors.dateBirth}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <IoCalendarNumberSharp
                            color={iconColor}
                            size="15px"
                          />
                          <Text>Date de naissance</Text>
                        </HStack>
                      </FormLabel>

                      {renderDatePicker("dateBirth", new Date(1940, 0, 1))}

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.dateBirth?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>
                  </Grid>
                </Box>

                {/* ==================================================
                EMPLOYMENT INFORMATION
            ================================================== */}

                <Box borderTop="1px solid #E5E7EB" pt={3}>
                  <Text
                    fontSize="12px"
                    fontWeight="700"
                    color="#64748B"
                    textTransform="uppercase"
                    letterSpacing="0.6px"
                    mb={2}
                  >
                    Informations professionnelles
                  </Text>

                  <Grid templateColumns="repeat(3, 1fr)" gap={3}>
                    {/* MATRICULE */}

                    <FormControl isInvalid={!!errors.matricule}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <MdOutlineNumbers color={iconColor} size="15px" />
                          <Text>Matricule</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        type="text"
                        {...inputStyles}
                        {...register("matricule")}
                      />

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.matricule?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>

                    {/* POSTE */}

                    <FormControl isInvalid={!!errors.role}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <MdWork color={iconColor} size="15px" />
                          <Text>Poste</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        type="text"
                        {...inputStyles}
                        {...register("role")}
                      />

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.role?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>

                    {/* DEPARTEMENT */}

                    <FormControl isInvalid={!!errors.department}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <MdFactory color={iconColor} size="15px" />
                          <Text>Département</Text>
                        </HStack>
                      </FormLabel>

                      <Select
                        {...inputStyles}
                        placeholder="Choisissez un département"
                        focusBorderColor="#F2B705"
                        iconColor={iconColor}
                        {...register("department")}
                      >
                        <option value="Administration">Administration</option>

                        <option value="Atelier">Atelier</option>

                        <option value="Usine">Usine</option>

                        <option value="Magasin">Magasin</option>

                        <option value="Sentinelle">Sentinelle</option>
                      </Select>

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.department?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>

                    {/* SALAIRE */}

                    <FormControl isInvalid={!!errors.salary}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <LuCircleDollarSign color={iconColor} size="15px" />
                          <Text>Salaire</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        type="number"
                        {...inputStyles}
                        {...register("salary", {
                          valueAsNumber: true,
                        })}
                      />

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.salary?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>

                    {/* TELEPHONE */}

                    <FormControl isInvalid={!!errors.telephone}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <GiRotaryPhone color={iconColor} size="15px" />
                          <Text>Téléphone</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        type="text"
                        {...inputStyles}
                        {...register("telephone")}
                      />

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.telephone?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>

                    {/* DATE EMBAUCHE */}

                    <FormControl isInvalid={!!errors.dateHired}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <FaCalendarDays color={iconColor} size="14px" />
                          <Text>Date d'embauche</Text>
                        </HStack>
                      </FormLabel>

                      {renderDatePicker("dateHired", new Date(1990, 0, 1))}

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.dateHired?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>
                  </Grid>
                </Box>

                {/* ==================================================
                EMERGENCY CONTACT
            ================================================== */}

                <Box borderTop="1px solid #E5E7EB" pt={3}>
                  <Text
                    fontSize="12px"
                    fontWeight="700"
                    color="#64748B"
                    textTransform="uppercase"
                    letterSpacing="0.6px"
                    mb={2}
                  >
                    Contact d'urgence
                  </Text>

                  <Grid templateColumns="repeat(3, 1fr)" gap={3}>
                    {/* CONTACT */}

                    <FormControl isInvalid={!!errors.emergencyContact}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <MdPerson2 color={iconColor} size="15px" />
                          <Text>Contact</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        type="text"
                        {...inputStyles}
                        {...register("emergencyContact")}
                      />

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.emergencyContact?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>

                    {/* RELATION */}

                    <FormControl isInvalid={!!errors.relationship}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <GiRelationshipBounds color={iconColor} size="15px" />
                          <Text>Relation</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        type="text"
                        {...inputStyles}
                        {...register("relationship")}
                      />

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.relationship?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>

                    {/* TELEPHONE CONTACT */}

                    <FormControl isInvalid={!!errors.contactPhone}>
                      <FormLabel {...labelStyles}>
                        <HStack spacing={1.5}>
                          <MdOutlineNumbers color={iconColor} size="15px" />
                          <Text>Téléphone</Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        type="text"
                        {...inputStyles}
                        {...register("contactPhone")}
                      />

                      <Box minH="18px">
                        <FormErrorMessage fontSize="11px">
                          {errors.contactPhone?.message}
                        </FormErrorMessage>
                      </Box>
                    </FormControl>
                  </Grid>
                </Box>

                {/* ==================================================
                ADDRESS
            ================================================== */}

                <Box borderTop="1px solid #E5E7EB" pt={3}>
                  <FormControl isInvalid={!!errors.address}>
                    <FormLabel {...labelStyles}>
                      <HStack spacing={1.5}>
                        <IoHome color={iconColor} size="15px" />
                        <Text>Adresse</Text>
                      </HStack>
                    </FormLabel>

                    <Input
                      type="text"
                      {...inputStyles}
                      {...register("address")}
                    />

                    <Box minH="18px">
                      <FormErrorMessage fontSize="11px">
                        {errors.address?.message}
                      </FormErrorMessage>
                    </Box>
                  </FormControl>
                </Box>
              </VStack>
            </ModalBody>

            {/* ======================================================
            FOOTER
        ====================================================== */}

            <ModalFooter
              bg="#F8FAFC"
              borderTop="1px solid #E2E8F0"
              px={6}
              py={3}
            >
              <Flex width="100%" align="center" justify="space-between">
                <Text fontSize="12px" color="red.500" fontWeight="500">
                  {serverErrorMessage}
                </Text>
              </Flex>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
};

export default UpdateEmployee;
