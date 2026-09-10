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
import { IoIosArrowDown } from "react-icons/io";
import { FaSlidersH } from "react-icons/fa";

import { BsPeopleFill } from "react-icons/bs";
import { GiOfficeChair } from "react-icons/gi";
import { GiFactory } from "react-icons/gi";
import { MdOutlineHandyman } from "react-icons/md";
import { FaWarehouse } from "react-icons/fa6";
import { GiGuards } from "react-icons/gi";

interface Props {
  onFilterClicked: (department: string) => void;
}

const EmployeeFilterMenu = ({ onFilterClicked }: Props) => {
  const [filter, setFilter] = useState("");

  return (
    <Menu>
      <MenuButton
        bg="#FFFFFF"
        width="300px"
        as={Button}
        leftIcon={<FaSlidersH color="black" />}
        rightIcon={<IoIosArrowDown color="black" />}
        border="1px solid #A0AEC0"
        boxShadow="0 2px 10px rgba(15,23,42,.06)"
        _hover={{ bg: "transparent" }}
      >
        <Text color="gray.800">{filter || "Trier par département"}</Text>
      </MenuButton>
      <MenuList
        backgroundColor="#ffffff"
        borderColor="rgba(255,196,0,0.18)"
        borderRadius="18px"
        maxH="160px"
        ml="3rem"
        position="relative"
        left="18rem"
        bottom="10rem"
        overflowY="auto"
        _hover={{ color: "yellow" }}
      >
        <MenuItem
          color="gray.800"
          fontSize="1.1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("");
            setFilter("Tous les employés");
          }}
        >
          <Box>
            <BsPeopleFill size="20px" />
          </Box>
          <Text ml="0.8rem"> Tous les employés</Text>
        </MenuItem>
        <MenuItem
          color="gray.800"
          fontSize="1.1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("Administration");
            setFilter("Administration");
          }}
        >
          <Box>
            <GiOfficeChair />
          </Box>
          <Text ml="0.8rem">Administration</Text>
        </MenuItem>
        <MenuItem
          color="gray.800"
          fontSize="1.1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("Usine");
            setFilter("Usine");
          }}
        >
          <Box>
            <GiFactory />
          </Box>
          <Text ml="0.8rem">Usine</Text>
        </MenuItem>
        <MenuItem
          color="gray.800"
          fontSize="1.1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("Atelier");
            setFilter("Atelier");
          }}
        >
          <Box>
            <MdOutlineHandyman />
          </Box>
          <Text ml="0.8rem"> Atelier</Text>
        </MenuItem>
        <MenuItem
          color="gray.800"
          fontSize="1.1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("Magasin");
            setFilter("Magasin");
          }}
        >
          <Box>
            <FaWarehouse />
          </Box>
          <Text ml="0.8rem">Magasin</Text>
        </MenuItem>
        <MenuItem
          color="gray.800"
          fontSize="1.1rem"
          backgroundColor="#ffffff"
          _hover={{
            color: "#4F46E5",
            backgroundColor: "rgba(255,196,0,0.14)",
          }}
          onClick={() => {
            onFilterClicked("Sentinelle");
            setFilter("Sentinelle");
          }}
        >
          <Box>
            <GiGuards />
          </Box>
          <Text ml="0.8rem">Sentinelle</Text>
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

export default EmployeeFilterMenu;
