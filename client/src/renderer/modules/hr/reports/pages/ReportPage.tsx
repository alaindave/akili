import PageSubtitle from "../../../../components/PageSubtitle";
import { Box, Flex, Grid, Text, VStack } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";

const BLUE = "#03143B";
const GOLD = "#F2B705";

interface ReportSectionProps {
  title: string;
  children: ReactNode;
  onClick?: () => void;
}

interface ReportItemProps {
  title: string;
  description: string;
  onClick?: () => void;
}

function ReportSection({ title, children, onClick }: ReportSectionProps) {
  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="12px"
      overflow="hidden"
      cursor={onClick ? "pointer" : "default"}
      transition="all 0.2s ease"
      onClick={onClick}
      _hover={
        onClick
          ? {
              borderColor: GOLD,
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.06)",
              transform: "translateY(-1px)",
            }
          : undefined
      }
    >
      <Flex
        align="center"
        gap={3}
        px={5}
        py={4}
        borderBottom="1px solid"
        borderColor="gray.100"
      >
        <Box>
          <Text fontSize="16px" fontWeight="800" color={BLUE}>
            {title}
          </Text>

          {onClick && (
            <Text fontSize="11px" color="gray.500" mt={0.5}>
              Cliquer pour ouvrir
            </Text>
          )}
        </Box>
      </Flex>

      <Box p={5}>{children}</Box>
    </Box>
  );
}

function ReportItem({ title, description, onClick }: ReportItemProps) {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap={4}
      p={4}
      border="1px solid"
      borderColor="gray.100"
      borderRadius="9px"
      cursor={onClick ? "pointer" : "default"}
      transition="all 0.15s ease"
      onClick={onClick}
      _hover={
        onClick
          ? {
              bg: "gray.50",
              borderColor: "gray.200",
            }
          : undefined
      }
    >
      <Box>
        <Text fontSize="14px" fontWeight="700" color="gray.800">
          {title}
        </Text>

        <Text fontSize="12px" color="gray.500" mt={1}>
          {description}
        </Text>
      </Box>

      {onClick && (
        <Text fontSize="18px" fontWeight="700" color={GOLD}>
          →
        </Text>
      )}
    </Flex>
  );
}

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <Box minH="100vh" bg="#F5F6F8" p={4}>
      <Box maxW="1400px">
        {/* HEADER */}
        <Flex
          align={{ base: "flex-start", md: "center" }}
          justify="space-between"
          direction={{ base: "column", md: "row" }}
          gap={4}
          mb={7}
        >
          <Box mt="0.4rem">
            <Text
              fontSize="clamp(1.3rem, 1vw + 0.8rem, 1.4rem)"
              fontWeight="750"
              color={BLUE}
            >
              Rapports
            </Text>

            <PageSubtitle>
              Consultez les rapports de votre entreprise.
            </PageSubtitle>
          </Box>

          <Box
            px={4}
            py={2}
            borderRadius="8px"
            bg="white"
            border="1px solid"
            borderColor="gray.200"
          >
            <Text fontSize="12px" color="gray.500">
              Centre de rapports
            </Text>

            <Text fontSize="13px" fontWeight="700" color={BLUE}>
              Ressources humaines
            </Text>
          </Box>
        </Flex>

        {/* REPORT SECTIONS */}
        <Grid
          templateColumns={{
            base: "1fr",
            xl: "repeat(2, 1fr)",
          }}
          gap={3}
        >
          {/* PRÉSENCE */}
          <ReportSection title="Présence">
            <VStack align="stretch" spacing={3}>
              <ReportItem
                title="Rapport de présence quotidien"
                description="Choisir une journée et télécharger le rapport de présence."
                onClick={() =>
                  navigate("/employees_admin/reports/daily_attendance")
                }
              />

              <ReportItem
                title="Rapport de présence hebdomadaire"
                description="Heures d’arrivée, absences et congés du lundi au vendredi."
                onClick={() =>
                  navigate("/employees_admin/reports/weekly_attendance")
                }
              />

              <ReportItem
                title="Frais de déplacement"
                description="Calculer et consulter le rapport de frais de déplacement."
                onClick={() =>
                  navigate("/employees_admin/reports/transport_allowance")
                }
              />

              <ReportItem
                title="Rapport des retards"
                onClick={() => navigate("/employees_admin/reports/late_attendance")}
                description="Consulter les retards enregistrés des employés."
              />

              <ReportItem
                title="Rapport des absences"
                description="Consulter les absences enregistrées."
              />
            </VStack>
          </ReportSection>
        </Grid>
      </Box>
    </Box>
  );
}
