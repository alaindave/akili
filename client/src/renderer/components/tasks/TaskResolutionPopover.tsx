import { useRef, useState } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  PopoverHeader,
  Textarea,
  Button,
  useDisclosure,
} from "@chakra-ui/react";

interface Props {
  onSubmit: (notes: string | undefined) => Promise<boolean>;
}

const TaskResolutionPopover = ({ onSubmit }: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [notes, setNotes] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      console.log("Notes to save:", notes);
      const success = await onSubmit(notes);
      if (success) {
        setIsSubmitting(false);
        setNotes("");
        onClose();
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      placement="left"
      closeOnBlur={false}
      initialFocusRef={textareaRef}
    >
      <PopoverTrigger>
        <Button
          colorScheme="green"
          bg="green.600"
          color="white"
          _hover={{ bg: "green.700" }}
          _active={{ bg: "green.800" }}
          borderRadius="2px"
        >
          Résoudre
        </Button>
      </PopoverTrigger>

      <PopoverContent
        position="relative"
        top="4rem"
        bg="white"
        borderColor="#d4d4d4"
        color="#262626"
      >
        <PopoverArrow />

        <PopoverHeader>Notes de résolution</PopoverHeader>

        <PopoverBody>
          <Textarea
            ref={textareaRef}
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes de résolution..."
            bg="white"
            color="#262626"
            borderColor="#d4d4d4"
            focusBorderColor="green.600"
            resize="none"
            minH="100px"
          />

          <Button
            mt={3}
            size="sm"
            colorScheme="green"
            bg="green.600"
            color="white"
            _hover={{ bg: "green.700" }}
            _active={{ bg: "green.800" }}
            onClick={handleSave}
            isLoading={isSubmitting}
            loadingText="Patientez..."
            spinnerPlacement="start"
            isDisabled={isSubmitting}
          >
            Sauvegarder
          </Button>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default TaskResolutionPopover;
