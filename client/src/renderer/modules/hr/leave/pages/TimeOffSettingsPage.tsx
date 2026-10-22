import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Badge,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  Stack,
  Text,
  useToast,
  Flex,
} from "@chakra-ui/react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { Link } from "react-router-dom";
import {
  PayrollTreatment,
  TimeOffCategory,
} from "../../../../../common/types/hr/time-off/TimeOff";
import type { TimeOffMotif } from "../../../../../common/types/hr/time-off/TimeOff";
import useAdminUser from "../../../../../store/auth.store";
import { useSaveTimeOffMotif, useTimeOffMotifs } from "../hooks/useTimeOff";

const emptyMotif = {
  label: "",
  category: TimeOffCategory.LEAVE,
  payrollTreatment: PayrollTreatment.PAID,
  deductFromLeaveBalance: false,
  requiresApproval: true,
  requiresJustification: false,
  requiresSupportingDocument: false,
};

function createMotifCode(label: string) {
  const code = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^[_-]+/, "")
    .slice(0, 64);

  return code || "MOTIF";
}

type MotifDraft = Pick<
  TimeOffMotif,
  | "label"
  | "category"
  | "payrollTreatment"
  | "deductFromLeaveBalance"
  | "requiresApproval"
  | "requiresJustification"
  | "requiresSupportingDocument"
>;
const categoryLabels: Record<TimeOffCategory, string> = {
  [TimeOffCategory.LEAVE]: "Congé",
  [TimeOffCategory.ABSENCE]: "Absence",
  [TimeOffCategory.EXIT_PERMISSION]: "Billet de sortie",
};
const payrollTreatmentLabels: Record<PayrollTreatment, string> = {
  [PayrollTreatment.PAID]: "Payé",
  [PayrollTreatment.UNPAID]: "Non payé",
  [PayrollTreatment.PARTIALLY_PAID]: "Paie partielle",
};

export default function TimeOffSettingsPage() {
  const user = useAdminUser((store) => store.adminUser);
  const companyId = user.companyId;
  const toast = useToast();
  const client = useQueryClient();
  const { data: motifs = [], isLoading } = useTimeOffMotifs(companyId);
  const saveMotif = useSaveTimeOffMotif(companyId);
  const [motifDraft, setMotifDraft] = useState<MotifDraft>(emptyMotif);
  const canEdit = user.role === "MANAGER";

  async function handleSave() {
    try {
      await saveMotif.mutateAsync({
        _id: crypto.randomUUID(),
        ...motifDraft,
        code: createMotifCode(motifDraft.label),
        isSystemDefault: false,
        isActive: true,
      });
      setMotifDraft(emptyMotif);
      toast({ title: "Motif enregistré", status: "success" });
    } catch (error) {
      toast({
        title: "Opération impossible",
        description:
          error instanceof Error ? error.message : "Veuillez réessayer.",
        status: "error",
        isClosable: true,
      });
    }
  }

  async function deactivate(id: string) {
    try {
      await window.electron.hr.timeOff.motifs.deactivate(companyId, id);
      await client.invalidateQueries({
        queryKey: ["time-off", companyId, "motifs"],
      });
    } catch (error) {
      toast({
        title: "Opération impossible",
        description:
          error instanceof Error ? error.message : "Veuillez réessayer.",
        status: "error",
        isClosable: true,
      });
    }
  }

  return (
    <Box minH="100vh" bg="gray.50" p={{ base: 5, md: 10 }}>
      <HStack mb={6}>
        <Button
          as={Link}
          to="/admin/settings"
          variant="outline"
          aria-label="Retour aux paramètres"
        >
          <FaArrowLeftLong />
        </Button>
        <Box>
          <Heading fontSize="1rem">Paramètres de congés et d’absences</Heading>
          <Text color="gray.600" mt={1}>
            Configurez les motifs, les règles d’approbation et leur traitement
            en paie.
          </Text>
        </Box>
      </HStack>

      <Box bg="white" borderWidth="1px" borderRadius="md" p={4} maxW="1200px">
        <Heading size="sm" mb={3}>
          Motifs de congés et d’absences
        </Heading>
        {canEdit && (
          <>
            <Stack
              direction={{ base: "column", lg: "row" }}
              align="end"
              spacing={3}
            >
              <FormControl>
                <FormLabel>Champ</FormLabel>
                <Input
                  value={motifDraft.label}
                  onChange={(event) =>
                    setMotifDraft({ ...motifDraft, label: event.target.value })
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Catégorie</FormLabel>
                <Select
                  value={motifDraft.category}
                  onChange={(event) =>
                    setMotifDraft({
                      ...motifDraft,
                      category: event.target.value as TimeOffCategory,
                    })
                  }
                >
                  {Object.values(TimeOffCategory).map((value) => (
                    <option key={value} value={value}>
                      {categoryLabels[value]}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Traitement paie</FormLabel>
                <Select
                  value={motifDraft.payrollTreatment}
                  onChange={(event) =>
                    setMotifDraft({
                      ...motifDraft,
                      payrollTreatment: event.target.value as PayrollTreatment,
                    })
                  }
                >
                  {Object.values(PayrollTreatment).map((value) => (
                    <option key={value} value={value}>
                      {payrollTreatmentLabels[value]}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <Button
                onClick={() => void handleSave()}
                isLoading={saveMotif.isPending}
              >
                Créer
              </Button>
            </Stack>
            <HStack mt={3} wrap="wrap">
              <Checkbox
                isChecked={motifDraft.deductFromLeaveBalance}
                onChange={(event) =>
                  setMotifDraft({
                    ...motifDraft,
                    deductFromLeaveBalance: event.target.checked,
                  })
                }
              >
                Déduire du solde congé
              </Checkbox>
              <Checkbox
                isChecked={motifDraft.requiresApproval}
                onChange={(event) =>
                  setMotifDraft({
                    ...motifDraft,
                    requiresApproval: event.target.checked,
                  })
                }
              >
                Approbation requise
              </Checkbox>
              <Checkbox
                isChecked={motifDraft.requiresJustification}
                onChange={(event) =>
                  setMotifDraft({
                    ...motifDraft,
                    requiresJustification: event.target.checked,
                  })
                }
              >
                Justification requise
              </Checkbox>
              <Checkbox
                isChecked={motifDraft.requiresSupportingDocument}
                onChange={(event) =>
                  setMotifDraft({
                    ...motifDraft,
                    requiresSupportingDocument: event.target.checked,
                  })
                }
              >
                Document requis
              </Checkbox>
            </HStack>
          </>
        )}

        <Stack mt={4} spacing={3}>
          {isLoading && <Text color="gray.600">Chargement des motifs…</Text>}
          {motifs.map((motif) => (
            <Flex
              key={motif._id}
              align="center"
              justify="space-between"
              gap={4}
              p={4}
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="md"
              bg="white"
            >
              <Box>
                <Heading size="sm" fontWeight="700">
                  {motif.label}
                </Heading>
                <Text mt={1} color="gray.600">
                  {motif.code}
                </Text>
                <Text mt={1} fontSize="sm" color="gray.700">
                  {payrollTreatmentLabels[motif.payrollTreatment]}
                </Text>
              </Box>
              <Stack align="end" spacing={2}>
                <Badge colorScheme={motif.isActive ? "green" : "gray"}>
                  {motif.isActive ? "Actif" : "Inactif"}
                </Badge>
                {canEdit && motif.isActive && !motif.isSystemDefault && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => void deactivate(motif._id)}
                  >
                    Désactiver
                  </Button>
                )}
              </Stack>
            </Flex>
          ))}
          {!isLoading && motifs.length === 0 && (
            <Text color="gray.600">Aucun motif configuré.</Text>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
