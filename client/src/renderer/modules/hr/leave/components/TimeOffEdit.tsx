import { TimeOffWithEmployee } from "../../../../../common/types/hr/time-off/TimeOff";
import {
  Box,
  Button,
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
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import DatePicker from "react-datepicker";
import { Controller, useForm } from "react-hook-form";
import { FaSave } from "react-icons/fa";
import { RxCrossCircled } from "react-icons/rx";
import { z } from "zod";
import useAdminUser from "../../../../../store/auth.store";
import { useEffect } from "react";
import { useTimeOffMotifs, useUpdateTimeOff } from "../hooks/useTimeOff";

const errorMessage = "Ce champ est obligatoire";

const schema = z.object({
  startDate: z.string().min(1, { message: errorMessage }),
  endDate: z.string().min(1, { message: errorMessage }),
  motifId: z.string().trim().min(1, { message: errorMessage }),
  notes: z.string().min(1, { message: errorMessage }),
});

type TimeOffData = z.infer<typeof schema>;

interface Props {
  timeOff: TimeOffWithEmployee;
  onUpdated?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const TimeOffEdit = ({ timeOff, onUpdated, isOpen, onClose }: Props) => {
  const user = useAdminUser((store) => store.adminUser);

  const companyId = user?.companyId ?? "";

  const updateTimeOffMutation = useUpdateTimeOff(companyId);
  const { data: motifs = [], isLoading: motifsLoading, isError: motifsError } = useTimeOffMotifs(companyId);
  const activeMotifs = motifs.filter((motif) => motif.isActive);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<TimeOffData>({
    resolver: zodResolver(schema),
    defaultValues: {
      startDate: timeOff?.startDate ?? "",
      endDate: timeOff?.endDate ?? "",
      motifId: timeOff?.motifId ?? "",
      notes: timeOff?.notes ?? "",
    },
  });

  /*
   * Reset the form whenever a different time off request is opened.
   */
  useEffect(() => {
    if (!timeOff) {
      return;
    }

    reset({
      startDate: timeOff.startDate ?? "",
      endDate: timeOff.endDate ?? "",
      motifId: timeOff.motifId,
      notes: timeOff.notes ?? "",
    });

    updateTimeOffMutation.reset();
  }, [timeOff, reset]);

  if (!timeOff) {
    return null;
  }

  const {
    firstName,
    lastName,
    department,
    role,
    startDate,
    endDate,
    motifId,
    notes,
  } = timeOff;

  const onSubmit = (data: TimeOffData) => {
    if (!companyId) {
      console.error("COMPANY ID IS MISSING");
      return;
    }

    if (!timeOff._id) {
      console.error("TIME OFF ID IS MISSING");
      return;
    }

    console.log("INFO TO UPDATE:", data);

    updateTimeOffMutation.mutate(
      {
        _id: timeOff._id,
        updates: data,
      },
      {
        onSuccess: (updatedTimeOff) => {
          console.log("UPDATED TIME OFF:", updatedTimeOff);
          onUpdated?.();
          onClose();
        },
      }
    );
  };

  const handleFormClose = () => {
    if (updateTimeOffMutation.isPending) {
      return;
    }

    reset({
      startDate,
      endDate,
      motifId,
      notes,
    });

    updateTimeOffMutation.reset();

    onClose();
  };

  return (
    <Modal size="5xl" isOpen={isOpen} onClose={handleFormClose}>
      <ModalOverlay backdropFilter="auto" backdropBlur="0.5rem" />

      <ModalContent bg="#08162b">
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader color="#ffffff" position="relative" left="120px">
            <Text
              position="relative"
              left="120px"
              color="#ffffff"
              fontWeight="600"
              fontSize="21px"
            >
              Modification de la demande de congé
            </Text>
          </ModalHeader>

          <ModalCloseButton color="#ffffff" />

          <ModalBody bg="#08162b">
            <FormControl>
              <VStack spacing="10px">
                {/* EMPLOYEE INFORMATION */}
                <HStack>
                  <Box>
                    <HStack>
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
                      type="text"
                      color="#e6ebfe"
                      width="250px"
                      value={lastName || ""}
                      isReadOnly
                    />
                  </Box>

                  <Box>
                    <HStack>
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
                      type="text"
                      color="#e6ebfe"
                      width="250px"
                      value={firstName || ""}
                      isReadOnly
                    />
                  </Box>

                  <Box>
                    <HStack>
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
                      type="text"
                      color="#e6ebfe"
                      width="250px"
                      value={role || ""}
                      isReadOnly
                    />
                  </Box>
                </HStack>

                {/* DEPARTMENT + DATES */}
                <HStack alignItems="flex-start">
                  <Box>
                    <HStack>
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

                    <Input
                      type="text"
                      color="#e6ebfe"
                      width="250px"
                      value={department || ""}
                      isReadOnly
                    />
                  </Box>

                  <Box>
                    <HStack>
                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Date de début de congé
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
                      name="startDate"
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
                          yearDropdownItemNumber={100}
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

                    {errors.startDate && (
                      <Text className="text-danger">
                        {errors.startDate.message}
                      </Text>
                    )}
                  </Box>

                  <Box>
                    <HStack>
                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Date de fin de congé
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
                      name="endDate"
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
                          yearDropdownItemNumber={100}
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

                    {errors.endDate && (
                      <Text className="text-danger">
                        {errors.endDate.message}
                      </Text>
                    )}
                  </Box>
                </HStack>

                {/* MOTIF + NOTES */}
                <VStack>
                  <Box>
                    <HStack>
                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Motif
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
                      name="motifId"
                      render={({ field }) => (
                        <Select
                          {...field}
                          aria-label="Motif"
                          color="#e6ebfe"
                          bg="#08162b"
                          width="350px"
                          placeholder={motifsLoading ? "Chargement des motifs..." : "Sélectionnez un motif"}
                          isDisabled={motifsLoading || motifsError || updateTimeOffMutation.isPending}
                          isInvalid={Boolean(errors.motifId)}
                          sx={{ option: { color: "#e6ebfe", background: "#08162b" } }}
                        >
                          {activeMotifs.map((motif) => (
                            <option key={motif._id} value={motif._id}>
                              {motif.label}
                            </option>
                          ))}
                        </Select>
                      )}
                    />

                    {errors.motifId && (
                      <Text className="text-danger">
                        {errors.motifId.message}
                      </Text>
                    )}
                    {motifsError && <Text color="red.300">Impossible de charger les motifs.</Text>}
                    {!motifsLoading && !motifsError && !activeMotifs.length && (
                      <Text color="gray.400">Aucun motif actif disponible.</Text>
                    )}
                  </Box>

                  <Box>
                    <HStack>
                      <FormLabel color="#C7D2FE" marginBottom="10px">
                        Explications
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

                    <Textarea
                      color="#e6ebfe"
                      height="300px"
                      width="350px"
                      resize="none"
                      placeholder="Decrivez brievement le motif de votre demande..."
                      _placeholder={{
                        opacity: 1,
                        color: "gray.500",
                      }}
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
                {updateTimeOffMutation.isError
                  ? "Une erreur s'est produite. Veuillez contacter ADB Tech."
                  : ""}
              </Text>

              <Button
                borderRadius="10px"
                borderColor="black"
                bg="#F2B705"
                borderWidth="0.5px"
                color="black"
                mr={3}
                type="submit"
                isLoading={updateTimeOffMutation.isPending}
                loadingText="Patientez..."
                spinnerPlacement="start"
                isDisabled={updateTimeOffMutation.isPending}
              >
                <HStack>
                  <Box>
                    <FaSave />
                  </Box>

                  <Text fontSize="1rem">Soumettre</Text>
                </HStack>
              </Button>

              <Button
                borderColor="#ffffff"
                borderRadius="10px"
                bg="#08162b"
                borderWidth="0.5px"
                color="#ffffff"
                mr={3}
                onClick={handleFormClose}
                isDisabled={updateTimeOffMutation.isPending}
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

export default TimeOffEdit;
