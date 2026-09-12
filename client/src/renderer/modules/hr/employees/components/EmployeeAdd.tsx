import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
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
  SimpleGrid,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { fr } from "date-fns/locale";
import { useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Controller, useForm } from "react-hook-form";
import { BsPersonFillAdd } from "react-icons/bs";
import { FaSave } from "react-icons/fa";
import { FaCalendarDays } from "react-icons/fa6";
import { GiRelationshipBounds, GiRotaryPhone } from "react-icons/gi";
import { IoCalendarNumberSharp, IoHome, IoPersonAdd } from "react-icons/io5";
import { LuCircleDollarSign } from "react-icons/lu";
import { MdFactory, MdOutlineNumbers, MdPerson2, MdWork } from "react-icons/md";
import { RxCrossCircled } from "react-icons/rx";
import { z } from "zod";
import "../../../../styles/App.css";
import useAdminUser from "../../../../../store/auth.store";
import { employeeKeys } from "../hooks/useEmployees";

registerLocale("fr", fr);

const errorMessage = "Ce champ est obligatoire";

const schema = z.object({
  firstName: z.string().trim().min(1, { message: errorMessage }),

  lastName: z.string().trim().min(1, { message: errorMessage }),

  matricule: z.string().trim().min(1, { message: errorMessage }),

  idNum: z.string().trim().min(1, { message: errorMessage }),

  dateBirth: z.string().min(1, { message: errorMessage }),

  role: z.string().trim().min(1, { message: errorMessage }),

  department: z.string().min(1, { message: errorMessage }),

  dateHired: z.string().min(1, { message: errorMessage }),

  telephone: z
    .string()
    .trim()
    .min(1, { message: "Le numéro de téléphone est obligatoire" }),

  address: z.string().trim().min(1, { message: errorMessage }),

  emergencyContact: z.string().trim().min(1, { message: errorMessage }),

  relationship: z.string().trim().min(1, { message: errorMessage }),

  contactPhone: z.string().trim().min(1, { message: errorMessage }),

  salary: z
    .number({
      required_error: errorMessage,
      invalid_type_error: "Veuillez saisir un salaire valide",
    })
    .finite("Veuillez saisir un salaire valide")
    .positive("Le salaire doit être supérieur à 0"),
});

type EmployeeData = z.infer<typeof schema>;

const fieldStyles = {
  bg: "white",
  borderColor: "gray.300",
  borderWidth: "1px",
  borderRadius: "7px",
  height: "38px",
  fontSize: "0.9rem",
  color: "gray.800",
  _hover: {
    borderColor: "gray.400",
  },
  _focus: {
    borderColor: "#F2B705",
    boxShadow: "0 0 0 1px #F2B705",
  },
};

const sectionTitleStyles = {
  fontSize: "0.82rem",
  fontWeight: "700",
  color: "gray.600",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const AddEmployee = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const queryClient = useQueryClient();

  const [ServerErrorMessage, setServerErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const companyId = useAdminUser((store) => store.adminUser.companyId);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EmployeeData>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
  });

  const onSubmit = async (employeeData: EmployeeData) => {
    setIsSaving(true);
    setServerErrorMessage("");

    console.log("Form to be submitted:", employeeData);

    try {
      const employee = await window.electron.employees.create(
        companyId,
        employeeData
      );

      console.log("Employee successfully saved", employee);

      await queryClient.invalidateQueries({
        queryKey: employeeKeys.all,
      });

      reset();
      setServerErrorMessage("");
      onClose();
    } catch (error: any) {
      console.error("An error occurred while adding employee:", error);

      /*
       * Try to extract a useful error message from the backend /
       * Electron IPC layer.
       */
      let message =
        "Une erreur s'est produite lors de l'enregistrement de l'employé.";

      if (typeof error === "string") {
        message = error;
      } else if (error?.message) {
        message = error.message;
      } else if (error?.response?.data?.message) {
        message = error.response.data.message;
      } else if (error?.response?.data?.error) {
        message = error.response.data.error;
      }

      /*
       * Convert some technical errors into user-friendly French
       * messages.
       */
      const lowerMessage = message.toLowerCase();

      if (
        lowerMessage.includes("matricule") &&
        (lowerMessage.includes("unique") ||
          lowerMessage.includes("duplicate") ||
          lowerMessage.includes("exist"))
      ) {
        message =
          "Ce matricule existe déjà. Veuillez saisir un autre matricule.";
      } else if (
        lowerMessage.includes("idnum") ||
        lowerMessage.includes("carte d'identité") ||
        lowerMessage.includes("identity")
      ) {
        if (
          lowerMessage.includes("unique") ||
          lowerMessage.includes("duplicate") ||
          lowerMessage.includes("exist")
        ) {
          message = "Ce numéro de carte d'identité existe déjà.";
        }
      } else if (
        lowerMessage.includes("telephone") ||
        lowerMessage.includes("phone")
      ) {
        if (
          lowerMessage.includes("unique") ||
          lowerMessage.includes("duplicate") ||
          lowerMessage.includes("exist")
        ) {
          message = "Ce numéro de téléphone existe déjà.";
        }
      } else if (
        lowerMessage.includes("network") ||
        lowerMessage.includes("fetch") ||
        lowerMessage.includes("timeout") ||
        lowerMessage.includes("econnrefused")
      ) {
        message =
          "Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.";
      }

      setServerErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;

    setServerErrorMessage("");
    reset();
    onClose();
  };

  const Required = () => (
    <Text as="span" color="#F2B705" ml="2px">
      *
    </Text>
  );

  const FieldError = ({ message }: { message?: string }) => {
    if (!message) return null;

    return (
      <Text
        color="red.500"
        fontSize="0.68rem"
        fontWeight="500"
        mt="2px"
        lineHeight="1.2"
      >
        {message}
      </Text>
    );
  };

  return (
    <>
      {/* Open button */}
      <Button
        colorScheme="blue"
        px="16px"
        height="40px"
        borderRadius="8px"
        _hover={{
          bg: "blue.600",
          color: "white",
          transform: "scale(1.02)",
        }}
        transition="all 0.15s ease"
        onClick={() => {
          setServerErrorMessage("");
          onOpen();
        }}
        isLoading={isSaving}
        loadingText="Patientez..."
        spinnerPlacement="start"
        isDisabled={isSaving}
      >
        <IoPersonAdd fontSize="1.15rem" />

        <Text fontSize="0.95rem" ml="9px">
          Ajouter un employé
        </Text>
      </Button>

      <Modal size="5xl" isOpen={isOpen} onClose={handleClose} isCentered>
        <ModalOverlay backdropFilter="auto" backdropBlur="0.5rem" />

        <ModalContent
          bg="white"
          borderRadius="14px"
          overflow="hidden"
          maxH="92vh"
          boxShadow="0 10px 40px rgba(0,0,0,0.18)"
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* ================= HEADER ================= */}
            <ModalHeader
              bg="gray.50"
              borderBottom="1px solid"
              borderColor="gray.200"
              px="24px"
              py="14px"
            >
              <HStack spacing="13px">
                <Flex
                  w="43px"
                  h="43px"
                  borderRadius="10px"
                  bg="#FFF8DF"
                  border="1px solid"
                  borderColor="#F2B705"
                  align="center"
                  justify="center"
                  flexShrink={0}
                >
                  <BsPersonFillAdd color="#F2B705" size="1.8rem" />
                </Flex>

                <VStack align="flex-start" spacing="0">
                  <Text
                    fontSize="1.3rem"
                    fontWeight="700"
                    color="gray.800"
                    lineHeight="1.2"
                  >
                    Nouveau employé
                  </Text>

                  <Text color="gray.500" fontSize="0.9rem" mt="2px">
                    Ajoutez les informations du nouvel employé
                  </Text>
                </VStack>
              </HStack>
            </ModalHeader>

            <ModalCloseButton
              top="13px"
              right="15px"
              color="gray.500"
              borderRadius="6px"
              _hover={{
                bg: "gray.200",
                color: "gray.800",
              }}
            />

            {/* ================= BODY ================= */}
            <ModalBody px="24px" py="14px" bg="white">
              <VStack spacing="11px" align="stretch">
                {/* ================= IDENTITÉ ================= */}
                <Box>
                  <Text {...sectionTitleStyles} mb="7px">
                    Informations personnelles
                  </Text>

                  <SimpleGrid
                    columns={{
                      base: 1,
                      md: 2,
                      lg: 4,
                    }}
                    spacing="10px"
                  >
                    {/* Nom */}
                    <FormControl isInvalid={!!errors.lastName}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <MdPerson2 color="#F2B705" size="1rem" />

                          <Text>
                            Nom <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="text"
                        {...register("lastName")}
                      />

                      <FieldError message={errors.lastName?.message} />
                    </FormControl>

                    {/* Prénom */}
                    <FormControl isInvalid={!!errors.firstName}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <MdPerson2 color="#F2B705" size="1rem" />

                          <Text>
                            Prénom <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="text"
                        {...register("firstName")}
                      />

                      <FieldError message={errors.firstName?.message} />
                    </FormControl>

                    {/* Date naissance */}
                    <FormControl isInvalid={!!errors.dateBirth}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <IoCalendarNumberSharp color="#F2B705" size="1rem" />

                          <Text>
                            Date de naissance <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Controller
                        control={control}
                        name="dateBirth"
                        render={({ field }) => (
                          <DatePicker
                            selected={
                              field.value ? new Date(field.value) : null
                            }
                            onChange={(date: Date | null) => {
                              field.onChange(
                                date ? date.toISOString().split("T")[0] : ""
                              );
                            }}
                            locale="fr"
                            dateFormat="dd/MM/yyyy"
                            showYearDropdown
                            scrollableYearDropdown
                            yearDropdownItemNumber={80}
                            customInput={<Input {...fieldStyles} />}
                          />
                        )}
                      />

                      <FieldError message={errors.dateBirth?.message} />
                    </FormControl>

                    {/* Matricule */}
                    <FormControl isInvalid={!!errors.matricule}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <MdOutlineNumbers color="#F2B705" size="1rem" />

                          <Text>
                            Matricule <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="text"
                        {...register("matricule")}
                      />

                      <FieldError message={errors.matricule?.message} />
                    </FormControl>
                  </SimpleGrid>
                </Box>

                {/* ================= EMPLOI ================= */}
                <Box>
                  <Text {...sectionTitleStyles} mb="7px">
                    Informations professionnelles
                  </Text>

                  <SimpleGrid
                    columns={{
                      base: 1,
                      md: 2,
                      lg: 4,
                    }}
                    spacing="10px"
                  >
                    {/* ID */}
                    <FormControl isInvalid={!!errors.idNum}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <MdOutlineNumbers color="#F2B705" size="1rem" />

                          <Text>
                            N° carte d'identité <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="text"
                        {...register("idNum")}
                      />

                      <FieldError message={errors.idNum?.message} />
                    </FormControl>

                    {/* Poste */}
                    <FormControl isInvalid={!!errors.role}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <MdWork color="#F2B705" size="1rem" />

                          <Text>
                            Poste <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="text"
                        {...register("role")}
                      />

                      <FieldError message={errors.role?.message} />
                    </FormControl>

                    {/* Département */}
                    <FormControl isInvalid={!!errors.department}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <MdFactory color="#F2B705" size="1rem" />

                          <Text>
                            Département <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Select
                        {...fieldStyles}
                        placeholder="Choisir"
                        iconColor="#F2B705"
                        {...register("department")}
                      >
                        <option value="Administration">Administration</option>

                        <option value="Atelier">Atelier</option>

                        <option value="Usine">Usine</option>

                        <option value="Magasin">Magasin</option>

                        <option value="Sentinelle">Sentinelle</option>
                      </Select>

                      <FieldError message={errors.department?.message} />
                    </FormControl>

                    {/* Salaire */}
                    <FormControl isInvalid={!!errors.salary}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <LuCircleDollarSign color="#F2B705" size="1rem" />

                          <Text>
                            Salaire <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="number"
                        step="1"
                        min="1"
                        {...register("salary", {
                          valueAsNumber: true,
                        })}
                      />

                      <FieldError message={errors.salary?.message} />
                    </FormControl>

                    {/* Date engagement */}
                    <FormControl isInvalid={!!errors.dateHired}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <FaCalendarDays color="#F2B705" size="0.95rem" />

                          <Text>
                            Date d'engagement <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Controller
                        control={control}
                        name="dateHired"
                        render={({ field }) => (
                          <DatePicker
                            selected={
                              field.value ? new Date(field.value) : null
                            }
                            onChange={(date: Date | null) => {
                              field.onChange(
                                date ? date.toISOString().split("T")[0] : ""
                              );
                            }}
                            locale="fr"
                            dateFormat="dd/MM/yyyy"
                            showYearDropdown
                            scrollableYearDropdown
                            yearDropdownItemNumber={80}
                            minDate={new Date(1990, 0, 1)}
                            maxDate={new Date()}
                            customInput={<Input {...fieldStyles} />}
                          />
                        )}
                      />

                      <FieldError message={errors.dateHired?.message} />
                    </FormControl>
                  </SimpleGrid>
                </Box>

                {/* ================= CONTACT ================= */}
                <Box>
                  <Text {...sectionTitleStyles} mb="7px">
                    Coordonnées
                  </Text>

                  <SimpleGrid
                    columns={{
                      base: 1,
                      md: 2,
                      lg: 3,
                    }}
                    spacing="10px"
                  >
                    {/* Téléphone */}
                    <FormControl isInvalid={!!errors.telephone}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <GiRotaryPhone color="#F2B705" size="1rem" />

                          <Text>
                            Téléphone <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="text"
                        {...register("telephone")}
                      />

                      <FieldError message={errors.telephone?.message} />
                    </FormControl>

                    {/* Adresse */}
                    <FormControl
                      isInvalid={!!errors.address}
                      gridColumn={{ lg: "span 2" }}
                    >
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <IoHome color="#F2B705" size="1rem" />

                          <Text>
                            Adresse <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="text"
                        {...register("address")}
                      />

                      <FieldError message={errors.address?.message} />
                    </FormControl>
                  </SimpleGrid>
                </Box>

                {/* ================= URGENCE ================= */}
                <Box>
                  <Text {...sectionTitleStyles} mb="7px">
                    Contact d'urgence
                  </Text>

                  <SimpleGrid
                    columns={{
                      base: 1,
                      md: 2,
                      lg: 3,
                    }}
                    spacing="10px"
                  >
                    {/* Nom contact */}
                    <FormControl isInvalid={!!errors.emergencyContact}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <MdPerson2 color="#F2B705" size="1rem" />

                          <Text>
                            Nom du contact <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="text"
                        {...register("emergencyContact")}
                      />

                      <FieldError message={errors.emergencyContact?.message} />
                    </FormControl>

                    {/* Relation */}
                    <FormControl isInvalid={!!errors.relationship}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <GiRelationshipBounds color="#F2B705" size="1rem" />

                          <Text>
                            Relation <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="text"
                        {...register("relationship")}
                      />

                      <FieldError message={errors.relationship?.message} />
                    </FormControl>

                    {/* Téléphone contact */}
                    <FormControl isInvalid={!!errors.contactPhone}>
                      <FormLabel
                        mb="3px"
                        fontSize="0.92rem"
                        fontWeight="600"
                        color="gray.600"
                      >
                        <HStack spacing="5px">
                          <MdOutlineNumbers color="#F2B705" size="1rem" />

                          <Text>
                            Téléphone du contact <Required />
                          </Text>
                        </HStack>
                      </FormLabel>

                      <Input
                        {...fieldStyles}
                        type="text"
                        {...register("contactPhone")}
                      />

                      <FieldError message={errors.contactPhone?.message} />
                    </FormControl>
                  </SimpleGrid>
                </Box>

                {/* ================= SERVER ERROR ================= */}
                {ServerErrorMessage && (
                  <Alert
                    status="error"
                    borderRadius="7px"
                    py="7px"
                    px="12px"
                    fontSize="0.8rem"
                    bg="red.50"
                    border="1px solid"
                    borderColor="red.200"
                    color="red.700"
                  >
                    <AlertIcon />

                    <Text fontWeight="500">{ServerErrorMessage}</Text>
                  </Alert>
                )}
              </VStack>
            </ModalBody>

            {/* ================= FOOTER ================= */}
            <ModalFooter
              bg="gray.50"
              borderTop="1px solid"
              borderColor="gray.200"
              px="24px"
              py="10px"
            >
              <Flex width="100%" justify="flex-end" align="center" gap="9px">
                <Button
                  variant="outline"
                  borderColor="gray.300"
                  color="gray.600"
                  borderRadius="7px"
                  height="36px"
                  px="16px"
                  onClick={handleClose}
                  type="button"
                  isDisabled={isSaving}
                  leftIcon={<RxCrossCircled size="17px" />}
                  _hover={{
                    bg: "gray.100",
                    borderColor: "gray.400",
                    color: "gray.800",
                  }}
                >
                  Annuler
                </Button>

                <Button
                  bg="#F2B705"
                  color="gray.900"
                  borderRadius="7px"
                  height="36px"
                  px="18px"
                  type="submit"
                  isLoading={isSaving}
                  loadingText="Patientez..."
                  spinnerPlacement="start"
                  isDisabled={isSaving}
                  leftIcon={<FaSave />}
                  _hover={{
                    bg: "#DFA800",
                  }}
                  _active={{
                    bg: "#C99600",
                  }}
                >
                  Sauvegarder
                </Button>
              </Flex>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
};

export default AddEmployee;
