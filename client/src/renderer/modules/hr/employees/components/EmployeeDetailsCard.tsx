import { Box, Flex, Text } from "@chakra-ui/react";
import { IconType } from "react-icons";

interface Props {
  property: string;
  value?: string | number | null;
  icon: IconType;
}

const EmployeeDetailsCard = ({ property, value, icon }: Props) => {
  return (
    <Flex
      align="center"
      gap={{ base: 2, md: 4 }}
      mb={3}
      p={{ base: 3, md: 5 }}
      w="100%"
      minH="3rem"
      minW={0}
      bg="#F8F9FB"
      borderRadius="12px"
      borderWidth="2px"
      borderColor="gray.200"
    >
      <Box
        borderWidth="2px"
        borderRadius="0.45rem"
        borderColor="blue.400"
        bg="rgba(242,183,5,0.08)"
        flexShrink={0}
        height="0.88rem"
        width="0.88rem"
        position="relative"
      ></Box>

      <Box flex="1" minW={0} ml="0.3rem">
        <Text
          color="gray.700"
          fontWeight="700"
          fontSize={{ base: "0.9rem", md: "0.99rem" }}
          overflowWrap="anywhere"
        >
          {property}
        </Text>

        <Text
          color="gray.600"
          fontSize={{ base: "1rem", md: "1.04rem" }}
          wordBreak="break-word"
        >
          {value}
          {property === "Salaire" ? " FBU" : ""}
        </Text>
      </Box>
    </Flex>
  );
};

export default EmployeeDetailsCard;
