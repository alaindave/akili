import { Box, Flex, Icon as ChakraIcon, Text } from "@chakra-ui/react";
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
      gap={4}
      mb={3}
      p={5}
      w="100%"
      minH="3rem"
      maxH="4.5rem"
      bg="#F8F9FB"
      borderRadius="12px"
      borderWidth="2px"
      borderColor="gray.200"
    >
      <Box
        p={3}
        borderWidth="2px"
        borderRadius="full"
        borderColor="blue.400"
        bg="rgba(242,183,5,0.08)"
        flexShrink={0}
        height="1.5rem"
        width="1.5rem"
        position="relative"
      >
        <ChakraIcon
          as={icon}
          color="blue.600"
          fontSize="1.1rem"
          position="relative"
          bottom="0.6rem"
          right="0.5rem"
        />
      </Box>

      <Box flex="1" minW={0} ml="0.3rem">
        <Text
          color="gray.700"
          fontWeight="700"
          fontSize={{ base: "1rem", md: "1rem", lg: "1rem" }}
        >
          {property}
        </Text>

        <Text
          color="gray.600"
          fontSize={{ base: "1rem", md: "1.1rem", lg: "1.1rem" }}
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
