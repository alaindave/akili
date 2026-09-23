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
   * Compact shared module card.
   */
  const ModuleCard = ({
    icon,
    color,
    title,
    to,
    hoverColor,
    activeColor,
  }: {
    icon: React.ReactNode;
    color: string;
    title: string;
    to: string;
    hoverColor: string;
    activeColor: string;
  }) => {
    return (
      <VStack
        bg="#FFFFFF"
        width="100%"
        height={{ base: "220px", md: "225px" }}
        border="1px solid"
        borderColor="#D1D9E0"
        borderRadius="10px"
        boxShadow="
          0 5px 14px rgba(0,0,0,0.09),
          0 0 14px rgba(242, 183, 5, 0.22)
        "
        transition="all 0.2s ease"
        justifyContent="flex-start"
        alignItems="center"
        px={{ base: "16px", md: "18px" }}
        py={{ base: "16px", md: "18px" }}
        spacing={0}
        _hover={{
          transform: "translateY(-2px)",
          boxShadow: `
            0 7px 18px rgba(0,0,0,0.11),
            0 0 17px rgba(242, 183, 5, 0.28)
          `,
        }}
      >
        {/* Icon */}
        <Flex
          width={{ base: "60px", md: "64px" }}
          height={{ base: "60px", md: "64px" }}
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
        <Text
          color="#1F2937"
          fontSize={{ base: "1rem", md: "1.05rem" }}
          fontWeight="600"
          lineHeight="1.2"
          textAlign="center"
          mt="12px"
        >
          {title}
        </Text>

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
            fontSize="0.85rem"
            fontWeight="600"
            height="40px"
            width="100%"
            maxWidth="210px"
            borderRadius="6px"
            _hover={{
              bg: hoverColor,
            }}
            _active={{
              bg: activeColor,
            }}
          >
            <Text mr="0.7rem" fontSize="0.85rem">
              Accéder au module
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
      position="relative"
    >
      {/* Header */}
      <Flex
        width="100%"
        justify="space-between"
        align="flex-start"
        flexShrink={0}
        px={{ base: "16px", md: "24px", lg: "30px" }}
      >
        {/* Logo + company name — upper left */}
        <Box mt={{ base: "1rem", md: "1.5rem", lg: "2rem" }} flexShrink={0}>
          <Logo text="Gestion de stock et de personnel" />
        </Box>

        {/* Settings — upper right */}
        <Button
          bg="transparent"
          mt={{ base: "1rem", md: "1.5rem", lg: "2rem" }}
          fontSize="2rem"
          minWidth="auto"
          height="auto"
          p={2}
          _hover={{
            bg: "transparent",
          }}
          _active={{
            bg: "transparent",
          }}
          onClick={() => navigate("/admin/settings")}
        >
          <IoSettings />
        </Button>
      </Flex>

      {/* Module cards */}
      <Flex
        flex="1"
        width="100%"
        justify="center"
        align="center"
        px={{ base: "16px", md: "24px" }}
        pb="2rem"
      >
        <Box
          width={{
            base: "100%",
            sm: "92vw",
            md: "700px",
            lg: "760px",
            xl: "800px",
          }}
        >
          <Grid
            templateColumns={{
              base: "1fr",
              md: "repeat(2, 1fr)",
            }}
            gap={{ base: "12px", md: "14px" }}
          >
            {/* PERSONNEL */}
            <ModuleCard
              icon={<BsFillPeopleFill color="#0078D4" size="1.9rem" />}
              color="#0078D4"
              hoverColor="#106EBE"
              activeColor="#005A9E"
              title="Personnel"
              to="/employees_admin"
            />

            {/* APPROVISIONNEMENT */}
            <ModuleCard
              icon={<MdOutlineShoppingCart color="#7C3AED" size="1.9rem" />}
              color="#7C3AED"
              hoverColor="#6D28D9"
              activeColor="#5B21B6"
              title="Approvisionnement"
              to="/admin"
            />

            {/* STOCK */}
            <ModuleCard
              icon={<BsBoxSeamFill color="#107C10" size="1.9rem" />}
              color="#107C10"
              hoverColor="#0E6E0E"
              activeColor="#0A5C0A"
              title="Stock"
              to="/admin"
            />

            {/* PRODUCTION */}
            <ModuleCard
              icon={<GiFactory color="#D97706" size="1.9rem" />}
              color="#D97706"
              hoverColor="#B45309"
              activeColor="#92400E"
              title="Production"
              to="/admin"
            />
          </Grid>
        </Box>
      </Flex>
    </Flex>
  );
};

export default AdminPage;
