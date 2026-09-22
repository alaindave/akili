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
import { Editable, EditableInput, EditablePreview } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaDeleteLeft } from "react-icons/fa6";
import PayrollComponent from "../../../../../common/types/payroll/PayrollComponent";
import AddPayrollComponentModal from "./PayrollComponentAddModal";
import useAdminUser from "../../../../../store/auth.store";

interface Props {
  type: "EARNING" | "DEDUCTION";
  showTaxable: boolean;
}

export default function PayrollComponentList({ type, showTaxable }: Props) {
  const toast = useToast();

  const [components, setComponents] = useState<PayrollComponent[]>([]);
  const [originalComponents, setOriginalComponents] = useState<
    PayrollComponent[]
  >([]);
  const user = useAdminUser((store) => store.adminUser);

  useEffect(() => {
    loadComponents();
  }, [type]);

  const loadComponents = async () => {
    try {
      const data = await window.electron.hr.payrollComponents.getAll(
        user.companyId,
        type
      );

      setComponents(structuredClone(data));
      setOriginalComponents(structuredClone(data));
    } catch (error) {
      console.error(error);
    }
  };

  const toggleComponent = (_id: string) => {
    setComponents((prev) =>
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
    setComponents((prev) =>
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

  const updateComponent = (_id: string, changes: Partial<PayrollComponent>) => {
    setComponents((prev) =>
      prev.map((component) =>
        component._id === _id
          ? {
              ...component,
              ...changes,
            }
          : component
      )
    );
  };

  const save = async () => {
    try {
      const modifiedComponents = components.filter((component) => {
        const original = originalComponents.find(
          (o) => o._id === component._id
        );

        if (!original) return true;

        return (
          original.displayName !== component.displayName ||
          original.displayOrder !== component.displayOrder ||
          original.enabled !== component.enabled ||
          original.taxable !== component.taxable ||
          original.calculationType !== component.calculationType ||
          original.defaultValue !== component.defaultValue
        );
      });

      if (modifiedComponents.length === 0) {
        toast({
          title: "Aucune modification.",
          status: "info",
        });

        return;
      }

      await window.electron.hr.payrollComponents.update(
        user.companyId,
        modifiedComponents
      );

      toast({
        title: "Paramètres sauvegardés.",
        status: "success",
      });

      loadComponents();
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE SAVING CHANGES", error);

      toast({
        title: "Erreur lors de la sauvegarde.",
        status: "error",
      });
    }
  };

  const handleDelete = async (_id: string) => {
    try {
      await window.electron.hr.payrollComponents.delete(user.companyId, _id);
      await loadComponents();
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE DELETING COMPONENT:", error);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Flex ml="2rem" justify="space-between" align="center" mb={4}>
        <Box>
          <Text fontWeight="bold" fontSize="xl">
            {type === "EARNING" ? "Rémunérations" : "Déductions"}
          </Text>

          <Text fontSize="sm" color="gray.500">
            Configurez les éléments de paie
          </Text>
        </Box>

        <Flex gap={3} mr="1rem">
          <AddPayrollComponentModal type={type} onCreated={loadComponents} />

          <Button colorScheme="yellow" onClick={save}>
            Enregistrer
          </Button>
        </Flex>
      </Flex>

      {/* Table */}
      <TableContainer
        height="100%"
        width="78vw"
        ml="1rem"
        mt="1.5rem"
        overflowY="auto"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
      >
        <Table variant="simple" size="sm">
          <Thead position="sticky" top={0} zIndex={1} bg="gray.50">
            <Tr>
              <Th width="70px">Actif</Th>

              <Th width="90px">Ordre</Th>

              <Th>Élément</Th>

              <Th width="190px">Type de calcul</Th>

              <Th width="150px">Valeur</Th>

              {/* Taxable */}
              {showTaxable ? (
                <Th width="120px" textAlign="center">
                  Imposable
                </Th>
              ) : null}

              <Th width="120px">Statut</Th>

              <Th width="60px">Action</Th>
            </Tr>
          </Thead>

          <Tbody>
            {components.map((item) => (
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
                    onChange={() => toggleComponent(item._id)}
                    colorScheme="green"
                  />
                </Td>

                {/* Display order */}
                <Td>
                  <Editable
                    value={String(item.displayOrder)}
                    onChange={(value) => {
                      const displayOrder = Number(value);

                      if (Number.isNaN(displayOrder)) {
                        return;
                      }

                      updateComponent(item._id, {
                        displayOrder,
                      });
                    }}
                  >
                    <EditablePreview
                      px={2}
                      py={1}
                      minW="45px"
                      textAlign="center"
                      borderWidth="1px"
                      borderRadius="md"
                      fontWeight="bold"
                      cursor="pointer"
                      _hover={{
                        bg: "gray.100",
                      }}
                    />

                    <EditableInput
                      type="number"
                      textAlign="center"
                      width="60px"
                      px={2}
                    />
                  </Editable>
                </Td>

                {/* Display name */}
                <Td>
                  <Input
                    value={item.displayName}
                    fontWeight="600"
                    variant="flushed"
                    onChange={(e) =>
                      updateComponent(item._id, {
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
                        .value as PayrollComponent["calculationType"];

                      updateComponent(item._id, {
                        calculationType,
                        defaultValue:
                          calculationType === "MANUEL"
                            ? null
                            : item.defaultValue,
                      });
                    }}
                  >
                    <option value="FIXE">Montant fixe</option>
                    <option value="MANUEL">Manuel</option>
                    <option value="FORMULE_IPR">Formule-IPR-OBR</option>
                    <option value="FORMULE_ABSENCE">Formule-ABSENCE</option>
                    <option value="FORMULE_RETARD">Formule-RETARD</option>
                    <option value="POURCENTAGE_BASE">% - sal.base</option>
                    <option value="POURCENTAGE_BRUT">% - sal.brut</option>
                    <option value="POURCENTAGE_IMPOSABLE">% - sal.impos</option>
                  </Select>
                </Td>

                {/* Default value */}
                <Td>
                  {item.calculationType === "POURCENTAGE_BASE" ||
                  item.calculationType === "POURCENTAGE_BRUT" ||
                  item.calculationType === "POURCENTAGE_IMPOSABLE" ||
                  item.calculationType === "FIXE" ? (
                    <Input
                      size="sm"
                      type="number"
                      value={item.defaultValue ?? ""}
                      onChange={(e) =>
                        updateComponent(item._id, {
                          defaultValue:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <Text ml="0.2rem" color="gray.600" fontSize="sm">
                      -- -- --
                    </Text>
                  )}
                </Td>

                {/* Taxable */}
                {showTaxable ? (
                  <Td textAlign="center">
                    <Checkbox
                      isChecked={item.taxable === 1}
                      onChange={() => toggleTaxable(item._id)}
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
                    onClick={() => handleDelete(item._id)}
                    aria-label="Supprimer"
                  >
                    <FaDeleteLeft />
                  </Button>
                </Td>
              </Tr>
            ))}

            {components.length === 0 && (
              <Tr>
                <Td colSpan={8} textAlign="center" py={10}>
                  <Text color="gray.500">
                    Aucun élément de paie disponible.
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
