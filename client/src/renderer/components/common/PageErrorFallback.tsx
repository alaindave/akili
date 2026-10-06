import { Text, Flex } from "@chakra-ui/react";

const PageErrorFallback = () => {
  return (
    <Flex h="100vh" justify="center" align="center">
      <Text color="red.400" fontWeight="500" fontSize="1.4rem">
        Une erreur est survenue. Veuillez contacter ADB Tech.
      </Text>
    </Flex>
  );
};

export default PageErrorFallback;
