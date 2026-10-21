import {
  Box,
  Button,
  Heading,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { Link } from "react-router-dom";

export default function AdministrationPage() {
  return (
    <Box minH="100vh" bg="gray.50" p={{ base: 5, md: 10 }}>
      <HStack mb={6}>
        <Button
          as={Link}
          to="/admin"
          variant="outline"
          aria-label="Retour aux modules"
        >
          <FaArrowLeftLong aria-hidden="true" />
        </Button>
        <Heading as="h1" fontSize="1rem">Administration</Heading>
      </HStack>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={6} maxW="1200px">
        {[
          {
            title: "Utilisateurs et permissions",
            description: "Gestion des utilisateurs et de leurs droits d’accès.",
          },
          {
            title: "Journal d’audit",
            description: "Historique des opérations de l’entreprise.",
          },
          {
            title: "Paramètres",
            description: "Configuration de l’entreprise, des stocks, de la présence, des congés et de la paie.",
            path: "/admin/settings",
          },
        ].map(({ title, description, path }) => (
          <VStack
            key={title}
            align="stretch"
            bg="white"
            borderWidth="1px"
            borderRadius="lg"
            p={6}
            spacing={4}
          >
            <Heading as="h2" fontSize="1.1rem">{title}</Heading>
            <Text fontSize="1rem" color="gray.600" flex="1">{description}</Text>
            {path ? (
              <Button as={Link} to={path} colorScheme="blue" alignSelf="flex-start">
                Ouvrir
              </Button>
            ) : (
              <Button isDisabled alignSelf="flex-start">Bientôt disponible</Button>
            )}
          </VStack>
        ))}
      </SimpleGrid>
    </Box>
  );
}
