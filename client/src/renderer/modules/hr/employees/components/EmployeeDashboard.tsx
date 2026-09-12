import { Box, Card, Divider, Flex, HStack, Text } from "@chakra-ui/react";
import { BsFillPeopleFill } from "react-icons/bs";
import { CiCalendarDate, CiClock2 } from "react-icons/ci";
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
  return (
    <Flex justify="space-evenly">
      <Box
        bg="linear-gradient(
          135deg,
          rgba(255,255,255,0.08),
          rgba(255,255,255,0.03)
        )"
        border="1px solid rgba(255,255,255,0.12)"
        boxShadow="0 2px 8px rgba(0,0,0,0.5)"
        borderRadius="0.4rem"
        width="10rem"
        height="8rem"
      >
        <HStack position="relative" top="30px">
          <Box
            width="2rem"
            height="2rem"
            backgroundColor="#000080"
            borderRadius="15px"
            padding="8px"
            marginLeft="8px"
          >
            <BsFillPeopleFill color="#ffffff" size="1.2rem" />
          </Box>

          <Text
            color="gray.700"
            fontSize="1.3rem"
            fontWeight="700"
            position="relative"
            left="1rem"
          >
            Total
          </Text>
        </HStack>

        <Text
          color="black"
          fontSize="1.5rem"
          position="relative"
          left="5.5rem"
          top="1.9rem"
          fontWeight="700"
        >
          {employeeCount}
        </Text>
      </Box>

      <Box
        bg="linear-gradient(
        135deg,
        rgba(255,255,255,0.08),
        rgba(255,255,255,0.03)
      )"
        boxShadow="0 2px 8px rgba(0,0,0,0.5)"
        padding="32px"
        borderRadius="0.4rem"
        width="10.3rem"
        height="8rem"
      >
        <HStack>
          <Box
            width="2rem"
            height="2rem"
            position="relative"
            right="1.3rem"
            padding="10px"
            borderRadius="15px"
            backgroundColor=" #16833e"
          >
            <MdCoPresent color="#ffffff" size="1rem" />
          </Box>
          <Text
            color="gray.700"
            fontSize="1.3rem"
            fontWeight="700"
            position="relative"
            right="1rem"
          >
            Présents
          </Text>
        </HStack>
        <Text
          color="black"
          fontSize="1.5rem"
          position="relative"
          left="4rem"
          fontWeight="700"
        >
          {attendanceCount}
        </Text>
      </Box>
      <Box
        bg="linear-gradient(
          135deg,
          rgba(255,255,255,0.08),
          rgba(255,255,255,0.03)
        )"
        boxShadow="0 2px 8px rgba(0,0,0,0.5)"
        padding="30px"
        borderRadius="0.4rem"
        width="10rem"
        height="8rem"
      >
        <HStack>
          <Box
            width="2rem"
            height="2rem"
            backgroundColor="red.500"
            borderRadius="15px"
            padding="8px"
            position="relative"
            right="1rem"
          >
            <FaRegClock color="#ffffff" size="1.1rem" />
          </Box>
          <Text
            color="gray.700"
            fontWeight="700"
            fontSize="1.3rem"
            marginLeft="0.8rem"
            position="relative"
            right="1.5rem"
          >
            Retards
          </Text>
        </HStack>
        <Text
          color="black"
          fontSize="1.5rem"
          position="relative"
          left="4rem"
          fontWeight="700"
        >
          {lateCount}
        </Text>
      </Box>
      <Box
        bg="linear-gradient(
          135deg,
          rgba(255,255,255,0.08),
          rgba(255,255,255,0.03)
        )"
        boxShadow="0 2px 8px rgba(0,0,0,0.5)"
        padding="30px"
        borderRadius="0.4rem"
        width="10rem"
        height="8rem"
      >
        <HStack>
          <Box
            width="2rem"
            height="2rem"
            borderRadius="15px"
            padding="8px"
            backgroundColor="blue.500"
            position="relative"
            right="1rem"
          >
            <CiCalendarDate color="#ffffff" size="1.1rem" />
          </Box>
          <Text
            color="gray.700"
            fontWeight="700"
            fontSize="1.3rem"
            position="relative"
            right="1rem"
          >
            Congés
          </Text>
        </HStack>
        <Text
          color="black"
          fontSize="1.5rem"
          position="relative"
          left="4rem"
          fontWeight="700"
        >
          {leaveCount}
        </Text>
      </Box>
    </Flex>
  );
};

export default EmployeeDashboard;
