import useSyncStore from "../../../../store/sync.store";
import PageSubtitle from "../../../components/PageSubtitle";
import { useEffect, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
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
import type {
  Incident,
  IncidentFilters,
} from "../../../../common/types/incident/Incident";
import useAdminUser from "../../../../store/auth.store";
import IncidentReportForm from "../components/IncidentReportForm";
import IncidentDetails from "../components/IncidentDetails";

export default function IncidentListPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  // Remount company-specific state when the active company changes.
  return companyId ? (
    <CompanyIncidents key={companyId} companyId={companyId} />
  ) : (
    <Alert status="warning">
      <AlertIcon />
      Connectez-vous à une entreprise pour consulter les incidents.
    </Alert>
  );
}

function CompanyIncidents({ companyId }: { companyId: string }) {
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toast = useToast();
  const invalidDates = Boolean(from && to && from > to);

  useEffect(() => {
    let active = true;
    setIncidents([]);
    setError("");
    if (invalidDates) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      const filters: IncidentFilters = { search, location };
      if (from) filters.from = new Date(`${from}T00:00:00`).toISOString();
      if (to) filters.to = new Date(`${to}T23:59:59.999`).toISOString();
      Promise.all([
        window.electron.incidents.getAll(companyId, filters),
        window.electron.incidents.getLocations(companyId),
      ])
        .then(([reports, places]) => {
          if (active) {
            setIncidents(reports);
            setLocations(places);
          }
        })
        .catch(() => {
          if (active)
            setError(
              "Impossible de charger les incidents. Veuillez réessayer."
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    companyId,
    search,
    location,
    from,
    to,
    refresh,
    invalidDates,
    syncVersion,
  ]);

  return (
    <Box bg="#F8FAFC" minH="100%" p={{ base: 4, md: 6 }} pb={24}>
      <Stack spacing={6}>
        <Flex justify="space-between" align="center" gap={4} wrap="wrap">
          <Box>
            <Heading fontSize="clamp(1.3rem, 1vw + 0.8rem, 1.4rem)">
              Incidents
            </Heading>
            <PageSubtitle>
              Déclarez un incident et consultez les rapports précédents.
            </PageSubtitle>
          </Box>
          <Button colorScheme="blue" onClick={() => setCreating(true)}>
            Déclarer un incident
          </Button>
        </Flex>
        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
          <FormControl>
            <FormLabel htmlFor="incident-search">Rechercher</FormLabel>
            <Input
              id="incident-search"
              bg="white"
              type="search"
              maxLength={300}
              placeholder="Numéro, nom, contact, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel htmlFor="incident-place-filter">Lieu</FormLabel>
            <Select
              id="incident-place-filter"
              bg="white"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="">Tous les lieux</option>
              {locations.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel htmlFor="incident-from">Du</FormLabel>
            <Input
              id="incident-from"
              bg="white"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </FormControl>
          <FormControl isInvalid={invalidDates}>
            <FormLabel htmlFor="incident-to">Au</FormLabel>
            <Input
              id="incident-to"
              bg="white"
              type="date"
              min={from || undefined}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </FormControl>
        </SimpleGrid>
        <Flex gap={3} align="center" wrap="wrap">
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              setSearch("");
              setLocation("");
              setFrom("");
              setTo("");
            }}
          >
            Réinitialiser les filtres
          </Button>
          {!loading && !error && !invalidDates && (
            <Text role="status" fontSize="sm">
              {incidents.length} rapport(s)
            </Text>
          )}
        </Flex>
        {invalidDates ? (
          <Alert status="warning">
            <AlertIcon />
            La date de fin doit suivre la date de début.
          </Alert>
        ) : loading ? (
          <Flex justify="center" p={10}>
            <Spinner aria-label="Chargement des incidents" />
          </Flex>
        ) : error ? (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        ) : incidents.length === 0 ? (
          <Box bg="white" p={10} textAlign="center" borderRadius="lg">
            <Text>Aucun incident trouvé.</Text>
            <Text color="gray.600">
              Modifiez les filtres ou déclarez un nouvel incident.
            </Text>
          </Box>
        ) : (
          <TableContainer bg="white" borderRadius="lg" borderWidth="1px">
            <Table>
              <Thead>
                <Tr>
                  <Th>Numéro</Th>
                  <Th>Date et heure</Th>
                  <Th>Déclarant</Th>
                  <Th>Lieu</Th>
                  <Th>Notes</Th>
                  <Th>Rapport</Th>
                </Tr>
              </Thead>
              <Tbody>
                {incidents.map((incident) => (
                  <Tr
                    key={incident._id}
                    bg={selectedId === incident._id ? "blue.50" : undefined}
                  >
                    <Td fontWeight="600">{incident.incidentNumber}</Td>
                    <Td>
                      {new Date(incident.occurredAt).toLocaleDateString(
                        "fr-FR"
                      )}{" "}
                      {""}
                      {new Date(incident.occurredAt).toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </Td>
                    <Td maxW="220px">
                      <Text isTruncated>{incident.reporterName}</Text>
                    </Td>
                    <Td maxW="220px">
                      <Text isTruncated>{incident.location}</Text>
                    </Td>
                    <Td maxW="280px">
                      <Text isTruncated>{incident.notes}</Text>
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        colorScheme="blue"
                        variant="outline"
                        aria-label={`Consulter le rapport de ${
                          incident.reporterName
                        } du ${new Date(incident.occurredAt).toLocaleString(
                          "fr-FR"
                        )}`}
                        onClick={() => setSelectedId(incident._id)}
                      >
                        Consulter
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        )}
      </Stack>
      {creating && (
        <IncidentReportForm
          companyId={companyId}
          onClose={() => setCreating(false)}
          onSaved={(incident) => {
            setCreating(false);
            setRefresh((value) => value + 1);
            setSelectedId(incident._id);
            toast({
              title: "Rapport d’incident enregistré",
              status: "success",
              duration: 4000,
              isClosable: true,
            });
          }}
        />
      )}
      {selectedId && (
        <IncidentDetails
          key={selectedId}
          companyId={companyId}
          incidentId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </Box>
  );
}
