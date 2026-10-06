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
import { FaSlidersH } from "react-icons/fa";
import { FcHighPriority } from "react-icons/fc";
import { FcMediumPriority } from "react-icons/fc";
import { FcLowPriority } from "react-icons/fc";
import { MdTask } from "react-icons/md";

interface Props {
  onFilterClicked: (filter: string) => void;
}

const TaskPriorityFilter = ({ onFilterClicked }: Props) => {
  const [filter, setFilter] = useState("");

  return (
    <Menu>
      <MenuButton
        bg="#FFFFFF"
        width="300px"
        as={Button}
        leftIcon={<FaSlidersH color="black" />}
        border="1px solid #E2E8F0"
        boxShadow="0 2px 10px rgba(15,23,42,.06)"
        _hover={{ bg: "transparent" }}
      >
        <Text color="gray.800">{filter || "Trier par priorité"}</Text>
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
            setFilter("Toutes les taches");
          }}
        >
          <Box>
            <MdTask size="20px" />
          </Box>
          <Text ml="1rem"> Toutes les taches</Text>
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
            onFilterClicked("HAUTE");
            setFilter("Haute");
          }}
        >
          <Box>
            <FcHighPriority />
          </Box>
          <Text ml="1rem">Haute</Text>
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
            onFilterClicked("MOYENNE");
            setFilter("Moyenne");
          }}
        >
          <Box>
            <FcMediumPriority />
          </Box>
          <Text ml="1rem">Moyenne</Text>
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
            onFilterClicked("BASSE");
            setFilter("Basse");
          }}
        >
          <Box>
            <FcLowPriority />
          </Box>
          <Text ml="1rem"> Basse</Text>
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

export default TaskPriorityFilter;
