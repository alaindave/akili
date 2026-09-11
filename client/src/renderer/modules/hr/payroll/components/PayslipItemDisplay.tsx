import { HStack, Text, Icon as ChakraIcon, Box } from "@chakra-ui/react";
import { IconType } from "react-icons";
import { usePayrollSettings } from "../hooks/payroll_settings.hook";
import { formatCurrency } from "../../../../lib/formatter";

interface Props {
  itemName: string;
  amount: number;
  icon: IconType;
  color: string;
}

const PayslipItemDisplay = ({ itemName, amount, color, icon }: Props) => {
  const payrollSettings = usePayrollSettings();
  const currency = payrollSettings?.currency ?? "BIF";
  const iconBgColor = `${color}.100`;
  const iconColor = `${color}.600`;

  return (
    <HStack height="100px" width="300px" bg="transparent" mt="1rem">
      <Box
        ml="0.5rem"
        height="2.1rem"
        width="2.1rem"
        borderRadius="1.5rem"
        bg={iconBgColor}
      >
        <ChakraIcon
          as={icon}
          color={iconColor}
          fontSize="1.1rem"
          position="relative"
          left="0.5rem"
          top="0.5rem"
        />
      </Box>

      <Box ml="0.2rem">
        <Text fontSize="0.9rem" fontWeight="500">
          {itemName}
        </Text>
        <Text whiteSpace="nowrap" fontSize="1.1rem" fontWeight="600">
          {formatCurrency(amount, currency)}
        </Text>
      </Box>
    </HStack>
  );
};

export default PayslipItemDisplay;
