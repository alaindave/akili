import { Link, useNavigate } from "react-router-dom";
import { Box, Button, Flex, Text, VStack } from "@chakra-ui/react";
import { IoSettings } from "react-icons/io5";
import { FaRegArrowAltCircleRight } from "react-icons/fa";
import { BsFillPeopleFill, BsBoxSeamFill } from "react-icons/bs";
import { GiFactory } from "react-icons/gi";
import { MdOutlineShoppingCart } from "react-icons/md";

// @ts-ignore
import Logo from "../../../components/Logo";
import { useEffect } from "react";
import { checkOnline } from "../../../services/connectivity_check.service";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";

const AdminPage = () => {
  const user = useAdminUser((store) => store.adminUser);
  const setOffline = useSyncStore((store) => store.setOffline);
  const navigate = useNavigate();

  useEffect(() => {
    syncOnLogin();
  }, []);

  const syncOnLogin = async () => {
    const online = await checkOnline();

    if (!online) {
      setOffline();
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
      <Flex width="97vw" justify="space-between">
        <Box
          mt={{ base: "1rem", md: "1.5rem", lg: "2.2rem" }}
          ml={{ base: "12px", md: "16px", lg: "8px" }}
          flexShrink={0}
        >
          <Logo text="Gestion de stock et de personnel" />
        </Box>
        <Button
          bg="transparent"
          mt="2.3rem"
          fontSize="2rem"
          _hover={{ bg: "transparent" }}
          onClick={() => navigate("/admin/company_settings")}
        >
          <IoSettings />
        </Button>
      </Flex>
      {/* Module cards */}
      <Flex
        flex="1"
        width="100%"
        align="center"
        justify="center"
        px={{ base: "16px", sm: "24px", md: "32px" }}
      >
        <Flex
          width="100%"
          maxWidth="1200px"
          justify="center"
          align="stretch"
          gap={{ base: "20px", md: "28px", lg: "32px" }}
          flexWrap="wrap"
        >
          {/* =====================================================
              PERSONNEL
          ===================================================== */}
          <VStack
            bg="#FFFFFF"
            width="100%"
            maxWidth={{ base: "100%", md: "270px" }}
            minHeight={{ base: "340px", md: "380px" }}
            flex="1 1 250px"
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
            px={{ base: "20px", md: "20px" }}
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
            <Box
              borderWidth="2px"
              padding={{ base: "16px", md: "20px" }}
              borderRadius="60px"
              borderColor="#0078D4"
              flexShrink={0}
            >
              <BsFillPeopleFill color="#0078D4" size="3.5rem" />
            </Box>
            <VStack
              width="100%"
              textAlign="center"
              spacing="6px"
              mt={{ base: "24px", md: "28px" }}
            >
              <Text
                color="#1F2937"
                fontSize={{ base: "1.3rem", md: "1.4rem" }}
                fontWeight="600"
                lineHeight="1.3"
              >
                Personnel
              </Text>
              <Text
                color="#6B7280"
                fontSize={{ base: "1rem", md: "1rem" }}
                lineHeight="1.5"
                maxWidth="240px"
              >
                Gérez vos employés, présences, congés et fiches de paye
              </Text>
            </VStack>
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
                fontSize="0.95rem"
                height="50px"
                width="100%"
                maxWidth="240px"
                fontWeight="600"
                mt={{ base: "2rem", md: "2rem" }}
                borderRadius="6px"
                _hover={{
                  bg: "#106EBE",
                }}
                _active={{
                  bg: "#005A9E",
                }}
              >
                <Text marginRight="1rem" fontSize="1rem">
                  Acceder au module
                </Text>
                <FaRegArrowAltCircleRight />
              </Button>
            </Link>
          </VStack>
          {/* =====================================================
                STOCK
            ===================================================== */}
          <VStack
            bg="#FFFFFF"
            width="100%"
            maxWidth={{ base: "100%", md: "270px" }}
            minHeight={{ base: "340px", md: "380px" }}
            flex="1 1 250px"
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
            px={{ base: "20px", md: "20px" }}
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
            <Box
              borderWidth="1px"
              padding={{ base: "16px", md: "20px" }}
              borderRadius="60px"
              borderColor="#107C10"
              flexShrink={0}
            >
              <BsBoxSeamFill color="#107C10" size="4rem" />
            </Box>
            <VStack
              width="100%"
              textAlign="center"
              spacing="6px"
              mt={{ base: "2rem", md: "3rem" }}
            >
              <Text
                color="#1F2937"
                fontSize={{ base: "1.3rem", md: "1.4rem" }}
                fontWeight="600"
                lineHeight="1.3"
                position="relative"
                bottom="1.2rem"
              >
                Stock
              </Text>
              <Text
                color="#6B7280"
                fontSize={{ base: "1rem", md: "1rem" }}
                lineHeight="1.5"
                maxWidth="240px"
                position="relative"
                bottom="1rem"
              >
                Gérez vos produits, entrées, sorties, stock et inventaires
              </Text>
            </VStack>
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
                fontSize="0.95rem"
                fontWeight="600"
                height="50px"
                width="100%"
                maxWidth="240px"
                mt={{ base: "24px", md: "30px" }}
                borderRadius="6px"
                _hover={{
                  bg: "#0E6E0E",
                }}
                _active={{
                  bg: "#0A5C0A",
                }}
              >
                <Text marginRight="1rem" fontSize="1rem">
                  Acceder au module
                </Text>
                <FaRegArrowAltCircleRight />
              </Button>
            </Link>
          </VStack>

          {/* =====================================================
                APPROVISIONNEMENT
            ===================================================== */}
          <VStack
            bg="#FFFFFF"
            width="100%"
            maxWidth={{ base: "100%", md: "270px" }}
            minHeight={{ base: "340px", md: "380px" }}
            flex="1 1 250px"
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
            px={{ base: "20px", md: "20px" }}
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
            <Box
              borderWidth="2px"
              padding={{ base: "16px", md: "20px" }}
              borderRadius="60px"
              borderColor="#7C3AED"
              flexShrink={0}
            >
              <MdOutlineShoppingCart color="#7C3AED" size="4rem" />
            </Box>
            <VStack width="100%" textAlign="center" spacing="6px">
              <Text
                color="#1F2937"
                fontSize={{ base: "1.3rem", md: "1.4rem" }}
                fontWeight="600"
                lineHeight="1.3"
                position="relative"
                top="1.5rem"
              >
                Approvisionnement
              </Text>
              <Text
                color="#6B7280"
                fontSize={{ base: "1rem", md: "1rem" }}
                lineHeight="1.5"
                maxWidth="240px"
                position="relative"
                top="1.5rem"
              >
                Gérez vos fournisseurs, demandes, commandes et réceptions
              </Text>
            </VStack>
            <Link
              to="/approvisionnement"
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Button
                bg="#7C3AED"
                color="white"
                fontSize="0.95rem"
                fontWeight="600"
                height="50px"
                width="100%"
                maxWidth="240px"
                mt={{ base: "2rem", md: "3rem" }}
                borderRadius="6px"
                _hover={{
                  bg: "#6D28D9",
                }}
                _active={{
                  bg: "#5B21B6",
                }}
              >
                <Text marginRight="1rem" fontSize="1rem">
                  Acceder au module
                </Text>
                <FaRegArrowAltCircleRight />
              </Button>
            </Link>
          </VStack>

          {/* =====================================================
              PRODUCTION
          ===================================================== */}
          <VStack
            bg="#FFFFFF"
            width="100%"
            maxWidth={{ base: "100%", md: "270px" }}
            minHeight={{ base: "340px", md: "380px" }}
            flex="1 1 250px"
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
            px={{ base: "20px", md: "20px" }}
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
            <Box
              borderWidth="2px"
              padding={{ base: "16px", md: "20px" }}
              borderRadius="60px"
              borderColor="#D97706"
              flexShrink={0}
            >
              <GiFactory color="#D97706" size="4rem" />
            </Box>
            <VStack
              width="100%"
              textAlign="center"
              spacing="6px"
              mt={{ base: "24px", md: "28px" }}
            >
              <Text
                color="#1F2937"
                fontSize={{ base: "1.3rem", md: "1.4rem" }}
                fontWeight="600"
                lineHeight="1.3"
              >
                Production
              </Text>
              <Text
                color="#6B7280"
                fontSize={{ base: "1rem", md: "1rem" }}
                lineHeight="1.5"
                maxWidth="240px"
              >
                Planifiez et suivez la fabrication, les matières et les produits
                finis
              </Text>
            </VStack>
            <Link
              to="/production"
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Button
                bg="#D97706"
                color="white"
                fontSize="0.95rem"
                fontWeight="600"
                height="50px"
                width="100%"
                maxWidth="240px"
                mt={{ base: "1rem", md: "1.1rem" }}
                borderRadius="6px"
                _hover={{
                  bg: "#B45309",
                }}
                _active={{
                  bg: "#92400E",
                }}
              >
                <Text marginRight="1rem" fontSize="1rem">
                  Acceder au module
                </Text>
                <FaRegArrowAltCircleRight />
              </Button>
            </Link>
          </VStack>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default AdminPage;
