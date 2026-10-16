import { useEffect, useState } from "react";
import { initializeRendererSync } from "../services/syncManager.service";
import "../styles/App.css";
import { Box, Flex } from "@chakra-ui/react";
import LoginPage from "../modules/auth/pages/LoginPage";
import CompanySelectionPage from "../modules/auth/pages/CompanySelectionPage";
import type { CompanySummary } from "../../common/types/shared/Company";

function App() {
  const [selectedCompany, setSelectedCompany] = useState<CompanySummary | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  useEffect(() => {
    initializeRendererSync();
  }, []);

  return (
    <Flex
      w="100%"
      minH="100vh"
      bgGradient="linear(to-br, #1E3A5F, #0078D4)"
      direction="column"
      align="center"
      justify="center"
      px={{ base: 4, sm: 6, md: 8 }}
      py={{ base: 4, md: 6 }}
      overflow="auto"
    >
      <Box w="100%" maxW="1400px" minW={0}>
        {showLogin ? (
          <LoginPage selectedCompany={selectedCompany} onBack={() => {
            setShowLogin(false);
            setSelectedCompany(null);
          }} />
        ) : (
          <CompanySelectionPage onSelect={(company) => {
            setSelectedCompany(company);
            setShowLogin(true);
          }} onLogin={() => setShowLogin(true)} />
        )}
      </Box>
    </Flex>
  );
}

export default App;
