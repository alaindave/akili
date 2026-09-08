import { Link } from "react-router-dom";
import { Box, Button, Flex, HStack, Text, VStack } from "@chakra-ui/react";
import { FaRegArrowAltCircleRight } from "react-icons/fa";
import { BsFillPeopleFill, BsBoxSeamFill } from "react-icons/bs";

// @ts-ignore
import Logo from "../../../components/Logo";
import { useEffect } from "react";
import { checkOnline } from "../../../services/connectivity_check.service";
import useAdminUser from "../../../../store/auth.store";

const AdminPage = () => {
  const user = useAdminUser((store) => store.adminUser);

  useEffect(() => {
    syncOnLogin();
  }, []);

  const syncOnLogin = async () => {
    const online = await checkOnline();

    if (!online) {
      return;
    }

    try {
      console.log("SYNCING AFTER LOGIN...");
      const results = await window.electron.sync(user.companyId);
      console.log("LOGIN SYNC COMPLETE", results);
    } catch (error) {
      console.error("LOGIN SYNC FAILED:", error);
    }
  };

  return (
    <Flex
      direction="column"
      minHeight="100vh"
      width="100%"
      bg="linear-gradient(180deg, #F8F9FB 0%, #EEF2F7 100%)"
      overflow="auto"
    >
      {/* Header */}
      <Box
        mt={{ base: "1rem", md: "1.5rem", lg: "2.2rem" }}
        ml={{ base: "12px", md: "16px", lg: "8px" }}
        flexShrink={0}
      >
        <Logo text="Gestion de stock et de personnel" />
      </Box>

      {/* Module cards */}
      <Flex
        flex="1"
        width="100%"
        align="center"
        justify="center"
        px={{ base: "16px", sm: "24px", md: "32px" }}
        py={{ base: "24px", md: "32px" }}
      >
        <HStack
          spacing={{ base: "20px", md: "28px", lg: "40px" }}
          width="100%"
          maxWidth="820px"
          justify="center"
          align="stretch"
          flexDirection={{ base: "column", md: "row" }}
        >
          {/* Personnel */}
          <VStack
            bg="#FFFFFF"
            width="100%"
            maxWidth={{ base: "100%", md: "380px" }}
            minHeight={{ base: "340px", md: "380px" }}
            border="1px solid"
            borderColor="#D1D9E0"
            borderRadius="12px"
            boxShadow="
              0 8px 20px rgba(0,0,0,0.12),
              0 0 20px rgba(242, 183, 5, 0.35)
            "
            transition="all 0.2s ease"
            justifyContent="flex-start"
            alignItems="center"
            px={{ base: "20px", md: "24px" }}
            py={{ base: "24px", md: "30px" }}
            spacing={0}
            _hover={{
              transform: "translateY(-2px)",
              boxShadow: `
                0 10px 24px rgba(0,0,0,0.14),
                0 0 22px rgba(242, 183, 5, 0.4)
              `,
            }}
          >
            {/* Icon */}
            <Box
              borderWidth="2px"
              padding={{ base: "16px", md: "20px" }}
              borderRadius="60px"
              borderColor="#0078D4"
              flexShrink={0}
            >
              <BsFillPeopleFill color="#0078D4" size="3.5rem" />
            </Box>

            {/* Text */}
            <VStack
              width="100%"
              textAlign="center"
              spacing="6px"
              mt={{ base: "24px", md: "28px" }}
            >
              <Text
                color="#1F2937"
                fontSize={{ base: "1.3rem", md: "1.5rem" }}
                fontWeight="600"
                lineHeight="1.3"
              >
                Module personnel
              </Text>

              <Text
                color="#6B7280"
                fontSize={{ base: "1rem", md: "1.1rem" }}
                lineHeight="1.5"
                maxWidth="300px"
              >
                Gérez vos employés, présences, congés et fiches de paye
              </Text>
            </VStack>

            {/* Button */}
            <Link
              to="/employees_admin"
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Button
                bg="#0078D4"
                color="white"
                fontSize="1rem"
                height="52px"
                width="100%"
                maxWidth="280px"
                fontWeight="600"
                mt={{ base: "24px", md: "30px" }}
                borderRadius="6px"
                _hover={{
                  bg: "#106EBE",
                }}
                _active={{
                  bg: "#005A9E",
                }}
              >
                <Text marginRight="1.2rem" fontSize="1.1rem">
                  Acceder au module
                </Text>

                <FaRegArrowAltCircleRight />
              </Button>
            </Link>
          </VStack>

          {/* Stock */}
          <VStack
            bg="#FFFFFF"
            width="100%"
            maxWidth={{ base: "100%", md: "380px" }}
            minHeight={{ base: "340px", md: "380px" }}
            border="1px solid"
            borderColor="#D1D9E0"
            borderRadius="12px"
            boxShadow="
              0 8px 20px rgba(0,0,0,0.12),
              0 0 20px rgba(242, 183, 5, 0.35)
            "
            transition="all 0.2s ease"
            justifyContent="flex-start"
            alignItems="center"
            px={{ base: "20px", md: "24px" }}
            py={{ base: "24px", md: "30px" }}
            spacing={0}
            _hover={{
              transform: "translateY(-2px)",
              boxShadow: `
                0 10px 24px rgba(0,0,0,0.14),
                0 0 22px rgba(242, 183, 5, 0.4)
              `,
            }}
          >
            {/* Icon */}
            <Box
              borderWidth="1px"
              padding={{ base: "16px", md: "20px" }}
              borderRadius="60px"
              borderColor="#107C10"
              flexShrink={0}
            >
              <BsBoxSeamFill color="#107C10" size="4rem" />
            </Box>

            {/* Text */}
            <VStack
              width="100%"
              textAlign="center"
              spacing="6px"
              mt={{ base: "24px", md: "28px" }}
            >
              <Text
                color="#1F2937"
                fontSize={{ base: "1.3rem", md: "1.5rem" }}
                fontWeight="600"
                lineHeight="1.3"
              >
                Module stock
              </Text>

              <Text
                color="#6B7280"
                fontSize={{ base: "1rem", md: "1.1rem" }}
                lineHeight="1.5"
                maxWidth="300px"
              >
                Gérez vos produits, entrées, sorties, stock et inventaires
              </Text>
            </VStack>

            {/* Button */}
            <Link
              to="/admin"
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Button
                bg="#107C10"
                color="white"
                fontSize="1rem"
                fontWeight="600"
                height="52px"
                width="100%"
                maxWidth="280px"
                mt={{ base: "24px", md: "30px" }}
                borderRadius="6px"
                _hover={{
                  bg: "#0E6E0E",
                }}
                _active={{
                  bg: "#0A5C0A",
                }}
              >
                <Text marginRight="1.2rem" fontSize="1.1rem">
                  Acceder au module
                </Text>

                <FaRegArrowAltCircleRight />
              </Button>
            </Link>
          </VStack>
        </HStack>
      </Flex>
    </Flex>
  );
};

export default AdminPage;
