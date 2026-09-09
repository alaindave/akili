import {
  Box,
  Flex,
  HStack,
  List,
  ListItem,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { CiCalendarDate, CiClock2 } from "react-icons/ci";
import {
  FaHome,
  FaRegCalendarAlt,
  FaSignOutAlt,
  FaTasks,
} from "react-icons/fa";
import { FaFileSignature, FaRegClock } from "react-icons/fa6";
import { IoPeopleSharp } from "react-icons/io5";
import { MdPersonOutline } from "react-icons/md";
import { NavLink, useNavigate } from "react-router-dom";
import useAdminUser from "../../../../../store/auth.store";
import useTaskStore from "../../../../../store/task.store";
import Logo from "../../../../components/Logo";
import PageErrorFallback from "../../../../components/PageErrorFallback";
import SyncStatus from "../../../../components/SyncStatus";
import "../../../../styles/App.css";

const EmployeeNavBar = () => {
  const user = useAdminUser((store) => store.adminUser);
  const setLogOut = useAdminUser((store) => store.logout);
  const clearTasks = useTaskStore((store) => store.clearTasks);
  const [time, setTime] = useState<Date>(new Date());
  const navigate = useNavigate();

  const sidebarWidth = useBreakpointValue({
    base: "100%",
    md: "215px",
    lg: "220px",
    xl: "235px",
  });

  const sidebarHeight = {
    base: "calc(100vh - 46px)",
    md: "calc(100vh - 52px)",
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleLogOut = async () => {
    try {
      const logout = await window.electron.auth.logout();

      if (logout) {
        await setLogOut();
        await clearTasks();
        navigate("/", { replace: true });
      }
    } catch (error) {
      console.error("An error occured while logging out:", error);
    }
  };

  return (
    <>
      {/* =====================================================
          SIDEBAR
      ===================================================== */}
      <Flex
        direction="column"
        height={sidebarHeight}
        minHeight={sidebarHeight}
        width={sidebarWidth}
        flexShrink={0}
        bg="#F8F9FB"
        borderRight={{ base: "none", md: "1px solid #E2E8F0" }}
        borderBottom={{ base: "1px solid", md: "none" }}
        borderColor="#D1D9E0"
        boxShadow="2px 0 8px rgba(0,0,0,0.04)"
        overflow="hidden"
      >
        {/* =================================================
            LOGO
        ================================================= */}
        <Box
          px={{ base: "10px", md: "8px" }}
          pt={{ base: "8px", md: "10px" }}
          pb={{ base: "8px", md: "14px" }}
          flexShrink={0}
        >
          <Logo text="Gestion de personnel" />
        </Box>

        {/* =================================================
            NAVIGATION
        ================================================= */}
        <Box
          flex="1"
          minHeight={0}
          overflowY="auto"
          overflowX="hidden"
          px={{ base: "10px", md: "10px" }}
          py={{ base: "12px", md: "18px" }}
        >
          <List
            height="100%"
            display="flex"
            flexDirection="column"
            justifyContent="space-evenly"
          >
            {/* Dashboard */}
            <ListItem flex="1" display="flex" alignItems="center">
              <NavLink
                className="nav-button"
                end
                to="/employees_admin"
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <HStack
                  width="100%"
                  minHeight="42px"
                  px="12px"
                  spacing="12px"
                  align="center"
                >
                  <Flex
                    width="24px"
                    minWidth="24px"
                    justify="center"
                    align="center"
                  >
                    <FaHome size="1.25rem" />
                  </Flex>

                  <Text
                    fontSize={{ base: "1rem", md: "1.15rem" }}
                    fontWeight="500"
                    lineHeight="1"
                    whiteSpace="nowrap"
                  >
                    Tableau de bord
                  </Text>
                </HStack>
              </NavLink>
            </ListItem>

            {/* Employees */}
            <ListItem flex="1" display="flex" alignItems="center">
              <ErrorBoundary FallbackComponent={PageErrorFallback}>
                <NavLink
                  to="/employees_admin/employees_list"
                  className="nav-button"
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                  }}
                >
                  <HStack
                    width="100%"
                    minHeight="42px"
                    px="12px"
                    spacing="12px"
                    align="center"
                  >
                    <Flex
                      width="24px"
                      minWidth="24px"
                      justify="center"
                      align="center"
                    >
                      <IoPeopleSharp size="1.3rem" />
                    </Flex>

                    <Text
                      fontSize={{ base: "1rem", md: "1.15rem" }}
                      fontWeight="500"
                      lineHeight="1"
                      whiteSpace="nowrap"
                    >
                      Employés
                    </Text>
                  </HStack>
                </NavLink>
              </ErrorBoundary>
            </ListItem>

            {/* Attendance */}
            <ListItem flex="1" display="flex" alignItems="center">
              <ErrorBoundary FallbackComponent={PageErrorFallback}>
                <NavLink
                  className="nav-button"
                  to="/employees_admin/attendances"
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                  }}
                >
                  <HStack
                    width="100%"
                    minHeight="42px"
                    px="12px"
                    spacing="12px"
                    align="center"
                  >
                    <Flex
                      width="24px"
                      minWidth="24px"
                      justify="center"
                      align="center"
                    >
                      <FaRegClock size="1.25rem" />
                    </Flex>

                    <Text
                      fontSize={{ base: "1rem", md: "1.15rem" }}
                      fontWeight="500"
                      lineHeight="1"
                      whiteSpace="nowrap"
                    >
                      Présence
                    </Text>
                  </HStack>
                </NavLink>
              </ErrorBoundary>
            </ListItem>

            {/* Leaves */}
            <ListItem flex="1" display="flex" alignItems="center">
              <ErrorBoundary FallbackComponent={PageErrorFallback}>
                <NavLink
                  className="nav-button"
                  to="/employees_admin/leaves"
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                  }}
                >
                  <HStack
                    width="100%"
                    minHeight="42px"
                    px="12px"
                    spacing="12px"
                    align="center"
                  >
                    <Flex
                      width="24px"
                      minWidth="24px"
                      justify="center"
                      align="center"
                    >
                      <FaRegCalendarAlt size="1.25rem" />
                    </Flex>

                    <Text
                      fontSize={{ base: "1rem", md: "1.15rem" }}
                      fontWeight="500"
                      lineHeight="1"
                      whiteSpace="nowrap"
                    >
                      Congés
                    </Text>
                  </HStack>
                </NavLink>
              </ErrorBoundary>
            </ListItem>

            {/* Payroll */}
            <ListItem flex="1" display="flex" alignItems="center">
              <NavLink
                className="nav-button"
                to="/employees_admin/payroll"
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <HStack
                  width="100%"
                  minHeight="42px"
                  px="12px"
                  spacing="12px"
                  align="center"
                >
                  <Flex
                    width="24px"
                    minWidth="24px"
                    justify="center"
                    align="center"
                  >
                    <FaFileSignature size="1.25rem" />
                  </Flex>

                  <Text
                    fontSize={{ base: "1rem", md: "1.15rem" }}
                    fontWeight="500"
                    lineHeight="1"
                    whiteSpace="nowrap"
                  >
                    Fiches de paye
                  </Text>
                </HStack>
              </NavLink>
            </ListItem>

            {/* Tasks */}
            <ListItem flex="1" display="flex" alignItems="center">
              <NavLink
                className="nav-button"
                to="/employees_admin/tasks"
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <HStack
                  width="100%"
                  minHeight="42px"
                  px="12px"
                  spacing="12px"
                  align="center"
                >
                  <Flex
                    width="24px"
                    minWidth="24px"
                    justify="center"
                    align="center"
                  >
                    <FaTasks size="1.25rem" />
                  </Flex>

                  <Text
                    fontSize={{ base: "1rem", md: "1.15rem" }}
                    fontWeight="500"
                    lineHeight="1"
                    whiteSpace="nowrap"
                  >
                    Tâches
                  </Text>
                </HStack>
              </NavLink>
            </ListItem>
            {/* Reports */}
            <ListItem flex="1" display="flex" alignItems="center">
              <NavLink
                className="nav-button"
                to="/admin"
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <HStack
                  width="100%"
                  minHeight="42px"
                  px="12px"
                  spacing="12px"
                  align="center"
                >
                  <Flex
                    width="24px"
                    minWidth="24px"
                    justify="center"
                    align="center"
                  >
                    <FaTasks size="1.25rem" />
                  </Flex>

                  <Text
                    fontSize={{ base: "1rem", md: "1.15rem" }}
                    fontWeight="500"
                    lineHeight="1"
                    whiteSpace="nowrap"
                  >
                    Rapports
                  </Text>
                </HStack>
              </NavLink>
            </ListItem>
          </List>
        </Box>

        {/* =================================================
            ADMIN USER
        ================================================= */}
        <Box width="100%" px="0" pt="8px" pb="0" flexShrink={0}>
          <Flex
            width="100%"
            minHeight="58px"
            borderTop="1px solid #D1D9E0"
            borderBottom="1px solid #D1D9E0"
            bg="gray.100"
            boxShadow="0 2px 10px rgba(15,23,42,.06)"
            align="center"
            px={{ base: "10px", md: "12px" }}
            gap="8px"
          >
            {/* User menu */}
            <Flex
              height="38px"
              width="38px"
              minWidth="38px"
              borderWidth="2px"
              borderRadius="50%"
              bg="#ffffff"
              borderColor="blue"
              justify="center"
              align="center"
              flexShrink={0}
            >
              <Menu>
                <MenuButton
                  as={Box}
                  width="34px"
                  height="34px"
                  minWidth="34px"
                  minHeight="34px"
                  padding="0"
                  margin="0"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  background="transparent"
                  border="none"
                  cursor="pointer"
                  _hover={{ bg: "transparent" }}
                  _expanded={{ bg: "transparent" }}
                >
                  <Box ml="0.25rem">
                    <MdPersonOutline
                      color="blue"
                      size="27px"
                      style={{
                        display: "block",
                        margin: "0",
                      }}
                    />
                  </Box>
                </MenuButton>

                <MenuList bg="#ffffff" minWidth="150px">
                  <MenuItem
                    bg="gray.700"
                    _hover={{ bg: "#e68a00" }}
                    onClick={handleLogOut}
                  >
                    <FaSignOutAlt color="#ffffff" />

                    <Text color="#ffffff" ml="8px" fontSize="0.9rem">
                      Déconnexion
                    </Text>
                  </MenuItem>
                </MenuList>
              </Menu>
            </Flex>

            {/* User information */}
            <Box minWidth={0} flex="1" overflow="hidden">
              <Text
                color="gray.800"
                fontSize="0.9rem"
                fontWeight={700}
                lineHeight="1.2"
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                {user?.firstName} {user?.lastName}
              </Text>

              <Text
                mt="3px"
                color="gray.600"
                fontWeight="500"
                fontSize="0.78rem"
                lineHeight="1.2"
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                {user?.email}
              </Text>
            </Box>
          </Flex>
        </Box>
      </Flex>

      {/* =====================================================
    LOWER APPLICATION BAR
===================================================== */}
      <Flex
        position="fixed"
        bottom="0"
        left="0"
        width="100vw"
        height={{ base: "46px", md: "52px" }}
        bg="gray.200"
        borderTop="1px solid"
        borderColor="#D1D9E0"
        align="center"
        zIndex={1000}
        display="grid"
        gridTemplateColumns="1fr auto 1fr"
        px={{ base: "12px", md: "16px" }}
      >
        {/* =================================================
      LEFT: COMPANY NAME
  ================================================= */}
        <Text
          justifySelf="start"
          fontSize={{ base: "1rem", md: "1.1rem" }}
          fontWeight="700"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
          minWidth={0}
          fontFamily="heading"
        >
          AKILI
        </Text>

        {/* =================================================
      CENTER: SYNC STATUS
  ================================================= */}
        <Flex justifySelf="center" align="center" minWidth="0">
          <SyncStatus
            onSync={async () => await window.electron.sync(user.companyId)}
          />
        </Flex>

        {/* =================================================
      RIGHT: DATE + TIME
  ================================================= */}
        <HStack
          justifySelf="end"
          justify="flex-end"
          spacing={{ base: 1, md: 3 }}
          width="auto"
          flexShrink={0}
        >
          {/* Date */}
          <Flex align="center" gap={1} whiteSpace="nowrap">
            <CiCalendarDate color="#0078D4" size={22} />

            <Text color="gray.900" fontSize={{ base: "0.75rem", md: "0.9rem" }}>
              {time.toLocaleDateString("fr-FR")}
            </Text>
          </Flex>

          {/* Time */}
          <Flex align="center" gap={1} whiteSpace="nowrap">
            <CiClock2 color="#0078D4" size={22} />

            <Text color="gray.900" fontSize={{ base: "0.75rem", md: "0.9rem" }}>
              {String(time.getHours()).padStart(2, "0")}:
              {String(time.getMinutes()).padStart(2, "0")}
            </Text>
          </Flex>
        </HStack>
      </Flex>
    </>
  );
};

export default EmployeeNavBar;
