import {
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
  firstName: z.string().min(1, { message: errorMessage }),
  lastName: z.string().min(1, { message: errorMessage }),
  matricule: z.string().min(1, { message: errorMessage }),
  idNum: z.string().min(1, { message: errorMessage }),
  dateBirth: z.string().min(1, { message: errorMessage }),
  role: z.string().min(1, { message: errorMessage }),
  department: z.string().min(1, { message: errorMessage }),
  dateHired: z.string().min(1, { message: errorMessage }),
  telephone: z.string().min(1, "Le numéro de téléphone est obligatoire"),
  address: z.string().min(1, { message: errorMessage }),
  emergencyContact: z.string().min(1, { message: errorMessage }),
  relationship: z.string().min(1, { message: errorMessage }),
  contactPhone: z.string().min(1, { message: errorMessage }),
  salary: z.coerce.number({
    required_error: errorMessage,
  }),
});

type EmployeeData = z.infer<typeof schema>;

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
      onClose();
    } catch (error) {
      console.error("An error occured while adding employee: ", error);

      setServerErrorMessage(
        "Une erreur s'est produite. Veuillez contacter ADB Tech."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        colorScheme="blue"
        padding="16px"
        _hover={{
          bg: "blue",
          color: "#e6e6e6",
          transform: "scale(1.05)",
        }}
        onClick={() => {
          setServerErrorMessage("");
          onOpen();
        }}
        isLoading={isSaving}
        loadingText="Patientez..."
        spinnerPlacement="start"
        isDisabled={isSaving}
      >
        <IoPersonAdd fontSize="1.2rem" />

        <Text fontSize="1rem" ml="10px">
          Ajouter un employé
        </Text>
      </Button>

      <Modal size="5xl" isOpen={isOpen} onClose={onClose}>
        <ModalOverlay backdropFilter="auto" backdropBlur="0.5rem" />

        <ModalContent position="relative" top="2.5rem" bg="#08162b">
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader color="#ffffff">
              <HStack>
                <Flex
                  height="55px"
                  width="55px"
                  padding="5px"
                  borderRadius="27px"
                  borderWidth="0.3px"
                  borderColor="#F2B705"
                  justifyContent="center"
                  alignItems="center"
                  position="relative"
                  left="12px"
                >
                  <BsPersonFillAdd color="#F2B705" size="2.3rem" />
                </Flex>

                <VStack position="relative" top="10px" right="18px">
                  <Text position="relative" top="8px" fontSize="1.7rem">
                    Nouveau employé
                  </Text>

                  <Text
                    color="#C7D2FE"
                    fontSize="15px"
                    position="relative"
                    left="2.8rem"
                    bottom="0.3rem"
                  >
                    Ajoutez les informations du nouvel employé
                  </Text>
                </VStack>
              </HStack>
            </ModalHeader>

            <ModalCloseButton color="#ffffff" />

            <ModalBody>
              <FormControl>
                <HStack
                  spacing="12px"
                  marginBottom="10px"
                  alignItems="flex-start"
                >
                  {/* Last name */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdPerson2 color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Nom
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      width="300px"
                      type="text"
                      {...register("lastName")}
                    />

                    {errors.lastName && (
                      <p className="text-danger">{errors.lastName.message}</p>
                    )}
                  </Box>

                  {/* First name */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdPerson2 color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Prenom
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      width="300px"
                      type="text"
                      {...register("firstName")}
                    />

                    {errors.firstName && (
                      <p className="text-danger">{errors.firstName.message}</p>
                    )}
                  </Box>

                  {/* Date of birth */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <IoCalendarNumberSharp color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Date de naissance
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Controller
                      control={control}
                      name="dateBirth"
                      render={({ field }) => (
                        <DatePicker
                          selected={field.value ? new Date(field.value) : null}
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
                          customInput={
                            <Input
                              color="#e6ebfe"
                              width="300px"
                              bg="#08162b"
                              borderColor="#ffffff"
                              borderWidth="1px"
                            />
                          }
                        />
                      )}
                    />

                    {errors.dateBirth && (
                      <p className="text-danger">{errors.dateBirth.message}</p>
                    )}
                  </Box>
                </HStack>

                <HStack spacing="0.8rem" alignItems="flex-start">
                  {/* Matricule */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdOutlineNumbers color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Matricule
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      width="300px"
                      type="text"
                      {...register("matricule")}
                    />

                    {errors.matricule && (
                      <p className="text-danger">{errors.matricule.message}</p>
                    )}
                  </Box>

                  {/* National ID */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdOutlineNumbers color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        No de carte d'identite
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      width="300px"
                      type="text"
                      {...register("idNum")}
                    />

                    {errors.idNum && (
                      <p className="text-danger">{errors.idNum.message}</p>
                    )}
                  </Box>

                  {/* Hire date */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <FaCalendarDays color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Date d'engagement
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Controller
                      control={control}
                      name="dateHired"
                      render={({ field }) => (
                        <DatePicker
                          selected={field.value ? new Date(field.value) : null}
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
                          customInput={
                            <Input
                              color="#e6ebfe"
                              width="300px"
                              bg="#08162b"
                              borderColor="#ffffff"
                              borderWidth="1px"
                            />
                          }
                        />
                      )}
                    />

                    {errors.dateHired && (
                      <p className="text-danger">{errors.dateHired.message}</p>
                    )}
                  </Box>
                </HStack>

                <HStack spacing="0.8rem" alignItems="flex-start">
                  {/* Role */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdWork color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Poste
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      width="300px"
                      type="text"
                      {...register("role")}
                    />

                    {errors.role && (
                      <p className="text-danger">{errors.role.message}</p>
                    )}
                  </Box>

                  {/* Department */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdFactory color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Departement
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Select
                      width="300px"
                      bg="#08162b"
                      color="#e6ebfe"
                      borderColor="#ffffff"
                      focusBorderColor="#F2B705"
                      iconColor="#F2B705"
                      _hover={{
                        borderColor: "#F2B705",
                      }}
                      placeholder="Choisissez un departement"
                      {...register("department")}
                    >
                      <option value="Administration" style={{ color: "black" }}>
                        Administration
                      </option>

                      <option value="Atelier" style={{ color: "black" }}>
                        Atelier
                      </option>

                      <option value="Usine" style={{ color: "black" }}>
                        Usine
                      </option>

                      <option value="Magasin" style={{ color: "black" }}>
                        Magasin
                      </option>

                      <option value="Sentinelle" style={{ color: "black" }}>
                        Sentinelle
                      </option>
                    </Select>

                    {errors.department && (
                      <p className="text-danger">{errors.department.message}</p>
                    )}
                  </Box>

                  {/* Salary */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <LuCircleDollarSign color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Salaire
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      width="300px"
                      type="number"
                      {...register("salary", {
                        valueAsNumber: true,
                      })}
                    />

                    {errors.salary && (
                      <p className="text-danger">{errors.salary.message}</p>
                    )}
                  </Box>
                </HStack>

                <HStack>
                  {/* Telephone */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <GiRotaryPhone color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Telephone
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      width="300px"
                      type="text"
                      {...register("telephone")}
                    />

                    {errors.telephone && (
                      <p className="text-danger">{errors.telephone.message}</p>
                    )}
                  </Box>

                  {/* Address */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <IoHome color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Addresse
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      marginBottom="10px"
                      width="38.5rem"
                      type="text"
                      {...register("address")}
                    />

                    {errors.address && (
                      <p className="text-danger">{errors.address.message}</p>
                    )}
                  </Box>
                </HStack>

                {/* Emergency contact */}
                <HStack
                  spacing="0.8rem"
                  marginBottom="0.7rem"
                  alignItems="flex-start"
                >
                  {/* Emergency contact name */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdPerson2 color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Nom du contact d'urgence
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      width="300px"
                      type="text"
                      {...register("emergencyContact")}
                    />

                    {errors.emergencyContact && (
                      <p className="text-danger">
                        {errors.emergencyContact.message}
                      </p>
                    )}
                  </Box>

                  {/* Relationship */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <GiRelationshipBounds color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Relation avec l'employé
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      width="300px"
                      type="text"
                      {...register("relationship")}
                    />

                    {errors.relationship && (
                      <p className="text-danger">
                        {errors.relationship.message}
                      </p>
                    )}
                  </Box>

                  {/* Contact phone */}
                  <Box>
                    <HStack>
                      <Box marginBottom="10px">
                        <MdOutlineNumbers color="#F2B705" size="1.3rem" />
                      </Box>

                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Telephone du contact
                        <span
                          style={{
                            color: "#F2B705",
                            fontSize: "1rem",
                          }}
                        >
                          *
                        </span>
                      </FormLabel>
                    </HStack>

                    <Input
                      color="#e6ebfe"
                      width="300px"
                      type="text"
                      {...register("contactPhone")}
                    />

                    {errors.contactPhone && (
                      <p className="text-danger">
                        {errors.contactPhone.message}
                      </p>
                    )}
                  </Box>
                </HStack>
              </FormControl>
            </ModalBody>

            <ModalFooter bg="#08162b">
              <HStack position="relative" right="2rem">
                <Text
                  position="relative"
                  top="0.6rem"
                  right="2rem"
                  fontSize="1.1rem"
                  fontWeight="600"
                  color="red.300"
                >
                  {ServerErrorMessage}
                </Text>

                <Button
                  borderRadius="10px"
                  borderColor="black"
                  bg="#F2B705"
                  borderWidth="0.5px"
                  color="black"
                  mr={3}
                  type="submit"
                  isLoading={isSaving}
                  loadingText="Patientez..."
                  spinnerPlacement="start"
                  isDisabled={isSaving}
                >
                  <HStack>
                    <Box>
                      <FaSave />
                    </Box>

                    <Text fontSize="1rem">Sauvegarder</Text>
                  </HStack>
                </Button>

                <Button
                  borderColor="#ffffff"
                  borderRadius="10px"
                  bg="#08162b"
                  borderWidth="0.5px"
                  color="#1a000d"
                  mr={3}
                  onClick={onClose}
                  type="button"
                  isDisabled={isSaving}
                >
                  <HStack>
                    <Box>
                      <RxCrossCircled color="#ffffff" size="18px" />
                    </Box>

                    <Text color="#ffffff" position="relative" fontSize="1rem">
                      Annuler
                    </Text>
                  </HStack>
                </Button>
              </HStack>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
};

export default AddEmployee;
