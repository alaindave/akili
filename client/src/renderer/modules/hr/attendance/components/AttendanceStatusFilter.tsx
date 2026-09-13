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
import { MdTask } from "react-icons/md";

interface Props {
  onFilterClicked: (filter: string) => void;
}

const AttendanceStatusFilter = ({ onFilterClicked }: Props) => {
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
          <Text ml="1rem"> Afficher tout</Text>
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
            onFilterClicked("PONCTUEL");
            setFilter("A l'heure");
          }}
        >
          <Box>
            <GoDotFill />
          </Box>
          <Text ml="1rem">Ponctuel</Text>
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
            onFilterClicked("RETARD");
            setFilter("Retard");
          }}
        >
          <Box>
            <GoDotFill />
          </Box>
          <Text ml="1rem">Retard</Text>
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
            onFilterClicked("ABSENT");
            setFilter("Absent");
          }}
        >
          <Box>
            <GoDotFill />
          </Box>
          <Text ml="1rem">Absent</Text>
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
            onFilterClicked("CONGÉ");
            setFilter("Congé");
          }}
        >
          <Box>
            <GoDotFill />
          </Box>
          <Text ml="1rem">Congé</Text>
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

export default AttendanceStatusFilter;
