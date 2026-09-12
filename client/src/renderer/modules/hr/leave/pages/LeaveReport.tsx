import { Box, Flex, HStack, Text, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import LeaveHistoryTable from "../components/LeaveHistoryTable";
import { Link, useLocation } from "react-router-dom";
import Employee from "../../../../../common/types/Employee";
import Leave from "../../../../../common/types/Leave";
import { MdOutlineChevronRight } from "react-icons/md";
import { FaArrowLeftLong } from "react-icons/fa6";
import useAdminUser from "../../../../../store/auth.store";

type EmployeeState = {
  employee?: Employee;
};

type PhotoState = {
  photo_url?: string;
};

const EmployeeLeaveReport = () => {
  const location = useLocation();
  const { employee } = (location.state as EmployeeState) || {};
  const { photo_url } = (location.state as PhotoState) || "";
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const user = useAdminUser((store) => store.adminUser);

  useEffect(() => {
    async function getLeaveHistory() {
      if (!employee?._id) return;
      const leaves = await window.electron.leave.getLeaveByEmployeeId(
        user.companyId,
        employee?._id
      );
      console.log("Leave history fetched:", leaves);
      setLeaves(leaves);
    }
    getLeaveHistory();
  }, []);
  return (
    <Flex
      direction="column"
      bg="#F8FAFC"
      height="100%"
      width="100%"
      alignItems="flex-start"
    >
      {/* Header */}
      <HStack mt="1.4rem">
        <Link
          to={{
            pathname: `/employees_admin/employees_list/${employee?._id}`,
          }}
          state={{ photo_url }}
        >
          <Box
            ml="0.8rem"
            mb="2rem"
            p={2}
            border="1px solid #14376b"
            borderRadius="10px"
          >
            <FaArrowLeftLong color="black" />
          </Box>
        </Link>
        <Box>
          <HStack ml="0.3rem" position="relative" bottom="1rem">
            <Text fontSize="1.1rem" fontWeight="500">
              Employés
            </Text>
            <Box>
              <MdOutlineChevronRight fontSize="1.3rem" />
            </Box>
            <Text fontSize="1.05rem" fontWeight="500">
              {" "}
              {employee?.firstName} {employee?.lastName}
            </Text>
            <Box>
              <MdOutlineChevronRight fontSize="1.3rem" />
            </Box>
            <Text fontSize="1rem" fontWeight="500">
              Congés
            </Text>
          </HStack>
        </Box>
      </HStack>
      {leaves.length != 0 ? (
        <LeaveHistoryTable leaves={leaves} />
      ) : (
        <Flex
          ml="0.5rem"
          mt="10rem"
          width="80vw"
          minHeight={{
            base: "180px",
            md: "220px",
          }}
          align="center"
          justify="center"
          bg="#ffffff"
          border="1px solid #E2E8F0"
          borderRadius="8px"
          px="20px"
          flexShrink={0}
        >
          <Text
            fontSize={{
              base: "1rem",
              md: "1.1rem",
            }}
            fontWeight="500"
            color="gray.500"
            textAlign="center"
          >
            Aucune demande de congé retrouvée
          </Text>
        </Flex>
      )}
    </Flex>
  );
};

export default EmployeeLeaveReport;
