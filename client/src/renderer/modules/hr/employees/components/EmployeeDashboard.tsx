import { Box, Flex, HStack, SimpleGrid, Text } from "@chakra-ui/react";
import { BsFillPeopleFill } from "react-icons/bs";
import { CiCalendarDate } from "react-icons/ci";
import { MdCoPresent } from "react-icons/md";
import { FaRegClock } from "react-icons/fa6";

interface Props {
  employeeCount: number;
  attendanceCount: number;
  leaveCount: number;
  lateCount: number;
}

const EmployeeDashboard = ({
  employeeCount,
  attendanceCount,
  lateCount,
  leaveCount,
}: Props) => {
  const metrics = [
    { label: "Total", value: employeeCount, icon: BsFillPeopleFill, color: "#000080" },
    { label: "Présents", value: attendanceCount, icon: MdCoPresent, color: "#16833e" },
    { label: "Retards", value: lateCount, icon: FaRegClock, color: "red.500" },
    { label: "Congés", value: leaveCount, icon: CiCalendarDate, color: "blue.500" },
  ];

  return (
    <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={6} flexShrink={0}>
      {metrics.map(({ label, value, icon: Icon, color }) => (
        <Box
          key={label}
          bg="linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))"
          border="1px solid rgba(255,255,255,0.12)"
          boxShadow="0 2px 8px rgba(0,0,0,0.5)"
          borderRadius="0.4rem"
          p={5}
          minH="8rem"
          minW={0}
        >
          <HStack spacing={3} flexWrap="wrap">
            <Flex
              bg={color}
              color="white"
              borderRadius="15px"
              boxSize="36px"
              align="center"
              justify="center"
              flexShrink={0}
            >
              <Icon aria-hidden="true" />
            </Flex>
            <Text color="gray.700" fontWeight="700" fontSize="1.1rem">
              {label}
            </Text>
          </HStack>
          <Text
            color="black"
            fontSize="1.5rem"
            fontWeight="700"
            textAlign="right"
            mt={3}
          >
            {value.toLocaleString("fr-FR")}
          </Text>
        </Box>
      ))}
    </SimpleGrid>
  );
};

export default EmployeeDashboard;
