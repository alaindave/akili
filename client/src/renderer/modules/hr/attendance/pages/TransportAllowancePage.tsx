import {
  Box,
  Button,
  Center,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Select,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCalendar, FiTruck } from "react-icons/fi";
import { MdOutlineChevronRight } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { TransportAllowanceWeeklyReport } from "../../../../../common/types/TransportAllowance";
import useAdminUser from "../../../../../store/auth.store";

function formatDate(date: Date): string {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonday(date: Date): Date {
  const result = new Date(date);

  const day = result.getDay();

  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);

  result.setHours(0, 0, 0, 0);

  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;
}

function formatDisplayDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);

  const end = addDays(start, 4);

  return `${start.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  })} - ${end.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;
}

function generateWeekOptions(numberOfWeeks: number = 52) {
  const options: {
    value: string;
    label: string;
  }[] = [];

  const currentMonday = getMonday(new Date());

  for (let i = 0; i < numberOfWeeks; i++) {
    const monday = addDays(currentMonday, -i * 7);

    const weekStart = formatDate(monday);

    options.push({
      value: weekStart,
      label: `Semaine du ${formatWeekLabel(weekStart)}`,
    });
  }

  return options;
}

export default function TransportAllowancePage() {
  const toast = useToast();

  const navigate = useNavigate();

  const weekOptions = useMemo(() => generateWeekOptions(52), []);

  const [weekStart, setWeekStart] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);

  const user = useAdminUser((store) => store.adminUser);

  const handleBack = () => {
    navigate("/employees_admin/reports");
  };

  const handleGenerateReport = async () => {
    if (!user.companyId) {
      toast({
        title: "Entreprise introuvable",
        description: "Impossible de générer le rapport sans entreprise.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });

      return;
    }

    if (!weekStart) {
      toast({
        title: "Sélectionnez une semaine",
        description: "Veuillez sélectionner une semaine avant de continuer.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    try {
      setIsGenerating(true);

      const report: TransportAllowanceWeeklyReport =
        await window.electron.transportAllowance.createWeeklyReport(
          user.companyId,
          weekStart
        );

      console.log("REPORT GENERATED", report);

      navigate(
        "/employees_admin/reports/transport_allowance/transport_allowance_weekly",
        {
          state: {
            report,
          },
        }
      );
    } catch (error) {
      console.error(
        "Erreur lors de la génération du rapport de transport:",
        error
      );

      toast({
        title: "Impossible de générer le rapport",
        description:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue lors de la génération du rapport.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Flex
      direction="column"
      minH="100vh"
      bg="#F7F8FA"
      px={{
        base: 4,
        md: 6,
        lg: 8,
      }}
      py={{
        base: 6,
        md: 8,
      }}
    >
      <Box maxW="900px">
        {/* Header */}
        <HStack position="relative" bottom="0.5rem" gap={3} mb={8}>
          <Button
            variant="ghost"
            w="40px"
            h="40px"
            minW="40px"
            p={0}
            borderRadius="10px"
            color="#03143B"
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            _hover={{
              bg: "gray.50",
              borderColor: "#F2B705",
            }}
            _active={{
              bg: "gray.100",
            }}
            onClick={handleBack}
            aria-label="Retour aux rapports"
          >
            <Icon as={FiArrowLeft} boxSize={5} />
          </Button>

          <HStack>
            <Heading
              fontSize={{
                base: "1.1rem",
                md: "1.1rem",
              }}
              fontWeight="600"
              color="#03143B"
              letterSpacing="-0.4px"
            >
              Rapports
            </Heading>
            <Box>
              <MdOutlineChevronRight fontSize="1.1rem" />
            </Box>
            <Heading
              fontSize={{
                base: "1.1rem",
                md: "1.1rem",
              }}
              fontWeight="600"
              color="#03143B"
              letterSpacing="-0.4px"
            >
              Frais de déplacement
            </Heading>
          </HStack>
        </HStack>

        {/* Main card */}
        <Box
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="16px"
          boxShadow="0 4px 16px rgba(3, 20, 59, 0.05)"
          overflow="hidden"
          mt="8rem"
          ml="3rem"
        >
          {/* Card header */}
          <Box
            px={{
              base: 5,
              md: 7,
            }}
            py={5}
            bg="gray.50"
            borderBottom="1px solid"
            borderColor="gray.100"
          >
            <Flex align="center" gap={3}>
              <Icon as={FiCalendar} color="#D69E00" boxSize={5} />

              <Box>
                <Heading fontSize="17px" color="#03143B" fontWeight="700">
                  Sélection de la semaine
                </Heading>

                <Text mt={1} fontSize="13px" color="gray.600">
                  Le rapport couvre les jours ouvrables du lundi au vendredi.
                </Text>
              </Box>
            </Flex>
          </Box>

          {/* Form */}
          <Box
            px={{
              base: 5,
              md: 7,
            }}
            py={{
              base: 6,
              md: 8,
            }}
          >
            <FormControl>
              <FormLabel
                fontSize="13px"
                fontWeight="700"
                color="#03143B"
                mb={2}
              >
                Semaine
              </FormLabel>

              <Select
                value={weekStart}
                onChange={(event) => setWeekStart(event.target.value)}
                placeholder="Sélectionner une semaine"
                size="lg"
                borderRadius="10px"
                borderColor="gray.300"
                bg="white"
                color={weekStart ? "#03143B" : "gray.500"}
                _hover={{
                  borderColor: "#F2B705",
                }}
                _focus={{
                  borderColor: "#F2B705",
                  boxShadow: "0 0 0 1px #F2B705",
                }}
              >
                {weekOptions.map((week) => (
                  <option key={week.value} value={week.value}>
                    {week.label}
                  </option>
                ))}
              </Select>
            </FormControl>

            {/* Selected week preview */}
            {weekStart && (
              <Box
                mt={5}
                px={4}
                py={4}
                bg="#FFF9E8"
                border="1px solid"
                borderColor="#F2B705"
                borderRadius="10px"
              >
                <Text fontSize="12px" fontWeight="600" color="gray.600">
                  SEMAINE SÉLECTIONNÉE
                </Text>

                <Text mt={1} fontSize="15px" fontWeight="700" color="#03143B">
                  {formatDisplayDate(weekStart)} →{" "}
                  {formatDisplayDate(
                    formatDate(addDays(new Date(`${weekStart}T00:00:00`), 4))
                  )}
                </Text>
              </Box>
            )}

            {/* Action */}
            <Flex justify="flex-end" mt={7}>
              <Button
                size="md"
                px={6}
                bg="#03143B"
                color="white"
                borderRadius="9px"
                fontWeight="600"
                isDisabled={!weekStart || isGenerating}
                isLoading={isGenerating}
                loadingText="Génération..."
                rightIcon={
                  !isGenerating ? <Icon as={FiArrowRight} /> : undefined
                }
                _hover={{
                  bg: "#081C4F",
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(3, 20, 59, 0.18)",
                }}
                _active={{
                  transform: "translateY(0)",
                }}
                _disabled={{
                  bg: "gray.300",
                  color: "gray.500",
                  cursor: "not-allowed",
                }}
                transition="all 0.15s ease"
                onClick={handleGenerateReport}
              >
                Générer le rapport
              </Button>
            </Flex>
          </Box>
        </Box>
      </Box>
    </Flex>
  );
}
