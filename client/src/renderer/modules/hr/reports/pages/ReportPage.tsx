import PageSubtitle from "../../../../components/common/PageSubtitle";
import { Box, Flex, Grid, Text, VStack } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";

const BLUE = "#03143B";
const GOLD = "#F2B705";
const MIN_REPORT_HEIGHT = "400px";
const NAVBAR_CLEARANCE = "24px";
const SECTION_BOTTOM_SPACE = "24px";

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
    <Flex
      direction="column"
      alignSelf="start"
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="12px"
      height="auto"
      minH={MIN_REPORT_HEIGHT}
      minW={0}
      maxH="100%"
      overflow="hidden"
      cursor={onClick ? "pointer" : "default"}
      transition="border-color 0.2s ease, box-shadow 0.2s ease"
      onClick={onClick}
      _hover={
        onClick
          ? {
              borderColor: GOLD,
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.06)",
            }
          : undefined
      }
    >
      {/* FIXED SECTION TITLE */}
      <Flex
        flexShrink={0}
        align="center"
        gap={3}
        px={5}
        py={4}
        bg="white"
        borderBottom="1px solid"
        borderColor="gray.100"
        position="relative"
        zIndex={1}
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

      {/* ONLY THE CHILDREN CONTAINER SCROLLS */}
      <Box
        flex="1 1 auto"
        minH={0}
        minW={0}
        overflowY="auto"
        overflowX="hidden"
        px={5}
        pt={5}
        pb={SECTION_BOTTOM_SPACE}
        overscrollBehaviorY="contain"
        sx={{
          scrollbarGutter: "stable",
          "&::-webkit-scrollbar": {
            width: "6px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#CBD5E0",
            borderRadius: "6px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "#A0AEC0",
          },
        }}
      >
        <Box minH="min-content">{children}</Box>
      </Box>
    </Flex>
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
      <Box minW={0}>
        <Text fontSize="14px" fontWeight="700" color="gray.800">
          {title}
        </Text>

        <Text fontSize="12px" color="gray.500" mt={1}>
          {description}
        </Text>
      </Box>

      {onClick && (
        <Text flexShrink={0} fontSize="18px" fontWeight="700" color={GOLD}>
          →
        </Text>
      )}
    </Flex>
  );
}

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <Flex
      direction="column"
      bg="#F5F6F8"
      p={4}
      pb={`calc(1rem + ${NAVBAR_CLEARANCE})`}
      width="100%"
      maxW="1400px"
      height="100%"
      minH={0}
      minW={0}
      alignSelf="flex-start"
      overflow="hidden"
      boxSizing="border-box"
    >
      {/* PAGE HEADER */}
      <Flex
        flexShrink={0}
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

      {/* CONTENT-SIZED REPORT SECTIONS */}
      <Grid
        mt="2.5rem"
        flex="0 1 auto"
        minH={0}
        minW={0}
        alignItems="start"
        templateColumns={{
          base: "minmax(0, 1fr)",
          xl: "repeat(2, minmax(0, 1fr))",
        }}
        gap={3}
        overflow="hidden"
      >
        <ReportSection title="Présence">
          <VStack align="stretch" spacing={3} flexShrink={0}>
            <ReportItem
              title="Rapport de présence quotidien"
              description="Choisir une journée et télécharger le rapport de présence."
              onClick={() => navigate("/hr/reports/daily_attendance")}
            />

            <ReportItem
              title="Rapport de présence hebdomadaire"
              description="Heures d’arrivée, absences et congés du lundi au vendredi."
              onClick={() => navigate("/hr/reports/weekly_attendance")}
            />

            <ReportItem
              title="Frais de déplacement"
              description="Calculer et consulter le rapport de frais de déplacement."
              onClick={() => navigate("/hr/reports/transport_allowance")}
            />

            <ReportItem
              title="Rapport des retards"
              description="Consulter les retards enregistrés des employés."
              onClick={() => navigate("/hr/reports/late_attendance")}
            />

            <ReportItem
              title="Rapport des absences"
              description="Consulter les absences enregistrées."
            />
          </VStack>
        </ReportSection>
      </Grid>
    </Flex>
  );
}
