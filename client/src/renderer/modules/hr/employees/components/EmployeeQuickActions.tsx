import {
  Box,
  Button,
  Center,
  HStack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { CiCalendarDate } from "react-icons/ci";
import { FaSearch } from "react-icons/fa";
import { FaPlus } from "react-icons/fa6";
import { IoStatsChart } from "react-icons/io5";
import LeaveSubmissionModal from "../../leave/components/LeaveSubmissionModal";
import Employee from "../../../../../common/types/Employee";
import { useNavigate } from "react-router-dom";

interface Props {
  employees: Employee[];
  onTaskCreate: () => void;
}

const QuickActions = ({ onTaskCreate, employees }: Props) => {
  const {
    isOpen: isLeaveOpen,
    onOpen: onLeaveOpen,
    onClose: onLeaveClose,
  } = useDisclosure();

  const navigate = useNavigate();

  return (
    <Box
      bg="linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))"
      border="1px solid rgba(255,255,255,0.12)"
      boxShadow="0 2px 8px rgba(0,0,0,0.5)"
      borderRadius="md"
      h="50px"
      maxW="1050px"
      mx="auto"
      p={2}
    >
      <HStack spacing={4} align="center" h="full">
        {/* CREATE TASK */}
        <Button
          fontWeight="600"
          fontSize="0.95rem"
          whiteSpace={{ base: "normal", lg: "nowrap" }}
          overflow="hidden"
          textOverflow="ellipsis"
          bg="transparent"
          _hover={{ bg: "transparent" }}
        >
          <HStack
            flex="1"
            spacing={3}
            px={2}
            py={2}
            cursor="pointer"
            onClick={onTaskCreate}
          >
            <Center
              boxSize="1.8rem"
              bg="blue.400"
              color="white"
              borderRadius="md"
              flexShrink={0}
            >
              <FaPlus size={12} />
            </Center>

            <Text>Créer une nouvelle tâche</Text>
          </HStack>
        </Button>

        {/* SEARCH EMPLOYEE */}
        <Button
          fontWeight="600"
          fontSize="0.95rem"
          whiteSpace={{ base: "normal", lg: "nowrap" }}
          overflow="hidden"
          textOverflow="ellipsis"
          bg="transparent"
          _hover={{ bg: "transparent" }}
        >
          <HStack flex="1" spacing={3} px={2} py={2} cursor="pointer">
            <Center
              boxSize="1.8rem"
              bg="green.400"
              color="white"
              borderRadius="md"
              flexShrink={0}
            >
              <FaSearch size={12} />
            </Center>
            <Text>Rechercher un employé</Text>
          </HStack>
        </Button>

        {/* LEAVE */}
        <Button
          fontWeight="600"
          fontSize="0.95rem"
          whiteSpace={{ base: "normal", lg: "nowrap" }}
          overflow="hidden"
          textOverflow="ellipsis"
          bg="transparent"
          _hover={{ bg: "transparent" }}
          onClick={() => onLeaveOpen()}
        >
          <HStack flex="1" spacing={3} px={2} py={2} cursor="pointer">
            <Center
              boxSize="1.8rem"
              bg="purple.400"
              color="white"
              borderRadius="md"
              flexShrink={0}
            >
              <CiCalendarDate size={16} />
            </Center>
            <Text>Demande de congé</Text>
          </HStack>
        </Button>

        {/* REPORT */}
        <HStack
          flex="1"
          spacing={3}
          px={2}
          py={2}
          cursor="pointer"
          _hover={{ bg: "blackAlpha.100", borderRadius: "md" }}
        >
          <Center
            boxSize="1.8rem"
            bg="orange.400"
            color="white"
            borderRadius="md"
            flexShrink={0}
          >
            <IoStatsChart size={14} />
          </Center>

          <Text
            fontWeight="600"
            fontSize="0.95rem"
            whiteSpace={{ base: "normal", lg: "nowrap" }}
            overflow="hidden"
            textOverflow="ellipsis"
            onClick={() => navigate("/employees_admin/reports")}
          >
            Générer un rapport
          </Text>
        </HStack>
      </HStack>
      <LeaveSubmissionModal
        isOpen={isLeaveOpen}
        onClose={onLeaveClose}
        employees={employees}
      />
    </Box>
  );
};

export default QuickActions;
