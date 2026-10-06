import {
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
} from "@chakra-ui/react";
import { CiCalendarDate } from "react-icons/ci";

interface ReminderDateControlProps {
  value: Date;
  onChange: (date: Date) => void;
}

const ReminderDateControl = ({ value, onChange }: ReminderDateControlProps) => {
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month, day] = event.target.value.split("-").map(Number);

    if (!year || !month || !day) {
      return;
    }

    const selectedDate = new Date(year, month - 1, day);

    onChange(selectedDate);
  };

  return (
    <FormControl>
      <FormLabel fontSize="0.85rem" fontWeight="600" color="#374151" mb={2}>
        Date du rappel
      </FormLabel>

      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <CiCalendarDate size={21} color="#0078D4" />
        </InputLeftElement>

        <Input
          type="date"
          value={formatDateForInput(value)}
          onChange={handleChange}
          min={formatDateForInput(new Date())}
          h="3rem"
          pl="2.75rem"
          bg="#F8F9FB"
          border="1px solid"
          borderColor="#D1D9E0"
          borderRadius="8px"
          color="#1F2937"
          fontSize="0.95rem"
          fontWeight="500"
          transition="all 0.15s ease"
          _hover={{
            borderColor: "#0078D4",
          }}
          _focus={{
            borderColor: "#0078D4",
            boxShadow: "0 0 0 1px #0078D4",
            bg: "#FFFFFF",
          }}
        />
      </InputGroup>
    </FormControl>
  );
};

export default ReminderDateControl;
