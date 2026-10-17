import { useEffect, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FiArrowRight, FiMapPin } from "react-icons/fi";
import type { CompanySummary } from "../../../../common/types/shared/Company";
import SignUp from "./SignUp";
import Logo from "../../../components/common/Logo";

interface Props {
  onSelect: (company: CompanySummary) => void;
}

export default function CompanySelectionPage({ onSelect }: Props) {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    window.electron.company
      .listConfigured()
      .then((result) => {
        if (active) setCompanies(result);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <Box
      maxW="880px"
      mx="auto"
      bg="white"
      borderRadius="24px"
      boxShadow="0 24px 70px rgba(8,22,43,0.3)"
      overflow="hidden"
    >
      <Box h="5px" bg="#F2B705" />
      <VStack align="stretch" spacing={8} p={{ base: 6, md: 10 }}>
        <VStack spacing={3} textAlign="center">
          <Logo width="5rem" height="5rem" showCompanyName={false} isDisabled />
          <Heading
            as="h1"
            fontSize={{ base: "1.2rem", md: "1.3rem" }}
            color="#1E3A5F"
          >
            Selectionnez votre entreprise
          </Heading>
          <Text color="gray.600">
            Choisissez une entreprise pour vous connecter.
          </Text>
        </VStack>

        {loading ? (
          <VStack py={8} role="status">
            <Spinner color="#0078D4" />
            <Text>Chargement des entreprises...</Text>
          </VStack>
        ) : error ? (
          <VStack align="stretch">
            <Alert status="error" borderRadius="lg">
              <AlertIcon />
              Impossible de charger les entreprises.
            </Alert>
            <Button
              onClick={() => {
                setLoading(true);
                setError(false);
                setAttempt((value) => value + 1);
              }}
            >
              Réessayer
            </Button>
          </VStack>
        ) : companies.length === 0 ? (
          <Box textAlign="center" py={8} px={4} bg="#F5F8FC" borderRadius="xl">
            <Text color="#1E3A5F" fontWeight="semibold">
              Aucune entreprise configurée
            </Text>
            <Text mt={2} color="gray.600">
              Ajoutez votre entreprise pour commencer.
            </Text>
          </Box>
        ) : (
          <SimpleGrid
            columns={{ base: 1, md: 2 }}
            spacing={4}
            as="ul"
            listStyleType="none"
            m={0}
            p={0}
          >
            {companies.map((company) => (
              <Box as="li" key={company.companyId} minW={0}>
                <Button
                  w="100%"
                  h="auto"
                  minH="120px"
                  p={5}
                  whiteSpace="normal"
                  textAlign="left"
                  bg="#F5F8FC"
                  border="1px solid"
                  borderColor="#DCE5EF"
                  borderRadius="xl"
                  color="#1E3A5F"
                  justifyContent="space-between"
                  gap={4}
                  _hover={{ bg: "#EDF5FC", borderColor: "#F2B705" }}
                  _focusVisible={{ boxShadow: "0 0 0 3px #F2B705" }}
                  onClick={() => onSelect(company)}
                >
                  <VStack align="start" spacing={3} minW={0}>
                    <Text fontSize="lg" overflowWrap="anywhere">
                      {company.name || "Entreprise sans nom"}
                    </Text>
                    <HStack
                      align="start"
                      color="gray.600"
                      fontWeight="normal"
                      fontSize="sm"
                    >
                      <Icon as={FiMapPin} mt="2px" flexShrink={0} />
                      <Text overflowWrap="anywhere">
                        {[company.address, company.city, company.country]
                          .filter(Boolean)
                          .join(", ") || "Adresse non renseignée"}
                      </Text>
                    </HStack>
                  </VStack>
                  <Icon as={FiArrowRight} color="#0078D4" flexShrink={0} />
                </Button>
              </Box>
            ))}
          </SimpleGrid>
        )}

        <VStack spacing={3} borderTop="1px solid" borderColor="#E8EDF3" pt={6}>
          <SignUp companySetup />
        </VStack>
      </VStack>
    </Box>
  );
}
