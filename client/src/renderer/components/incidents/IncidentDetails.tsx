import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Divider,
  Flex,
  Grid,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { FaArrowLeftLong } from "react-icons/fa6";
import useSyncStore from "../../../store/sync.store";
import { Incident } from "../../../common/types/incident/Incident";

interface Props {
  companyId: string;
  incidentId: string;
}

const labelStyle = {
  fontSize: "xs",
  fontWeight: "600",
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "#737373",
};
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

export default function IncidentDetails({ companyId, incidentId }: Props) {
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;
    setError("");
    if (!companyId || !incidentId) {
      setLoading(false);
      return;
    }
    window.electron.incidents
      .getById(companyId, incidentId)
      .then((result) => {
        if (active && version === requestVersion.current) setIncident(result);
      })
      .catch(() => {
        if (active && version === requestVersion.current)
          setError("Impossible de charger ce rapport.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, incidentId, retry, syncVersion]);

  const addNote = async () => {
    if (!note.trim() || saving || !incident) return;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const result = await window.electron.incidents.addNote(
        companyId,
        incidentId,
        note
      );
      ++requestVersion.current;
      setIncident(result);
      setNote("");
      setSaved(true);
      window.electron.sync
        .sync(companyId)
        .catch((error: Error) =>
          console.error("IMMEDIATE SYNC FAILED:", error)
        );
    } catch {
      setSaveError(
        "Impossible d’ajouter la note. Vérifiez que le total ne dépasse pas 10 000 caractères, puis réessayez."
      );
    } finally {
      setSaving(false);
    }
  };
  const field = (label: string, value: string) => (
    <Box>
      <Text {...labelStyle} mb={2}>
        {label}
      </Text>
      <Text whiteSpace="pre-wrap" overflowWrap="anywhere" lineHeight="1.8">
        {value || "Aucune action renseignée"}
      </Text>
    </Box>
  );

  return (
    <Flex
      direction="column"
      width="100%"
      height="93vh"
      minH={0}
      bg="#f2f2f2"
      color="#171717"
      overflow="hidden"
    >
      <Flex
        as="nav"
        aria-label="Actions du rapport"
        px={{ base: 4, md: 8 }}
        py={4}
        align="center"
        borderBottom="1px solid #dedede"
        flexShrink={0}
      >
        <Button
          as={Link}
          to="/hr/incidents"
          leftIcon={<FaArrowLeftLong />}
          variant="ghost"
          color="#404040"
          size="sm"
          _hover={{ bg: "#e5e5e5" }}
        >
          Tous les incidents
        </Button>
      </Flex>
      <Box
        flex="1"
        minH={0}
        overflowY="auto"
        px={{ base: 3, md: 8 }}
        py={{ base: 5, md: 10 }}
      >
        <Box
          as="article"
          aria-label="Rapport d’incident"
          maxW="900px"
          mx="auto"
          bg="white"
          border="1px solid #dedede"
          boxShadow="0 4px 24px rgba(0, 0, 0, 0.05)"
          px={{ base: 6, md: 12, lg: 16 }}
          py={{ base: 8, md: 14 }}
          sx={{ "@media print": { border: 0, boxShadow: "none", padding: 0 } }}
        >
          {loading ? (
            <Text color="#737373" role="status">
              Chargement du rapport…
            </Text>
          ) : error ? (
            <Stack>
              <Text role="alert">{error}</Text>
              <Button
                variant="outline"
                onClick={() => setRetry((value) => value + 1)}
              >
                Réessayer
              </Button>
            </Stack>
          ) : !incident ? (
            <Text role="status" color="#737373">
              Rapport introuvable.
            </Text>
          ) : (
            <VStack align="stretch" spacing={9}>
              <Box as="header" borderBottom="2px solid #262626" pb={7}>
                <Text fontFamily="mono" fontSize="sm" color="#737373" mb={3}>
                  {incident.incidentNumber}
                </Text>
                <Text
                  as="h1"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontSize={{ base: "2xl", md: "4xl" }}
                  fontWeight="normal"
                  lineHeight="1.25"
                >
                  Rapport d’incident
                </Text>
                <Text fontSize="sm" color="#737373" mt={4}>
                  Enregistré le {formatDate(incident.createdAt)}
                </Text>
              </Box>
              <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={7}>
                {field("Déclarant", incident.reporterName)}
                {field("Contact", incident.reporterContact)}
                {field(
                  "Date et heure de l’incident",
                  formatDate(incident.occurredAt)
                )}
                {field("Lieu", incident.location)}
              </Grid>
              <Divider borderColor="#dedede" />
              <Box as="section">
                <Text as="h2" {...labelStyle} mb={4}>
                  Actions préventives et correctives prises
                </Text>
                <Stack spacing={6}>
                  {field("Actions préventives", incident.preventiveActions)}
                  {field("Actions correctives", incident.remedialActions)}
                </Stack>
              </Box>
              <Divider borderColor="#dedede" />
              <Box as="section">
                <Text as="h2" {...labelStyle} mb={4}>
                  Notes et description
                </Text>
                <Text
                  fontSize="md"
                  lineHeight="1.9"
                  whiteSpace="pre-wrap"
                  overflowWrap="anywhere"
                >
                  {incident.notes}
                </Text>
              </Box>
              <Box
                as="form"
                pt={2}
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  void addNote();
                }}
              >
                <Text
                  as="label"
                  htmlFor="incident-note"
                  display="block"
                  {...labelStyle}
                  mb={3}
                >
                  Ajouter une note
                </Text>
                <Textarea
                  id="incident-note"
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setSaved(false);
                  }}
                  placeholder="Écrivez votre note…"
                  isDisabled={saving}
                  maxLength={Math.max(0, 10000 - incident.notes.length - 2)}
                  resize="vertical"
                  minH="110px"
                  bg="white"
                  borderColor="#d4d4d4"
                  borderRadius="2px"
                  fontSize="sm"
                  lineHeight="1.8"
                  _placeholder={{ color: "#737373" }}
                  _hover={{ borderColor: "#737373" }}
                  focusBorderColor="#404040"
                />
                {incident.notes.length >= 9998 && (
                  <Text fontSize="sm" color="#737373" mt={3}>
                    La limite de 10 000 caractères est atteinte.
                  </Text>
                )}
                {saveError && (
                  <Text role="alert" fontSize="sm" mt={3}>
                    {saveError}
                  </Text>
                )}
                {saved && (
                  <Text role="status" fontSize="sm" color="#525252" mt={3}>
                    Note ajoutée.
                  </Text>
                )}
                <Flex justify="flex-end" mt={3}>
                  <Button
                    type="submit"
                    bg="#262626"
                    color="white"
                    borderRadius="2px"
                    size="sm"
                    px={5}
                    _hover={{ bg: "#404040" }}
                    isLoading={saving}
                    isDisabled={!note.trim()}
                  >
                    Ajouter la note
                  </Button>
                </Flex>
              </Box>
              <Flex
                as="footer"
                borderTop="1px solid #dedede"
                pt={5}
                justify="space-between"
                gap={3}
                color="#737373"
              >
                <Text fontSize="xs">Suivi des incidents</Text>
                <Text fontSize="xs" fontFamily="mono">
                  {incident.incidentNumber}
                </Text>
              </Flex>
            </VStack>
          )}
        </Box>
      </Box>
    </Flex>
  );
}
