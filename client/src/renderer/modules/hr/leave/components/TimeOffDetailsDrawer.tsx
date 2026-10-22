import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  SimpleGrid,
  Spacer,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import useAdminUser from "../../../../../store/auth.store";
import useSyncStore from "../../../../../store/sync.store";
import {
  useTimeOff,
  useUpdateTimeOff,
  useTimeOffMotifs,
} from "../hooks/useTimeOff";

interface Props {
  timeOff: Awaited<ReturnType<typeof window.electron.hr.timeOff.list>>[number];
  photoUrl: string;
  remainingLeave: number;
  isOpen: boolean;
  onClose: () => void;
}

const statuses = {
  PENDING: { label: "En attente d'approbation", color: "yellow" },
  APPROVED: { label: "Approuvé", color: "green" },
  REJECTED: { label: "Refusé", color: "red" },
  CANCELLED: { label: "Annulé", color: "blue" },
};

const payrollTreatmentLabels: Record<string, string> = {
  PAID: "Payé",
  UNPAID: "Non payé",
  PARTIALLY_PAID: "Paie partielle",
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR");
}

function parseNotes(value?: string) {
  // Only split at saved author/date headers, preserving paragraphs within notes.
  return (value ?? "")
    .trim()
    .split(/\r?\n\r?\n(?=[^\r\n]+ — \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\r?\n)/)
    .filter(Boolean)
    .map((entry) => {
      const header = entry.match(
        /^([^\r\n]+) — (\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})\r?\n/
      );
      return {
        author: header?.[1],
        date: header?.[2],
        text: header ? entry.slice(header[0].length) : entry,
      };
    });
}

export default function TimeOffDetailsDrawer({
  timeOff,
  photoUrl,
  remainingLeave,
  isOpen,
  onClose,
}: Props) {
  const user = useAdminUser((store) => store.adminUser);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const { data: savedTimeOff, refetch } = useTimeOff(
    user.companyId,
    timeOff._id
  );
  const { data: motifs = [] } = useTimeOffMotifs(user.companyId);
  const updateTimeOff = useUpdateTimeOff(user.companyId);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();
  const currentTimeOff = savedTimeOff ?? timeOff;
  const notes = parseNotes(currentTimeOff.additionalNotes);
  const motif = motifs.find((item) => item._id === currentTimeOff.motifId);
  const payrollTreatment =
    currentTimeOff.motifSnapshot?.payrollTreatment ?? motif?.payrollTreatment;
  const canAddNotes = user.role === "ADMIN" || user.role === "MANAGER";
  const status = statuses[currentTimeOff.status as keyof typeof statuses];
  const start = Date.parse(currentTimeOff.startDate.slice(0, 10));
  const end = Date.parse(currentTimeOff.endDate.slice(0, 10));
  const days =
    Number.isFinite(start) && Number.isFinite(end)
      ? Math.max(0, Math.round((end - start) / 86400000) + 1)
      : 0;

  useEffect(() => {
    if (isOpen) void refetch();
  }, [isOpen, syncVersion, refetch]);

  const addNote = async () => {
    if (!canAddNotes || !note.trim() || isSaving) return;
    setIsSaving(true);
    try {
      // Read the latest saved notes before appending to preserve existing entries.
      const latest = await window.electron.hr.timeOff.get(
        user.companyId,
        timeOff._id
      );
      if (!latest || latest.isDeleted)
        throw new Error("Cette demande n'est plus disponible.");
      const author =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
      const entry = `${author} — ${new Date().toLocaleDateString(
        "fr-FR"
      )} ${new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })}\n${note.trim()}`;
      await updateTimeOff.mutateAsync({
        _id: timeOff._id,
        updates: {
          additionalNotes: [latest.additionalNotes?.trim(), entry]
            .filter(Boolean)
            .join("\n\n"),
        },
      });
      setNote("");
      toast({
        title: "Note ajoutée",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Impossible d'ajouter la note",
        description:
          error instanceof Error ? error.message : "Veuillez réessayer.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      placement="right"
      size="lg"
      closeOnOverlayClick={!isSaving}
      closeOnEsc={!isSaving}
    >
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton isDisabled={isSaving} />
        <DrawerHeader borderBottomWidth="1px" pr={12}>
          <Text mb={4}>Détails de la demande</Text>
          <HStack spacing={4}>
            <Avatar
              src={photoUrl}
              name={`${timeOff.firstName} ${timeOff.lastName}`}
              size="lg"
            />
            <Box>
              <Text>
                {timeOff.firstName} {timeOff.lastName}
              </Text>
              <Text fontSize="sm" fontWeight="normal" color="gray.500">
                {timeOff.department || "Sans département"}{" "}
                {timeOff.role ? `· ${timeOff.role}` : ""}
              </Text>
              <Badge mt={2} colorScheme={status?.color ?? "gray"}>
                {status?.label ?? currentTimeOff.status}
              </Badge>
            </Box>
            <Spacer />
            <Text
              fontWeight="semibold"
              whiteSpace="pre-wrap"
              overflowWrap="anywhere"
            >
              {currentTimeOff.motifId == null
                ? "Congé"
                : currentTimeOff.motifSnapshot?.label ??
                  motifs.find((motif) => motif._id === currentTimeOff.motifId)
                    ?.label ??
                  "Motif non vérifié"}
            </Text>
          </HStack>
        </DrawerHeader>
        <DrawerBody py={6}>
          <VStack align="stretch" spacing={6}>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
              {[
                ["Date de début", formatDate(currentTimeOff.startDate)],
                ["Date de fin", formatDate(currentTimeOff.endDate)],
                ["Durée", `${days} jour${days !== 1 ? "s" : ""}`],
                ["Demande soumise le", formatDate(currentTimeOff.submittedAt)],
                [
                  "Solde de congé",
                  `${remainingLeave} jour${remainingLeave !== 1 ? "s" : ""}`,
                ],
                [
                  "Traitement de paie",
                  payrollTreatment
                    ? payrollTreatmentLabels[payrollTreatment] ??
                      payrollTreatment
                    : "-",
                ],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Text fontSize="sm" color="gray.500" mb={1}>
                    {label}
                  </Text>
                  <Text fontWeight="medium">{value}</Text>
                </Box>
              ))}
            </SimpleGrid>
            <Divider />
            <Box>
              <Text fontWeight="bold" mb={3}>
                Justification
              </Text>
              <Text
                whiteSpace="pre-wrap"
                overflowWrap="anywhere"
                color={currentTimeOff.notes ? "gray.700" : "gray.500"}
              >
                {currentTimeOff.notes || "Aucun motif renseigné."}
              </Text>
            </Box>
            {notes.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Text fontWeight="bold" mb={3}>
                    Commentaires
                  </Text>
                  <VStack align="stretch" spacing={6}>
                    {notes.map((entry, index) => (
                      <HStack key={index} align="start" spacing={3}>
                        <Avatar
                          size="sm"
                          bg="#f5f5f5"
                          color="#525252"
                          border="1px solid #dedede"
                          name={entry.author}
                        />
                        <Box flex="1" minW={0}>
                          <Flex
                            justify="space-between"
                            gap={2}
                            wrap="wrap"
                            mb={2}
                          >
                            <Text
                              fontSize="sm"
                              fontWeight="600"
                              color="gray.700"
                            >
                              {entry.author || "Utilisateur"}
                            </Text>
                            {entry.date && (
                              <Text fontSize="xs" color="#737373">
                                {entry.date}
                              </Text>
                            )}
                          </Flex>
                          <Text
                            fontSize="sm"
                            lineHeight="1.8"
                            whiteSpace="pre-wrap"
                            overflowWrap="anywhere"
                            color="gray.700"
                          >
                            {entry.text}
                          </Text>
                        </Box>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              </>
            )}
          </VStack>
        </DrawerBody>
        {canAddNotes && (
          <DrawerFooter borderTopWidth="1px">
            <VStack align="stretch" width="100%" spacing={3}>
              <FormControl>
                <FormLabel htmlFor={`time-off-note-${timeOff._id}`}>
                  Ajouter un commentaire
                </FormLabel>
                <Textarea
                  id={`time-off-note-${timeOff._id}`}
                  placeholder="Écrivez votre commentaire..."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  isDisabled={isSaving}
                  maxLength={5000}
                />
              </FormControl>
              <Button
                colorScheme="blue"
                alignSelf="flex-end"
                onClick={addNote}
                isDisabled={!note.trim()}
                isLoading={isSaving}
                loadingText="Enregistrement..."
              >
                Ajouter
              </Button>
            </VStack>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
