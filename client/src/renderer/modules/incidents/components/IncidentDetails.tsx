import useSyncStore from "../../../../store/sync.store";
import { useEffect, useState } from "react";
import {
  Alert, AlertIcon, Box, Button, Drawer, DrawerBody, DrawerCloseButton,
  DrawerContent, DrawerHeader, DrawerOverlay, Heading, Spinner, Stack, Text,
} from "@chakra-ui/react";
import type { Incident } from "../../../../common/types/incident/Incident";

interface Props { companyId: string; incidentId: string; onClose: () => void }

export default function IncidentDetails({ companyId, incidentId, onClose }: Props) {
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setIncident(null);
    window.electron.incidents.getById(companyId, incidentId).then((result) => {
      if (active) setIncident(result);
    }).catch(() => {
      if (active) setError("Impossible de charger ce rapport.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, incidentId, retry, syncVersion]);

  const field = (label: string, value: string) => (
    <Box><Text fontWeight="600">{label}</Text><Text whiteSpace="pre-wrap" overflowWrap="anywhere">{value || "Aucune action renseignée"}</Text></Box>
  );
  return (
    <Drawer isOpen placement="right" size="lg" onClose={onClose}>
      <DrawerOverlay /><DrawerContent>
        <DrawerCloseButton /><DrawerHeader>Rapport d’incident</DrawerHeader>
        <DrawerBody pb={8}>
          {loading ? <Spinner aria-label="Chargement du rapport" /> : error ? (
            <Stack><Alert status="error"><AlertIcon />{error}</Alert><Button onClick={() => setRetry((value) => value + 1)}>Réessayer</Button></Stack>
          ) : !incident ? <Alert status="info"><AlertIcon />Rapport introuvable.</Alert> : (
            <Stack spacing={6}>
              {field("Numéro d’incident", incident.incidentNumber)}
              <Text fontSize="sm" color="gray.600">Enregistré le {new Date(incident.createdAt).toLocaleString("fr-FR")}</Text>
              <Stack><Heading size="sm">1. Personne déclarant l’incident</Heading>
                {field("Nom complet", incident.reporterName)}{field("Contact", incident.reporterContact)}
              </Stack>
              <Stack><Heading size="sm">2. Détails de l’incident</Heading>
                {field("Date et heure", new Date(incident.occurredAt).toLocaleString("fr-FR"))}
                {field("Lieu", incident.location)}{field("Notes et description", incident.notes)}
              </Stack>
              <Stack><Heading size="sm">3. Actions préventives et correctives prises</Heading>
                {field("Actions préventives", incident.preventiveActions)}{field("Actions correctives", incident.remedialActions)}
              </Stack>
            </Stack>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
