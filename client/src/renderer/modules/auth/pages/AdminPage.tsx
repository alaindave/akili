import { Link, useNavigate } from "react-router-dom";
import { Box, Button, Flex, Grid, Text, VStack } from "@chakra-ui/react";

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

      const results = await window.electron.sync.sync(user.companyId);

      console.log("LOGIN SYNC COMPLETE", results);
    } catch (error) {
      console.error("LOGIN SYNC FAILED:", error);
    }
  };

  /**
   * Shared module card component.
   *
   * Every card uses the exact same internal structure:
   *
   * 1. Icon area       -> fixed height
   * 2. Title area      -> fixed height
   * 3. Description     -> fixed height
   * 4. Button          -> pushed to the bottom
   *
   * This guarantees perfect alignment between all cards.
   */
  const ModuleCard = ({
    icon,
    color,
    title,
    description,
    to,
    hoverColor,
    activeColor,
  }: {
    icon: React.ReactNode;
    color: string;
    title: string;
    description: string;
    to: string;
    hoverColor: string;
    activeColor: string;
  }) => {
    return (
      <VStack
        bg="#FFFFFF"
        width="100%"
        height={{ base: "350px", md: "350px" }}
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
        py={{ base: "24px", md: "26px" }}
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
        <Flex
          width="80px"
          height="80px"
          flexShrink={0}
          border="2px solid"
          borderColor={color}
          borderRadius="50%"
          align="center"
          justify="center"
        >
          {icon}
        </Flex>

        {/* Title */}
        <Flex
          width="100%"
          height="42px"
          flexShrink={0}
          align="center"
          justify="center"
          mt="18px"
        >
          <Text
            color="#1F2937"
            fontSize={{ base: "1.1rem", md: "1.2rem" }}
            fontWeight="600"
            lineHeight="1.2"
            textAlign="center"
          >
            {title}
          </Text>
        </Flex>

        {/* Description */}
        <Flex
          width="100%"
          height="72px"
          flexShrink={0}
          align="flex-start"
          justify="center"
          mt="6px"
        >
          <Text
            color="#6B7280"
            fontSize="1rem"
            lineHeight="1.5"
            maxWidth="240px"
            textAlign="center"
          >
            {description}
          </Text>
        </Flex>

        {/* Button */}
        <Link
          to={to}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            marginTop: "auto",
          }}
        >
          <Button
            bg={color}
            color="white"
            fontSize="0.95rem"
            fontWeight="600"
            height="50px"
            width="100%"
            maxWidth="240px"
            borderRadius="6px"
            _hover={{
              bg: hoverColor,
            }}
            _active={{
              bg: activeColor,
            }}
          >
            <Text marginRight="1rem" fontSize="1rem">
              Acceder au module
            </Text>

            <FaRegArrowAltCircleRight />
          </Button>
        </Link>
      </VStack>
    );
  };

  return (
    <Flex
      direction="column"
      minHeight="100vh"
      width="100%"
      bg="linear-gradient(180deg, #F8F9FB 0%, #EEF2F7 100%)"
      overflow="auto"
      justify="center"
      align="center"
    >
      {/* Header */}
      <Flex height="100%" width="97vw" justify="space-between" flexShrink={0}>
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
      <Box
        width={{
          base: "92vw",
          md: "700px",
          lg: "760px",
          xl: "800px",
        }}
        mb="2.3rem"
        mt="1rem"
      >
        <Grid
          templateColumns={{
            base: "1fr",
            md: "repeat(2, 1fr)",
          }}
          gap="18px"
        >
          {/* =====================================================
              PERSONNEL
          ===================================================== */}
          <ModuleCard
            icon={<BsFillPeopleFill color="#0078D4" size="2.2rem" />}
            color="#0078D4"
            hoverColor="#106EBE"
            activeColor="#005A9E"
            title="Personnel"
            description="Gérez vos employés, présences, congés et fiches de paye"
            to="/employees_admin"
          />

          {/* =====================================================
              APPROVISIONNEMENT
          ===================================================== */}
          <ModuleCard
            icon={<MdOutlineShoppingCart color="#7C3AED" size="2.2rem" />}
            color="#7C3AED"
            hoverColor="#6D28D9"
            activeColor="#5B21B6"
            title="Approvisionnement"
            description="Gérez vos fournisseurs, demandes, commandes et réceptions"
            to="/approvisionnement"
          />

          {/* =====================================================
              STOCK
          ===================================================== */}
          <ModuleCard
            icon={<BsBoxSeamFill color="#107C10" size="2.2rem" />}
            color="#107C10"
            hoverColor="#0E6E0E"
            activeColor="#0A5C0A"
            title="Stock"
            description="Gérez vos produits, entrées, sorties, stock, entreposage et inventaires"
            to="/admin"
          />

          {/* =====================================================
              PRODUCTION
          ===================================================== */}
          <ModuleCard
            icon={<GiFactory color="#D97706" size="2.2rem" />}
            color="#D97706"
            hoverColor="#B45309"
            activeColor="#92400E"
            title="Production"
            description="Planifiez et suivez la fabrication, les matières et les produits finis"
            to="/production"
          />
        </Grid>
      </Box>
    </Flex>
  );
};

export default AdminPage;
