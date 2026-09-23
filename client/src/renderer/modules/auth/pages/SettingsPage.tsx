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

export default function SettingsPage() {
  return (
    <Box minH="100vh" bg="gray.50" p={{ base: 5, md: 10 }}>
      <HStack>
        <Button fontSize="1rem" as={Link} to="/admin" variant="outline" mb={6}>
          <FaArrowLeftLong color="black" />
        </Button>
        <Heading fontSize="1rem" mb={5}>
          Paramètres
        </Heading>
      </HStack>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} maxW="1000px">
        {[
          [
            "Paramètres de l'entreprise",
            "Identité, coordonnées et logo de l'entreprise.",
            "/admin/company_settings",
          ],
          [
            "Paramètres de présence",
            "Heure de pointage et réouverture des contrôles quotidiens.",
            "/admin/settings/attendance",
          ],
        ].map(([title, description, path]) => (
          <VStack
            key={path}
            align="stretch"
            bg="white"
            borderWidth="1px"
            borderRadius="lg"
            p={6}
            spacing={4}
          >
            <Heading fontSize="1.1rem">{title}</Heading>
            <Text fontSize="1rem" color="gray.600">
              {description}
            </Text>
            <Button
              as={Link}
              to={path}
              colorScheme="blue"
              alignSelf="flex-start"
            >
              Ouvrir
            </Button>
          </VStack>
        ))}
      </SimpleGrid>
    </Box>
  );
}
