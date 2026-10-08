import { useEffect, useRef, useState } from "react";
import { Box, Button, Flex, Text, Textarea, useDisclosure } from "@chakra-ui/react";
import { FaBell } from "react-icons/fa";
import useAdminUser from "../../../../store/auth.store";
import ReminderModal from "../../../components/common/ReminderModal";

export default function InventoryDashboardNotes({ companyId, userId }: { companyId: string; userId: string }) {
  const [notes, setNotes] = useState(() => useAdminUser.getState().adminUser.notes ?? "");
  const [error, setError] = useState(false);
  const reminder = useDisclosure();
  const latest = useRef(notes);
  const saved = useRef(notes);
  const queue = useRef(Promise.resolve());
  const mounted = useRef(true);

  // Serialize writes so an older request cannot overwrite the latest edit.
  const persist = useRef(() => Promise.resolve());
  persist.current = () => {
    const value = latest.current;
    queue.current = queue.current.then(async () => {
      if (value === saved.current) return;
      try {
        await window.electron.auth.offlineUsers.saveNotes(companyId, userId, value);
        saved.current = value;
        const store = useAdminUser.getState();
        if (store.adminUser.companyId === companyId && store.adminUser._id === userId) store.saveNotes(value);
        if (mounted.current) setError(false);
      } catch {
        if (mounted.current) setError(true);
      }
    });
    return queue.current;
  };

  useEffect(() => {
    const timer = setTimeout(() => { void persist.current(); }, 1000);
    return () => clearTimeout(timer);
  }, [notes]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void persist.current();
    };
  }, []);

  return (
    <Box border="1px solid rgba(255,255,255,0.12)" boxShadow="0 2px 8px rgba(0,0,0,0.2)"
      borderRadius="5px" bg="#F8FAFC" p={5} display="flex" flexDir="column" minH="18rem" minW={0}>
      <Flex align="center" justify="space-between" gap={2} mb={3}>
        <Text as="h2" color="#1F2937" fontSize="1.3rem" fontWeight="600">Notes</Text>
        <Button colorScheme="blue" leftIcon={<FaBell />} onClick={reminder.onOpen} isDisabled={!notes.trim()}>Rappel</Button>
      </Flex>
      <Textarea aria-label="Notes personnelles" placeholder={"Bienvenue sur LeatherWorks.\nÉcrivez vos notes ici..."}
        value={notes} onChange={event => { latest.current = event.target.value; setNotes(event.target.value); }}
        onBlur={() => { void persist.current(); }}
        bg="#091735" border="1px solid rgba(255,255,255,0.1)"
        _hover={{ borderColor: "yellow.300" }}
        _focus={{ borderColor: "yellow.400", boxShadow: "0 0 0 1px #F4C20D" }}
        flex="1" minH="10rem" resize="none" color="white" fontSize={{ base: "1rem", md: "1.1rem" }}
        fontWeight="500" fontFamily="body" _placeholder={{ color: "#6B7280" }} />
      {error && <Flex mt={2} gap={2} align="center"><Text role="alert" color="red.600" fontSize="sm">Impossible d’enregistrer les notes.</Text><Button size="xs" onClick={() => { void persist.current(); }}>Réessayer</Button></Flex>}
      <ReminderModal isReminderOpen={reminder.isOpen} onReminderClose={reminder.onClose} notes={notes} />
    </Box>
  );
}
