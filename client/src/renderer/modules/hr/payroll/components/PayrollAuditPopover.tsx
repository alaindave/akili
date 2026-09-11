import {
  Badge,
  Box,
  Divider,
  HStack,
  Icon,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Text,
  VStack,
} from "@chakra-ui/react";

import {
  CheckCircleIcon,
  TimeIcon,
  WarningIcon,
  CloseIcon,
  ViewIcon,
} from "@chakra-ui/icons";
import { PayrollRun } from "../../../../../common/types/payroll/Payroll";

interface Props {
  payrollRun?: PayrollRun | null;
}

/* =========================================================
   HELPERS
========================================================= */

function formatDate(date?: string | null) {
  if (!date) return "--";

  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(date?: string | null) {
  if (!date) return "--";

  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   AUDIT ITEM
========================================================= */

interface AuditItemProps {
  label: string;
  date?: string | null;
  user?: string | null;
  icon: React.ElementType;
  iconColor: string;
  last?: boolean;
}

function AuditItem({
  label,
  date,
  user,
  icon,
  iconColor,
  last = false,
}: AuditItemProps) {
  if (!date) return null;

  return (
    <HStack align="flex-start" spacing={3} width="100%">
      {/* Timeline */}
      <VStack spacing={0} minWidth="22px" position="relative" align="center">
        <Box
          width="22px"
          height="22px"
          borderRadius="full"
          bg={`${iconColor}.50`}
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={1}
        >
          <Icon as={icon} boxSize={3} color={`${iconColor}.500`} />
        </Box>

        {!last && (
          <Box
            position="absolute"
            top="22px"
            bottom="-16px"
            width="1px"
            bg="gray.200"
          />
        )}
      </VStack>

      {/* Content */}
      <Box flex="1" pb={last ? 0 : 4}>
        <Text fontSize="sm" fontWeight="600" color="gray.700" lineHeight="1.4">
          {label}
        </Text>

        <Text fontSize="xs" color="gray.500" mt={1}>
          {formatDate(date)} à {formatTime(date)}
        </Text>

        {user && (
          <Text fontSize="xs" color="gray.500" mt={0.5}>
            par{" "}
            <Text as="span" fontWeight="600" color="gray.600">
              {user}
            </Text>
          </Text>
        )}
      </Box>
    </HStack>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function PayrollAuditPopover({ payrollRun }: Props) {
  if (!payrollRun) {
    return null;
  }

  const isCancelled = payrollRun.status === "ANNULÉ";

  const isVerification = ["VERIFICATION", "APPROUVÉ", "PAYÉ"].includes(
    payrollRun.status ?? ""
  );

  const isApproved = ["APPROUVÉ", "PAYÉ"].includes(payrollRun.status ?? "");

  const isPaid = payrollRun.status === "PAYÉ";

  const statusColor = {
    BROUILLON: "#e6b800",
    VERIFICATION: "#1a53ff",
    APPROUVÉ: "green",
    PAYÉ: "purple",
    ANNULÉ: "red",
  } as const;

  return (
    <Popover trigger="hover" placement="bottom-end" closeOnBlur isLazy>
      <PopoverTrigger>
        {/* Status badge */}
        <Badge
          position="absolute"
          top="1.5rem"
          right="2rem"
          bg={payrollRun?.status ? statusColor[payrollRun.status] : undefined}
          color="gray.200"
          fontSize="1rem"
          _hover={{ cursor: "pointer" }}
        >
          {payrollRun?.status}
        </Badge>
      </PopoverTrigger>

      <PopoverContent
        width="390px"
        borderColor="gray.200"
        boxShadow="lg"
        borderRadius="md"
      >
        <PopoverArrow />

        <PopoverCloseButton />

        <PopoverHeader border="none" pt={4} pb={2} px={5}>
          <HStack justify="space-between" pr={6}>
            <Box>
              <Text fontSize="md" fontWeight="700" color="gray.700">
                Historique de la paie
              </Text>
            </Box>

            <Badge
              fontSize="10px"
              px={2}
              py={1}
              borderRadius="md"
              colorScheme={
                isCancelled
                  ? "red"
                  : isPaid
                  ? "green"
                  : isApproved
                  ? "blue"
                  : "orange"
              }
            >
              {payrollRun.status}
            </Badge>
          </HStack>
        </PopoverHeader>

        <Divider />

        <PopoverBody px={5} py={5}>
          <VStack align="stretch" spacing={0}>
            {/* CREATED */}
            <AuditItem
              label="Paie créée"
              date={payrollRun.createdAt}
              user={payrollRun.generatedByName}
              icon={TimeIcon}
              iconColor="gray"
              last={!isVerification && !isCancelled}
            />

            {/* CANCELLED */}
            {isCancelled && (
              <AuditItem
                label="Paie annulée"
                date={payrollRun.cancelledAt}
                user={payrollRun.cancelledByName}
                icon={CloseIcon}
                iconColor="red"
                last
              />
            )}

            {/* SUBMITTED FOR VERIFICATION */}
            {isVerification && (
              <AuditItem
                label="Soumise pour vérification"
                date={payrollRun.submittedForVerificationAt}
                user={payrollRun.submittedForVerificationByName}
                icon={WarningIcon}
                iconColor="orange"
                last={!isApproved}
              />
            )}

            {/* APPROVED */}
            {isApproved && (
              <AuditItem
                label="Paie approuvée"
                date={payrollRun.approvedAt}
                user={payrollRun.approvedByName}
                icon={CheckCircleIcon}
                iconColor="blue"
                last={!isPaid}
              />
            )}

            {/* PAID */}
            {isPaid && (
              <AuditItem
                label="Paie payée"
                date={payrollRun.paidAt}
                user={payrollRun.paidByName}
                icon={CheckCircleIcon}
                iconColor="green"
                last
              />
            )}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
