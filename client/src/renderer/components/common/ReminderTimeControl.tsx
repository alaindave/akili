import { FormControl, FormLabel, HStack, Input, Box } from "@chakra-ui/react";
import { CiClock2 } from "react-icons/ci";

interface ReminderTimeControlProps {
  value: string;
  onChange: (time: string | Date) => void;
}

const ReminderTimeControl = ({ value, onChange }: ReminderTimeControlProps) => {
  const getTimeValue = (): string => {
    if (!value) {
      return "";
    }

    // Already HH:mm
    const timeMatch = value.match(/^(\d{1,2}):(\d{2})$/);

    if (timeMatch) {
      return `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
    }

    // ISO / Date-compatible string
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;
  };

  const timeValue = getTimeValue();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <FormControl minW={0}>
      <FormLabel fontSize="0.85rem" fontWeight="600" color="#374151" mb={2}>
        Heure du rappel
      </FormLabel>

      <HStack
        h="3rem"
        width="100%"
        spacing={0}
        bg="#F8F9FB"
        border="1px solid"
        borderColor="#D1D9E0"
        borderRadius="9px"
        overflow="hidden"
        transition="all 0.15s ease"
        _focusWithin={{
          borderColor: "#0078D4",
          boxShadow: "0 0 0 1px #0078D4",
          bg: "#FFFFFF",
        }}
        _hover={{
          borderColor: "#0078D4",
        }}
      >
        {/* CLOCK ICON */}
        <Box
          h="100%"
          w="3rem"
          minW="3rem"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="#0078D4"
          bg="#F1F5F9"
          borderRight="1px solid"
          borderColor="#E2E8F0"
        >
          <CiClock2 size={21} />
        </Box>

        {/* TIME INPUT */}
        <Input
          type="time"
          value={timeValue}
          onChange={handleChange}
          h="100%"
          flex={1}
          minW={0}
          border="none"
          borderRadius={0}
          bg="transparent"
          color="#1F2937"
          fontSize="1rem"
          fontWeight="600"
          letterSpacing="0.02em"
          px={3}
          cursor="pointer"
          _focus={{
            border: "none",
            boxShadow: "none",
            outline: "none",
          }}
          sx={{
            "&::-webkit-calendar-picker-indicator": {
              cursor: "pointer",
              opacity: 0.7,
              padding: "4px",
            },
          }}
        />
      </HStack>
    </FormControl>
  );
};

export default ReminderTimeControl;
