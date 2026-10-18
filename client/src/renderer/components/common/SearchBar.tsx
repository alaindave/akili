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
      style={{ width: "100%", minWidth: 0, margin: 0 }}
      onChange={(e) => {
        e.preventDefault();

        if (ref.current) {
          onSearch(ref.current.value);
        }
      }}
    >
      <InputGroup width="100%">
        <InputLeftElement
          pointerEvents="none"
          height="40px"
          children={<SlMagnifier size="1.2rem" color="gray" />}
        />

        <Input
          ref={ref}
          width="100%"
          minWidth="150px"
          maxWidth="100%"
          borderRadius="5px"
          border="1px solid #A0AEC0"
          boxShadow="0 2px 10px rgba(15,23,42,.06)"
          bg="#FFFFFF"
          placeholder={placeholderText}
          pl="2.5rem"
          _placeholder={{
            color: "gray",
            fontSize: "0.85rem",
            fontWeight: "500",
          }}
          variant="filled"
          height="40px"
          color="black"
          _focus={{
            bg: "#FFFFFF",
            borderColor: "#718096",
          }}
          _hover={{
            bg: "#FFFFFF",
            borderColor: "gray.600",
          }}
        />
      </InputGroup>
    </form>
  );
};

export default SearchBar;
