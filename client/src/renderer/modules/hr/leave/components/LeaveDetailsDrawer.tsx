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
  FormControl,
  FormLabel,
  HStack,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { LeaveWithEmployee } from "../../../../../common/types/leave/LeaveWithEmployee";
import useAdminUser from "../../../../../store/auth.store";
import useSyncStore from "../../../../../store/sync.store";
import { useLeave, useUpdateLeave } from "../hooks/useLeave";

interface Props {
  leave: LeaveWithEmployee;
  photoUrl: string;
  remainingLeave: number;
  isOpen: boolean;
  onClose: () => void;
}

const statuses = {
  ATTENTE_APPROBATION: { label: "Attente approbation", color: "yellow" },
  APPROUVÉ: { label: "Approuvé", color: "green" },
  REFUSÉ: { label: "Refusé", color: "red" },
  ANNULÉ: { label: "Annulé", color: "gray" },
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR");
}

export default function LeaveDetailsDrawer({
  leave,
  photoUrl,
  remainingLeave,
  isOpen,
  onClose,
}: Props) {
  const user = useAdminUser((store) => store.adminUser);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const { data: savedLeave, refetch } = useLeave(user.companyId, leave._id);
  const updateLeave = useUpdateLeave(user.companyId);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();
  const currentLeave = savedLeave ?? leave;
  const canAddNotes = user.role === "ADMIN" || user.role === "MANAGER";
  const status = statuses[currentLeave.status as keyof typeof statuses];
  const start = Date.parse(currentLeave.startDate.slice(0, 10));
  const end = Date.parse(currentLeave.endDate.slice(0, 10));
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
      const latest = await window.electron.hr.leave.getLeaveById(
        user.companyId,
        leave._id
      );
      if (!latest || latest.isDeleted)
        throw new Error("Cette demande de congé n'est plus disponible.");
      const author =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
      const entry = `${author} — ${new Date().toLocaleDateString(
        "fr-FR"
      )} ${new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })}\n${note.trim()}`;
      await updateLeave.mutateAsync({
        _id: leave._id,
        updates: {
          notes: [latest.notes?.trim(), entry].filter(Boolean).join("\n\n"),
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
          <Text mb={4}>Détails du congé</Text>
          <HStack spacing={4}>
            <Avatar
              src={photoUrl}
              name={`${leave.firstName} ${leave.lastName}`}
              size="lg"
            />
            <Box>
              <Text>
                {leave.firstName} {leave.lastName}
              </Text>
              <Text fontSize="sm" fontWeight="normal" color="gray.500">
                {leave.department || "Sans département"}{" "}
                {leave.role ? `· ${leave.role}` : ""}
              </Text>
              <Badge mt={2} colorScheme={status?.color ?? "gray"}>
                {status?.label ?? currentLeave.status}
              </Badge>
            </Box>
          </HStack>
        </DrawerHeader>
        <DrawerBody py={6}>
          <VStack align="stretch" spacing={6}>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
              {[
                ["Date de début", formatDate(currentLeave.startDate)],
                ["Date de fin", formatDate(currentLeave.endDate)],
                ["Durée", `${days} jour${days !== 1 ? "s" : ""}`],
                [
                  "Solde de congé",
                  `${remainingLeave} jour${remainingLeave !== 1 ? "s" : ""}`,
                ],
                ["Demande soumise le", formatDate(currentLeave.submittedAt)],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Text fontSize="sm" color="gray.500" mb={1}>
                    {label}
                  </Text>
                  <Text fontWeight="medium">{value}</Text>
                </Box>
              ))}
            </SimpleGrid>
            <Box>
              <Text fontSize="sm" color="gray.500" mb={2}>
                Objet
              </Text>
              <Text
                fontWeight="semibold"
                whiteSpace="pre-wrap"
                overflowWrap="anywhere"
              >
                {currentLeave.subject}
              </Text>
            </Box>
            <Divider />
            <Box>
              <Text fontWeight="bold" mb={3}>
                Notes
              </Text>
              <Text
                whiteSpace="pre-wrap"
                overflowWrap="anywhere"
                color={currentLeave.notes ? "gray.700" : "gray.500"}
              >
                {currentLeave.notes || "Aucune note pour le moment."}
              </Text>
            </Box>
          </VStack>
        </DrawerBody>
        {canAddNotes && (
          <DrawerFooter borderTopWidth="1px">
            <VStack align="stretch" width="100%" spacing={3}>
              <FormControl>
                <FormLabel htmlFor={`leave-note-${leave._id}`}>
                  Ajouter une note
                </FormLabel>
                <Textarea
                  id={`leave-note-${leave._id}`}
                  placeholder="Écrivez votre note..."
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
                Ajouter la note
              </Button>
            </VStack>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
