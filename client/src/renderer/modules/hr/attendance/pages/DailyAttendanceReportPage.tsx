import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Text,
  useToast,
} from "@chakra-ui/react";
import DatePicker from "react-datepicker";
import { FaArrowLeftLong } from "react-icons/fa6";
import { fr } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import useAdminUser from "../../../../../store/auth.store";

export default function DailyAttendanceReportPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  const [date, setDate] = useState<Date | null>(() => new Date());
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const download = async () => {
    if (!date || !companyId || saving) return;
    const selectedDay = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setSaving(true);
    try {
      const result = await window.electron.hr.attendance_reports.savePdf(
        companyId,
        selectedDay
      );
      if (!result.canceled)
        toast({ title: "Rapport enregistré", status: "success" });
    } catch {
      toast({ title: "Impossible d'enregistrer le rapport", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box p={{ base: 3, lg: 6 }} bg="#F5F6F8" minH="93vh">
      <Flex width="100%" justify="space-between">
        <HStack>
          <Button
            as={Link}
            to="/employees_admin/reports"
            variant="outline"
            mb={5}
          >
            <FaArrowLeftLong color="black" />
          </Button>
          <Box>
            <Text as="h1" fontSize="1.1rem" fontWeight="bold" color="#03143B">
              Rapport de présence quotidien
            </Text>
            <Text fontSize="1rem" color="gray.600">
              Choisissez une journée pour télécharger le rapport
            </Text>
          </Box>
        </HStack>
        <Button
          colorScheme="yellow"
          onClick={download}
          isLoading={saving}
          isDisabled={!date || !companyId}
        >
          Télécharger
        </Button>
      </Flex>
      <Flex gap={4} align="end" wrap="wrap" my={6}>
        <FormControl maxW="260px">
          <FormLabel htmlFor="attendance-day">Choisir une date</FormLabel>
          <DatePicker
            id="attendance-day"
            selected={date}
            onChange={(selected: Date | null) => setDate(selected)}
            dateFormat="dd-MM-yyyy"
            placeholderText="DD-MM-YYYY"
            locale={fr}
            disabled={saving}
            customInput={<Input bg="white" />}
            strictParsing
          />
        </FormControl>
      </Flex>
      {!date && <Text>Choisissez une date pour télécharger le rapport.</Text>}
    </Box>
  );
}
