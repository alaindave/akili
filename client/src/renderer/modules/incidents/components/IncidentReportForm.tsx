import { useState } from "react";
import {
  Alert, AlertIcon, Button, FormControl, FormLabel, Heading, Input,
  Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  SimpleGrid, Stack, Text, Textarea,
} from "@chakra-ui/react";
import type { Incident, IncidentInput } from "../../../../common/types/incident/Incident";

interface Props {
  companyId: string;
  onClose: () => void;
  onSaved: (incident: Incident) => void;
}

export default function IncidentReportForm({ companyId, onClose, onSaved }: Props) {
  const [input, setInput] = useState<IncidentInput>({
    reporterName: "", reporterContact: "", occurredAt: "", location: "",
    notes: "", preventiveActions: "", remedialActions: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = (field: keyof IncidentInput, value: string) => {
    setInput((previous) => ({ ...previous, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (![input.reporterName, input.reporterContact, input.location, input.notes].every((value) => value.trim())) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (!Number.isFinite(new Date(input.occurredAt).getTime())) {
      setError("Veuillez saisir une date et une heure valides.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const incident = await window.electron.incidents.create(companyId, {
        ...input, occurredAt: new Date(input.occurredAt).toISOString(),
      });
      onSaved(incident);
    } catch {
      setError("Impossible d’enregistrer le rapport. Vos données sont conservées, veuillez réessayer.");
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="3xl" closeOnOverlayClick={false} closeOnEsc={!saving} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={submit}>
        <ModalHeader>Rapport d’incident</ModalHeader>
        <ModalBody>
          <Stack spacing={6}>
            <Text fontSize="sm" color="gray.600">Le numéro d’incident est généré automatiquement à l’enregistrement.</Text>
            {error && <Alert status="error"><AlertIcon />{error}</Alert>}
            <Stack as="fieldset" spacing={3} disabled={saving} border="0" p={0} m={0}>
              <Heading as="legend" size="sm">1. Personne déclarant l’incident</Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel htmlFor="reporter-name">Nom complet</FormLabel>
                  <Input id="reporter-name" autoFocus maxLength={200} value={input.reporterName} onChange={(e) => change("reporterName", e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel htmlFor="reporter-contact">Contact (téléphone ou e-mail)</FormLabel>
                  <Input id="reporter-contact" maxLength={300} value={input.reporterContact} onChange={(e) => change("reporterContact", e.target.value)} />
                </FormControl>
              </SimpleGrid>
            </Stack>
            <Stack as="fieldset" spacing={3} disabled={saving} border="0" p={0} m={0}>
              <Heading as="legend" size="sm">2. Détails de l’incident</Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel htmlFor="incident-time">Date et heure</FormLabel>
                  <Input id="incident-time" type="datetime-local" value={input.occurredAt} onChange={(e) => change("occurredAt", e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel htmlFor="incident-location">Lieu</FormLabel>
                  <Input id="incident-location" maxLength={300} value={input.location} onChange={(e) => change("location", e.target.value)} />
                </FormControl>
              </SimpleGrid>
              <FormControl isRequired>
                <FormLabel htmlFor="incident-notes">Notes et description</FormLabel>
                <Textarea id="incident-notes" rows={4} maxLength={10000} value={input.notes} onChange={(e) => change("notes", e.target.value)} />
              </FormControl>
            </Stack>
            <Stack as="fieldset" spacing={3} disabled={saving} border="0" p={0} m={0}>
              <Heading as="legend" size="sm">3. Actions préventives et correctives prises</Heading>
              <Text fontSize="sm" color="gray.600">Laissez vide si aucune action n’a encore été prise.</Text>
              <FormControl>
                <FormLabel htmlFor="incident-preventive">Actions préventives</FormLabel>
                <Textarea id="incident-preventive" rows={3} maxLength={10000} value={input.preventiveActions} onChange={(e) => change("preventiveActions", e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="incident-remedial">Actions correctives</FormLabel>
                <Textarea id="incident-remedial" rows={3} maxLength={10000} value={input.remedialActions} onChange={(e) => change("remedialActions", e.target.value)} />
              </FormControl>
            </Stack>
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button onClick={onClose} isDisabled={saving}>Annuler</Button>
          <Button type="submit" colorScheme="blue" isLoading={saving} loadingText="Enregistrement">Enregistrer le rapport</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
