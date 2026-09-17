import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Textarea,
  Button,
  useDisclosure,
  Portal,
} from "@chakra-ui/react";
import { useErrorToast } from "../../../../hooks/useErrorToast";

interface Props {
  onSubmit: (notes: string | undefined) => Promise<boolean>;
  existingNotes?: string | undefined;
}

const AddClockInNotesPopover = ({ onSubmit, existingNotes }: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [lateNote, setLateNote] = useState(existingNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showErrorMessage = useErrorToast();

  useEffect(() => {
    setLateNote(existingNotes);
  }, [existingNotes]);

  const close = () => {
    setLateNote("");
    onClose();
  };

  const handleSave = async () => {
    setLateNote("");
    setIsSubmitting(true);

    try {
      console.log("NOTES TO SAVE:", lateNote);
      const success = await onSubmit(lateNote);
      if (success) {
        setIsSubmitting(false);
        onClose();
      }
    } catch (error) {
      console.error("FAILED TO SAVE LATE NOTES:", error);
      showErrorMessage(
        "Échec d'enregistrement",
        error,
        "Impossible d'enregistrer les notes."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={close}
      placement="right"
      closeOnBlur={false}
      initialFocusRef={textareaRef}
    >
      <PopoverTrigger>
        <Badge bg="#DD6B20" color="gray.200" fontSize="14px" cursor="pointer">
          En retard
        </Badge>
      </PopoverTrigger>
      <Portal>
        <PopoverContent
          bg="#0E1E47"
          borderColor="#22345F"
          color="white"
          w="320px"
        >
          <PopoverArrow />

          <PopoverBody>
            <Textarea
              ref={textareaRef}
              value={lateNote ?? ""}
              onChange={(e) => setLateNote(e.target.value)}
              placeholder="Raison du retard..."
              bg="#08162b"
              color="white"
              resize="none"
              minH="100px"
            />

            <Button
              mt={3}
              size="sm"
              colorScheme="yellow"
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
      </Portal>
    </Popover>
  );
};

export default AddClockInNotesPopover;
