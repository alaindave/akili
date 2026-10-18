import {
  Box, Button, Drawer, DrawerBody, DrawerCloseButton, DrawerContent,
  DrawerOverlay, Flex, useBreakpointValue, useDisclosure,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import EmployeeNavBar from "./EmployeeNavBar";

const EmployeeAdminLayout = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { pathname } = useLocation();

  useEffect(() => {
    onClose();
  }, [pathname, isMobile, onClose]);

  return (
    <Flex
      direction={{ base: "column", md: "row" }}
      height="100dvh"
      width="100%"
      bg="#F5F6F8"
      overflow="hidden"
    >
      {/* Mobile navigation leaves room for the page content. */}
      {isMobile ? (
        <>
          <Box flexShrink={0} px={4} py={2} borderBottom="1px solid" borderColor="gray.200">
            <Button size="sm" variant="outline" onClick={onOpen} aria-label="Ouvrir la navigation du personnel">
              Menu
            </Button>
          </Box>
          <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="xs">
            <DrawerOverlay />
            <DrawerContent>
              <DrawerCloseButton zIndex={1} />
              <DrawerBody p={0}>
                <EmployeeNavBar showBottomBar={false} />
              </DrawerBody>
            </DrawerContent>
          </Drawer>
          {/* Keep the existing lower application bar visible with the drawer closed. */}
          <EmployeeNavBar showSidebar={false} />
        </>
      ) : (
        <Box
          flexShrink={0}
          width={{ md: "210px", lg: "225px", xl: "240px" }}
          maxWidth="240px"
          overflow="hidden"
        >
          <EmployeeNavBar />
        </Box>
      )}

      {/* Page content */}
      <Box
        flex="1"
        minWidth={0}
        minHeight={0}
        width="100%"
        overflowY="auto"
        overflowX="hidden"
      >
        <Outlet />
      </Box>
    </Flex>
  );
};

export default EmployeeAdminLayout;
