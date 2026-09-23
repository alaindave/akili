import { Badge, Box, Button, FormControl, FormLabel, Heading, HStack, Input, Text, VStack, useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useAdminUser from "../../../../store/auth.store";
import type { AttendanceDailyCheck } from "../../../../common/types/attendance/AttendanceDailyCheck";

export default function AttendanceSettingsPage() {
  const user = useAdminUser((store) => store.adminUser);
  const toast = useToast();
  const [time, setTime] = useState("08:00");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [check, setCheck] = useState<AttendanceDailyCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLoaded, setTimeLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";
  const api = window.electron.hr.attendanceDailyCheck;
  const showError = (error: unknown) => toast({ title: "Opération impossible", description: error instanceof Error ? error.message : "Veuillez réessayer.", status: "error", duration: 5000, isClosable: true });
  useEffect(() => {
    let active = true;
    setTimeLoaded(false);
    api.getClockIn(user.companyId).then((value) => { if (active) { setTime(value); setTimeLoaded(true); } }).catch(showError);
    return () => { active = false; };
  }, [user.companyId]);
  useEffect(() => {
    let active = true;
    setCheck(null);
    if (!date) { setLoading(false); return; }
    setLoading(true);
    api.getByDate(user.companyId, date).then((value) => { if (active) setCheck(value); })
      .catch(showError).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.companyId, date]);
  const save = async () => {
    setBusy(true);
    try { await api.saveClockIn(user.companyId, user._id, time); toast({ title: "Heure de pointage enregistrée", status: "success" }); }
    catch (error) { showError(error); } finally { setBusy(false); }
  };
  const reopen = async () => {
    setBusy(true);
    try { setCheck(await api.reopen(user.companyId, date, user._id)); toast({ title: "Contrôle rouvert pour correction et vérification", status: "success" }); }
    catch (error) { showError(error); } finally { setBusy(false); }
  };
  return <Box minH="100vh" bg="gray.50" p={{ base: 5, md: 10 }}>
    <Button as={Link} to="/admin/settings" variant="outline" mb={6}>Retour aux paramètres</Button>
    <Heading size="lg" mb={8}>Paramètres de présence</Heading>
    <VStack maxW="750px" align="stretch" spacing={6}>
      <Box bg="white" borderWidth="1px" borderRadius="lg" p={6}>
        <Heading size="md" mb={4}>Heure de pointage</Heading>
        <Text mb={4} color="gray.600">Heure de début utilisée pour calculer les retards lors des nouveaux pointages et des corrections. Paramètre de cette entreprise sur cet ordinateur.</Text>
        <FormControl maxW="220px"><FormLabel>Heure de début</FormLabel><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} isDisabled={!canEdit || busy || !timeLoaded} /></FormControl>
        <Button mt={4} colorScheme="blue" onClick={save} isDisabled={!canEdit || busy || !timeLoaded || !time}>Enregistrer</Button>
      </Box>
      <Box bg="white" borderWidth="1px" borderRadius="lg" p={6}>
        <Heading size="md" mb={4}>Contrôle quotidien des présences</Heading>
        <Text mb={4} color="gray.600">Rouvrir un contrôle validé ou verrouillé conserve les pointages et remet la vérification à zéro.</Text>
        <FormControl maxW="220px"><FormLabel>Date du contrôle</FormLabel><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} isDisabled={busy} /></FormControl>
        <HStack my={4}><Text>Statut :</Text><Badge>{loading ? "Chargement…" : check ? ({ PREPARING: "En préparation", OPEN: "Ouvert", VERIFIED: "Vérifié", MANAGER_NOTIFIED: "Gestionnaire notifié", LOCKED: "Verrouillé" }[check.status]) : "Aucun contrôle"}</Badge></HStack>
        <Button colorScheme="orange" onClick={reopen} isLoading={busy} isDisabled={!canEdit || loading || !check || !["LOCKED", "VERIFIED", "MANAGER_NOTIFIED"].includes(check.status)}>Rouvrir et déverrouiller</Button>
      </Box>
    </VStack>
  </Box>;
}
