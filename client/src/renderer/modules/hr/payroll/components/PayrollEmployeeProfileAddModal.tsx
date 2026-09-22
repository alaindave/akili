import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  NumberInput,
  NumberInputField,
  Select,
  Stack,
  useToast,
  useDisclosure,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { CreatePayrollProfileDto } from "../../../../../common/types/payroll/PayrollEmployeeProfile";
import useAdminUser from "../../../../../store/auth.store";

interface Props {
  type: "EARNING" | "DEDUCTION";
  employeeID: string;
  onCreated?: () => void;
}

export default function AddPayrollEmployeeProfileModal({
  onCreated,
  employeeID,
}: Props) {
  console.log("EMPLOYEE ID TESTING", employeeID);
  const toast = useToast();
  const user = useAdminUser((store) => store.adminUser);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);

  const [calculationType, setCalculationType] = useState<
    | "FIXE"
    | "POURCENTAGE_BASE"
    | "POURCENTAGE_BRUT"
    | "POURCENTAGE_IMPOSABLE"
    | "MANUEL"
  >("MANUEL");
  const [type, setType] = useState<"EARNING" | "DEDUCTION">("EARNING");

  const [defaultValue, setDefaultValue] = useState(0);

  const [_, setEnabled] = useState(true);

  function resetForm() {
    setDisplayName("");
    setCalculationType("FIXE");
    setDefaultValue(0);
    setEnabled(true);
  }

  async function save() {
    if (!displayName.trim()) {
      toast({
        title: "Nom obligatoire",
        status: "warning",
      });

      return;
    }
    setLoading(true);
    try {
      const component: CreatePayrollProfileDto = {
        companyId: user.companyId,
        name: displayName.toUpperCase().replace(/\s+/g, "_"),
        displayName,
        displayOrder,
        type,
        calculationType,
        calculationBase: null,
        value: defaultValue,
      };
      await window.electron.hr.payrollProfile.create(
        user.companyId,
        employeeID,
        component
      );
      toast({
        title: "Composante créée",
        status: "success",
      });
      onCreated?.();
      resetForm();
      onClose();
    } catch (error) {
      console.error(error);
      toast({
        title: "Erreur",
        description: "Impossible de créer le composant.",
        status: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        bg="#4F46E5"
        color="#ffffff"
        _hover={{
          bg: "#4338CA",
          color: "#e6e6e6",
          transform: "scale(1.05)",
        }}
        borderWidth="1px"
        onClick={onOpen}
        isLoading={loading}
        loadingText="Patientez..."
        spinnerPlacement="start"
        isDisabled={loading}
      >
        <Text fontSize="1rem">Ajouter</Text>
      </Button>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay backdropFilter="blur(0.8rem)" />
        <ModalContent>
          <ModalHeader>Ajouter un composant</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Nom</FormLabel>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Prime de transport"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Type de composante</FormLabel>
                <Select
                  value={calculationType}
                  onChange={(e) =>
                    setType(e.target.value as "EARNING" | "DEDUCTION")
                  }
                >
                  <option value="EARNING">Rémunération</option>
                  <option value="DEDUCTION">Deduction</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Type de calcul</FormLabel>
                <Select
                  value={calculationType}
                  onChange={(e) =>
                    setCalculationType(
                      e.target.value as
                        | "FIXE"
                        | "POURCENTAGE_BASE"
                        | "POURCENTAGE_BRUT"
                        | "POURCENTAGE_IMPOSABLE"
                        | "MANUEL"
                    )
                  }
                >
                  <option value="FIXE">Montant fixe</option>
                  <option value="POURCENTAGE">Pourcentage</option>
                  <option value="MANUEL">Manuel</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Valeur par défaut</FormLabel>
                <NumberInput
                  min={0}
                  value={defaultValue}
                  onChange={(_, value) => setDefaultValue(value)}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel>Ordre d'affichage</FormLabel>
                <NumberInput
                  min={0}
                  value={displayOrder}
                  onChange={(_, value) => setDisplayOrder(value)}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button mr={3} variant="ghost" onClick={onClose}>
              Annuler
            </Button>

            <Button colorScheme="yellow" onClick={save} isLoading={loading}>
              Enregistrer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
