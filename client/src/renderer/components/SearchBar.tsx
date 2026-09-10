import { Input, InputGroup, InputLeftElement } from "@chakra-ui/react";
import { useRef } from "react";
import { SlMagnifier } from "react-icons/sl";

interface Props {
  placeholderText: string;
  onSearch: (searchText: string) => void;
}

const SearchBar = ({ placeholderText, onSearch }: Props) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      onChange={(e) => {
        e.preventDefault();
        if (ref.current) onSearch(ref.current?.value);
      }}
    >
      <InputGroup>
        <InputLeftElement
          mt="0.2rem"
          children={<SlMagnifier size="1.2rem" color="gray" />}
        />
        <Input
          ref={ref}
          borderRadius="5px"
          borderWidth="0.3px"
          border="1px solid #A0AEC0"
          boxShadow="0 2px 10px rgba(15,23,42,.06)"
          bg="#FFFFFF"
          placeholder={placeholderText}
          _placeholder={{ color: "gray", fontSize: "1rem", fontWeight: "500" }}
          variant="filled"
          width="28vw"
          height="45px"
          textColor="black"
          _focus={{ bg: "#FFFFFF" }}
          _hover={{ bg: "#FFFFFF", borderColor: "gray.600" }}
        />
      </InputGroup>
    </form>
  );
};

export default SearchBar;
