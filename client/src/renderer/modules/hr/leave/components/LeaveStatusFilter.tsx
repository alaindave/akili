import {
  Box,
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { GoDotFill } from "react-icons/go";

interface Props {
  onFilterClicked: (filter: string) => void;
}

const LeaveStatusFilter = ({ onFilterClicked }: Props) => {
  const [filter, setFilter] = useState("");

  return (
    <Menu>
      <MenuButton
        bg="#FFFFFF"
        width="300px"
        as={Button}
        leftIcon={<GoDotFill color="black" />}
        border="1px solid #E2E8F0"
        boxShadow="0 2px 10px rgba(15,23,42,.06)"
        _hover={{ bg: "transparent" }}
      >
        <Text color="gray.800">{filter || "Trier par statut"}</Text>
      </MenuButton>
      <MenuList
        backgroundColor="#ffffff"
        borderColor="rgba(255,196,0,0.18)"
        borderRadius="18px"
        position="relative"
        overflowY="auto"
        _hover={{ color: "yellow" }}
      >
        <MenuItem
          color="gray.800"
          fontSize="1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("");
            setFilter("Toute la liste");
          }}
        >
          <Box>
            <GoDotFill />
          </Box>
          <Text ml="1rem"> Tout afficher</Text>
        </MenuItem>
        <MenuItem
          color="gray.800"
          fontSize="1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("ATTENTE_APPROBATION");
            setFilter("Attente d'approvation");
          }}
        >
          <Box>
            <GoDotFill />
          </Box>
          <Text ml="1rem">Attente d'approbation</Text>
        </MenuItem>
        <MenuItem
          color="gray.800"
          fontSize="1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("APPROUVÉ");
            setFilter("Approuvé");
          }}
        >
          <Box>
            <GoDotFill />
          </Box>
          <Text ml="1rem">Approuvé</Text>
        </MenuItem>
        <MenuItem
          color="gray.800"
          fontSize="1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("REFUSÉ");
            setFilter("Refusé");
          }}
        >
          <Box>
            <GoDotFill />
          </Box>
          <Text ml="1rem">Refusé</Text>
        </MenuItem>
        <MenuItem
          color="gray.800"
          fontSize="1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("ANNULÉ");
            setFilter("Annulé");
          }}
        >
          <Box>
            <GoDotFill />
          </Box>
          <Text ml="1rem">Annulé</Text>
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

export default LeaveStatusFilter;
