import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Stack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { PayrollSettings } from "../../../../../common/types/payroll/Payroll";
import useAdminUser from "../../../../../store/auth.store";

export default function PayrollDefaults() {
  const user = useAdminUser((store) => store.adminUser);
  const toast = useToast();
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [currency, setCurrency] = useState("FBU");
  const [paymentDay, setPaymentDay] = useState("30");
  const [workingDays, setWorkingDays] = useState("25");
  const [workingHours, setWorkingHours] = useState("8");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPayrollSettings();
  }, []);

  const loadPayrollSettings = async () => {
    try {
      setLoading(true);
      const result = await window.electron.hr.payrollSettings.get(user.companyId);
      if (result) {
        setSettings(result);
        setCurrency(result.currency);
        setPaymentDay(String(result.paymentDay));
        setWorkingDays(String(result.workingDays));
        setWorkingHours(String(result.workingHours));
      }
    } catch (error) {
      console.error("FAILED TO LOAD PAYROLL SETTINGS:", error);

      toast({
        title: "Erreur",
        description: "Impossible de charger les paramètres de paie.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!paymentDay.trim()) {
      toast({
        title: "Jour de paie requis",
        description: "Veuillez saisir le jour de paie.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    if (!workingDays.trim()) {
      toast({
        title: "Jours ouvrables requis",
        description: "Veuillez saisir le nombre de jours ouvrables.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    if (!workingHours.trim()) {
      toast({
        title: "Heures de travail requises",
        description: "Veuillez saisir le nombre d'heures de travail.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    const paymentDayNumber = Number(paymentDay);
    const workingDaysNumber = Number(workingDays);
    const workingHoursNumber = Number(workingHours);

    if (
      !Number.isInteger(paymentDayNumber) ||
      paymentDayNumber < 1 ||
      paymentDayNumber > 31
    ) {
      toast({
        title: "Jour de paie invalide",
        description: "Le jour de paie doit être compris entre 1 et 31.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    if (
      !Number.isInteger(workingDaysNumber) ||
      workingDaysNumber < 1 ||
      workingDaysNumber > 31
    ) {
      toast({
        title: "Jours ouvrables invalides",
        description:
          "Le nombre de jours ouvrables doit être compris entre 1 et 31.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    if (
      !Number.isInteger(workingHoursNumber) ||
      workingHoursNumber < 1 ||
      workingHoursNumber > 24
    ) {
      toast({
        title: "Heures de travail invalides",
        description:
          "Le nombre d'heures de travail doit être compris entre 1 et 24.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    try {
      setSaving(true);

      if (!settings) {
        const created = await window.electron.hr.payrollSettings.create(
          user.companyId,
          {
            currency,
            paymentDay: paymentDayNumber,
            workingDays: workingDaysNumber,
            workingHours: workingHoursNumber,
          }
        );

        setSettings(created);
        setCurrency(created.currency);
        setPaymentDay(String(created.paymentDay));
        setWorkingDays(String(created.workingDays));
        setWorkingHours(String(created.workingHours));

        toast({
          title: "Paramètres enregistrés",
          description: "Les paramètres de paie ont été créés.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });

        return;
      }

      const updated = await window.electron.hr.payrollSettings.updateFields(
        user.companyId,
        settings._id,
        {
          currency,
          paymentDay: paymentDayNumber,
          workingDays: workingDaysNumber,
          workingHours: workingHoursNumber,
        }
      );

      setSettings(updated);

      // Refresh form from the saved database result.
      setCurrency(updated.currency);
      setPaymentDay(String(updated.paymentDay));
      setWorkingDays(String(updated.workingDays));
      setWorkingHours(String(updated.workingHours));

      toast({
        title: "Paramètres enregistrés",
        description: "Les paramètres de paie ont été mis à jour.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("FAILED TO SAVE PAYROLL SETTINGS:", error);

      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les paramètres de paie.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack ml="5rem" spacing={5}>
      <FormControl>
        <FormLabel>Monnaie</FormLabel>
        <Select
          width="150px"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          isDisabled={loading || saving}
        >
          <option value="FBU">FBU</option>
          <option value="RWF">RWF</option>
          <option value="KSH">KSH</option>
          <option value="$"> $</option>
          <option value="€">€</option>
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Jour de paie</FormLabel>

        <Input
          width="150px"
          type="number"
          min={1}
          max={31}
          value={paymentDay}
          onChange={(e) => setPaymentDay(e.target.value)}
          isDisabled={loading || saving}
        />
      </FormControl>

      <FormControl>
        <FormLabel>Jours ouvrables par mois</FormLabel>

        <Input
          width="150px"
          type="number"
          min={1}
          max={31}
          value={workingDays}
          onChange={(e) => setWorkingDays(e.target.value)}
          isDisabled={loading || saving}
        />
      </FormControl>

      <FormControl>
        <FormLabel>Heures de travail par jour</FormLabel>

        <Input
          width="150px"
          type="number"
          min={1}
          max={24}
          value={workingHours}
          onChange={(e) => setWorkingHours(e.target.value)}
          isDisabled={loading || saving}
        />
      </FormControl>

      <Button
        width="180px"
        onClick={save}
        colorScheme="blue"
        isLoading={saving}
        isDisabled={loading}
      >
        Enregistrer
      </Button>
    </Stack>
  );
}
