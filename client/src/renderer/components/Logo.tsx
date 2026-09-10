import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
// @ts-ignore
import logo from "../assets/afritan_logo.png";
import "../styles/App.css";

interface Props {
  text: string;
}

const Logo = ({ text }: Props) => {
  return (
    <Flex
      align="center"
      width="fit-content"
      maxWidth="100%"
      gap={{ base: "4px", sm: "6px", md: "8px" }}
    >
      {/* Logo */}
      <Link to="/admin">
        <Image
          src={logo}
          width={{ base: "4rem", sm: "4.5rem", md: "5rem" }}
          height={{ base: "4rem", sm: "4.5rem", md: "5rem" }}
          objectFit="contain"
        />
      </Link>

      {/* Text */}
      <Box
        minWidth={0}
        display="flex"
        flexDirection="column"
        justifyContent="center"
      >
        {/* Company name */}
        <Text
          color="#1F2937"
          fontSize={{ base: "20px", sm: "22px", md: "25px" }}
          fontWeight="700"
          lineHeight="1.1"
          whiteSpace="nowrap"
        >
          AFRITAN
        </Text>

        {/* Subtitle */}
        <Text
          marginTop={{ base: "1px", sm: "1px", md: "2px" }}
          mr="0.8rem"
          fontSize={{ base: "0.7rem", sm: "0.8rem", md: "0.85rem" }}
          lineHeight="1.3"
          color="gray.800"
          fontWeight="400"
          whiteSpace="nowrap"
        >
          {text}
        </Text>
      </Box>
    </Flex>
  );
};

export default Logo;
