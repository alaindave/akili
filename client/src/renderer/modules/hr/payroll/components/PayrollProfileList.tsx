import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Input,
  Select,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaDeleteLeft } from "react-icons/fa6";

import AddPayrollEmployeeProfileModal from "./PayrollEmployeeProfileAddModal";
import PayrollEmployeeProfile from "../../../../../common/types/payroll/PayrollEmployeeProfile";
import useAdminUser from "../../../../../store/auth.store";

interface Props {
  type: "EARNING" | "DEDUCTION";
  employeeID: string;
  showTaxable: boolean;
}

export default function PayrollEmployeeProfileList({
  type,
  employeeID,
  showTaxable,
}: Props) {
  const user = useAdminUser((store) => store.adminUser);
  const toast = useToast();
  const [profiles, setProfiles] = useState<PayrollEmployeeProfile[]>([]);
  const [originalProfiles, setOriginalProfiles] = useState<
    PayrollEmployeeProfile[]
  >([]);

  useEffect(() => {
    loadProfiles();
  }, [type, employeeID]);

  const loadProfiles = async () => {
    try {
      const data = await window.electron.hr.payrollProfile.getAll(
        user.companyId,
        employeeID,
        type
      );

      console.log("FETCHED PAYROLL PROFILES", data);

      setProfiles(structuredClone(data));
      setOriginalProfiles(structuredClone(data));
    } catch (error) {
      console.error(error);
    }
  };

  const updateProfile = (
    _id: string,
    changes: Partial<PayrollEmployeeProfile>
  ) => {
    setProfiles((prev) =>
      prev.map((profile) =>
        profile._id === _id
          ? {
              ...profile,
              ...changes,
            }
          : profile
      )
    );
  };

  // Toggle enabled
  const toggleProfile = (_id: string) => {
    setProfiles((prev) =>
      prev.map((item) =>
        item._id === _id
          ? {
              ...item,
              enabled: item.enabled === 1 ? 0 : 1,
            }
          : item
      )
    );
  };

  // Toggle taxable / imposable
  const toggleTaxable = (_id: string) => {
    setProfiles((prev) =>
      prev.map((item) =>
        item._id === _id
          ? {
              ...item,
              taxable: item.taxable === 1 ? 0 : 1,
            }
          : item
      )
    );
  };

  const save = async () => {
    try {
      const modifiedProfiles = profiles.filter((profile) => {
        const original = originalProfiles.find((o) => o._id === profile._id);

        if (!original) return true;

        return (
          original.displayName !== profile.displayName ||
          original.enabled !== profile.enabled ||
          original.taxable !== profile.taxable ||
          original.calculationType !== profile.calculationType ||
          original.value !== profile.value
        );
      });

      if (modifiedProfiles.length === 0) {
        toast({
          title: "Aucune modification.",
          status: "info",
          duration: 3000,
          isClosable: true,
        });

        return;
      }

      await window.electron.hr.payrollProfile.updateMany(
        user.companyId,
        modifiedProfiles
      );

      toast({
        title: "Paramètres sauvegardés.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      await loadProfiles();
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE SAVING CHANGES", error);

      toast({
        title: "Erreur lors de la sauvegarde.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDelete = async (_id: string) => {
    try {
      await window.electron.hr.payrollProfile.delete(user.companyId, _id);

      toast({
        title: "Élément supprimé.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      await loadProfiles();
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE DELETING COMPONENT:", error);

      toast({
        title: "Erreur lors de la suppression.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const reset = async () => {
    try {
      await window.electron.hr.payrollProfile.resetToDefaults(
        user.companyId,
        employeeID
      );

      toast({
        title: "Profil réinitialisé.",
        description:
          "Les paramètres de paie ont été réinitialisés aux valeurs par défaut.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      await loadProfiles();
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE RESETTING COMPONENTS:", error);

      toast({
        title: "Erreur lors de la réinitialisation.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={4}>
        <Box>
          <Text fontWeight="bold" fontSize="xl">
            {type === "EARNING" ? "Rémunérations" : "Déductions"}
          </Text>

          <Text fontSize="sm" color="gray.500">
            Configuration individuelle des éléments de paie
          </Text>
        </Box>

        <Flex gap={3}>
          <AddPayrollEmployeeProfileModal
            employeeID={employeeID}
            type={type}
            onCreated={loadProfiles}
          />

          <Button colorScheme="yellow" onClick={save}>
            Enregistrer
          </Button>

          <Button colorScheme="green" onClick={reset}>
            Réinitialiser
          </Button>
        </Flex>
      </Flex>

      {/* Table */}
      <TableContainer
        height="100%"
        overflowY="auto"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
      >
        <Table variant="simple" size="sm">
          <Thead
            position="sticky"
            top={0}
            zIndex={1}
            bg={type === "EARNING" ? "purple.50" : "red.50"}
          >
            <Tr>
              <Th width="70px">Actif</Th>

              <Th>Élément</Th>

              <Th width="200px">Type de calcul</Th>

              <Th width="160px">Valeur</Th>

              {/* Taxable */}
              {showTaxable ? (
                <Th width="120px" textAlign="center">
                  Imposable
                </Th>
              ) : null}

              <Th width="120px">Statut</Th>

              <Th width="70px">Action</Th>
            </Tr>
          </Thead>

          <Tbody>
            {profiles.map((item) => (
              <Tr
                key={item._id}
                _hover={{
                  bg: "gray.50",
                }}
              >
                {/* Enabled */}
                <Td>
                  <Checkbox
                    isChecked={item.enabled === 1}
                    onChange={() => toggleProfile(item._id!)}
                    colorScheme="green"
                  />
                </Td>

                {/* Display name */}
                <Td>
                  <Input
                    value={item.displayName}
                    width="13rem"
                    fontWeight="600"
                    variant="flushed"
                    onChange={(e) =>
                      updateProfile(item._id!, {
                        displayName: e.target.value,
                      })
                    }
                  />
                </Td>

                {/* Calculation type */}
                <Td>
                  <Select
                    size="md"
                    value={item.calculationType}
                    onChange={(e) => {
                      const calculationType = e.target
                        .value as PayrollEmployeeProfile["calculationType"];

                      updateProfile(item._id!, {
                        calculationType,
                        value: calculationType === "MANUEL" ? null : item.value,
                      });
                    }}
                  >
                    <option value="FIXE">Montant fixe</option>
                    <option value="MANUEL">Manuel</option>
                    <option value="FORMULE_IPR">Formule-IPR-OBR</option>
                    <option value="FORMULE_ABSENCE">Formule-ABSENCE</option>
                    <option value="FORMULE_RETARD">Formule-RETARD</option>
                    <option value="POURCENTAGE_BASE">%-sal.base.</option>
                    <option value="POURCENTAGE_BRUT">%-sal.brut.</option>
                    <option value="POURCENTAGE_IMPOSABLE">%-sal.imp.</option>
                  </Select>
                </Td>

                {/* Value */}
                <Td>
                  {item.calculationType !== "FORMULE_IPR" &&
                  item.calculationType !== "FORMULE_ABSENCE" &&
                  item.calculationType !== "FORMULE_RETARD" ? (
                    <Input
                      size="sm"
                      type="number"
                      value={item.value ?? ""}
                      onChange={(e) =>
                        updateProfile(item._id!, {
                          value:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <Text>-- -- --</Text>
                  )}
                </Td>

                {/* Taxable / Imposable */}
                {showTaxable ? (
                  <Td textAlign="center">
                    <Checkbox
                      isChecked={item.taxable === 1}
                      onChange={() => toggleTaxable(item._id!)}
                      colorScheme="purple"
                    />
                  </Td>
                ) : null}

                {/* Status */}
                <Td>
                  <Badge
                    colorScheme={item.enabled ? "green" : "gray"}
                    borderRadius="full"
                    px={2}
                    py={1}
                  >
                    {item.enabled ? "Activé" : "Désactivé"}
                  </Badge>
                </Td>

                {/* Delete */}
                <Td>
                  <Button
                    variant="ghost"
                    size="sm"
                    colorScheme="red"
                    onClick={() => handleDelete(item._id!)}
                    aria-label="Supprimer"
                  >
                    <FaDeleteLeft />
                  </Button>
                </Td>
              </Tr>
            ))}

            {profiles.length === 0 && (
              <Tr>
                <Td colSpan={7} textAlign="center" py={10}>
                  <Text color="gray.500">
                    Aucun élément de paie configuré pour cet employé.
                  </Text>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
}
