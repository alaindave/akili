import {
  Badge,
  Box,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { Attendance } from "../../../../../common/types/attendance/Attendance";

interface Props {
  attendance: Attendance;
}

const AttendanceNotesPopover = ({ attendance }: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const statusColor = {
    PONCTUEL: "green",
    RETARD: "orange",
    ABSENT: "red",
    CONGÉ: "blue",
  } as const;

  if (!attendance.status) return;

  return (
    <>
      {attendance.notes ? (
        <Popover isOpen={isOpen} onClose={onClose} placement="left">
          <PopoverTrigger>
            <Box
              fontSize="18px"
              color="#FF8787"
              cursor="pointer"
              _hover={{
                color: "#F2B705",
              }}
              onMouseEnter={onOpen}
              onMouseLeave={onClose}
            >
              <Badge
                mr="0.3rem"
                mb="1rem"
                bg={statusColor[attendance.status]}
                color="gray.200"
                fontSize="14px"
              >
                {attendance.status}
              </Badge>
            </Box>
          </PopoverTrigger>
          <PopoverContent
            onMouseEnter={onOpen}
            onMouseLeave={onClose}
            bg="#F8F9FB"
            color="white"
            position="relative"
            right="1rem"
            maxHeight="5rem"
          >
            <PopoverArrow bg="#08162b" />

            <PopoverBody>
              {attendance?.notes && (
                <Text
                  position="relative"
                  color="gray.700"
                  whiteSpace="normal"
                  wordBreak="break-word"
                  minW="10rem"
                  minH="5rem"
                  noOfLines={3}
                >
                  <strong>Justification:</strong> {attendance?.notes}
                </Text>
              )}
            </PopoverBody>
          </PopoverContent>
        </Popover>
      ) : (
        <Badge
          mr="0.3rem"
          bg={statusColor[attendance.status]}
          color="#ffffff"
          fontSize="14px"
        >
          {attendance.status}
        </Badge>
      )}
    </>
  );
};

export default AttendanceNotesPopover;
