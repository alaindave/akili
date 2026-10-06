import {
  Badge,
  Box,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { PayrollResult } from "../../../../../common/types/hr/payroll/Payroll";

export default function PayrollResultAuditPopover({
  payroll,
}: {
  payroll: PayrollResult;
}) {
  const events = [
    {
      label: "Vérifié",
      date: payroll.verifiedAt,
      user: payroll.verifiedByName || payroll.verifiedBy,
    },
    {
      label: "Approuvé",
      date: payroll.approvedAt,
      user: payroll.approvedByName || payroll.approvedBy,
    },
    {
      label: "Payé",
      date: payroll.paidAt,
      user: payroll.paidByName || payroll.paidBy,
    },
    {
      label: "Annulé",
      date: payroll.cancelledAt,
      user: payroll.cancelledByName || payroll.cancelledBy,
    },
  ];
  const colors = {
    BROUILLON: "gray",
    VERIFIÉ: "blue",
    APPROUVÉ: "blue",
    PAYÉ: "green",
    ANNULÉ: "red",
  };
  return (
    <Popover trigger="hover" placement="bottom-end" isLazy>
      <PopoverTrigger>
        <Badge
          tabIndex={0}
          cursor="pointer"
          colorScheme={colors[payroll.status]}
          fontSize="inherit"
        >
          {payroll.status}
        </Badge>
      </PopoverTrigger>
      <Portal>
        <PopoverContent color="gray.700" textAlign="left" width="340px">
          <PopoverArrow />
          <PopoverHeader fontWeight="700">
            Historique du bulletin de paie
          </PopoverHeader>
          <PopoverBody>
            <VStack align="stretch" spacing={3}>
              {events.map(({ label, date, user }) => (
                <Box key={label}>
                  <Text fontSize="sm" fontWeight="600">
                    {label}
                  </Text>
                  <Text fontSize="xs">
                    {date ? new Date(date).toLocaleString("fr-FR") : "—"}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    Par : {user || "—"}
                  </Text>
                </Box>
              ))}
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
}
