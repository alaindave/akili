import React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Text,
  VStack,
  Badge,
} from "@chakra-ui/react";

interface Props {
  subject: string;
  notes: string;
}

const LeaveNotesPopover = ({ subject, notes }: Props) => {
  return (
    <Popover trigger="hover" placement="right">
      <PopoverTrigger>
        <Text
          color="gray.600"
          fontWeight="500"
          fontSize="1rem"
          cursor="pointer"
          _hover={{
            color: "#F2B705",
          }}
          whiteSpace="normal"
          wordBreak="break-word"
          maxW="7.5rem"
        >
          {subject}
        </Text>
      </PopoverTrigger>

      <PopoverContent
        bg="#F8F9FB"
        borderColor="#22345F"
        color="white"
        width="320px"
      >
        <PopoverArrow bg="#08162b" />

        <PopoverBody>
          <Text
            color="gray.800"
            fontSize="1rem"
            whiteSpace="normal"
            wordBreak="break-word"
            noOfLines={2}
          >
            <strong>Notes:</strong> {notes}
          </Text>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default LeaveNotesPopover;
