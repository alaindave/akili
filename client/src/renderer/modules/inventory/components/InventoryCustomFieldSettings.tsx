import { useRef, useState, type FormEvent } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  Stack,
  List,
  ListItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Text,
} from "@chakra-ui/react";
import {
  inventoryCustomFieldEntities,
  type InventoryCustomFieldEntity,
} from "../../../../common/types/inventory/InventoryCustomField";
import {
  CustomFieldsLoadStatus,
  useInventoryCustomFields,
} from "./InventoryCustomFields";

export default function InventoryCustomFieldSettings({
  companyId,
  onCreated,
}: {
  companyId: string;
  onCreated: () => void;
}) {
  const fields = useInventoryCustomFields(companyId);
  const [entity, setEntity] = useState<InventoryCustomFieldEntity | "">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const working = useRef(false);
  function closeModal() {
    if (working.current) return;
    setIsOpen(false);
    setLabel("");
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working.current || fields.loading || fields.error || !entity) return;
    if (!label.trim()) {
      setError("Le libellé est obligatoire.");
      return;
    }
    working.current = true;
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await window.electron.inventory.settings.updateCustomField(companyId, {
          id: editingId,
          label: label.trim(),
        });
      } else {
        await window.electron.inventory.settings.createCustomField(companyId, {
          entity,
          label: label.trim(),
        });
      }
      setLabel("");
      setIsOpen(false);
      fields.reload();
      onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible d’ajouter le champ."
      );
    } finally {
      working.current = false;
      setSaving(false);
    }
  }
  const selected = fields.fields.filter((field) => field.entity === entity);
  async function archiveField(id: string) {
    if (working.current) return;
    working.current = true;
    setSaving(true);
    setError("");
    try {
      await window.electron.inventory.settings.archiveCustomField(
        companyId,
        id
      );
      fields.reload();
      onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible d’archiver le champ."
      );
    } finally {
      working.current = false;
      setSaving(false);
    }
  }
  return (
    <Box
      bg="white"
      border="1px solid #E5E5E5"
      borderRadius="12px"
      p={{ base: 4, md: 6 }}
    >
      <Stack spacing={4} maxW="600px">
        <Flex align="center" justify="space-between" gap={3}>
          <Heading size="sm">Champs personnalisés</Heading>
          <Select
            maxW="260px"
            aria-label="Élément concerné"
            placeholder="Sélectionnez un élément"
            value={entity}
            isDisabled={saving}
            onChange={(event) => {
              setEntity(event.target.value as InventoryCustomFieldEntity);
              setError("");
            }}
          >
            {Object.entries(inventoryCustomFieldEntities).map(
              ([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              )
            )}
          </Select>
        </Flex>
        <CustomFieldsLoadStatus state={fields} />
        {error && !isOpen && (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        )}
        {!!selected.length && (
          <List spacing={2} aria-label="Champs personnalisés configurés">
            {selected.map((field) => (
              <ListItem
                key={field._id}
                px={4}
                py={3}
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
                overflowWrap="anywhere"
              >
                <Flex
                  align="center"
                  justify="space-between"
                  gap={3}
                  flexWrap="wrap"
                >
                  <Text flex="1" minW={0}>
                    {field.label}
                  </Text>
                  <Flex gap={2}>
                    <Button
                      size="sm"
                      variant="outline"
                      isDisabled={saving}
                      onClick={() => {
                        setEditingId(field._id);
                        setLabel(field.label);
                        setError("");
                        setIsOpen(true);
                      }}
                    >
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      isDisabled={saving}
                      onClick={() => void archiveField(field._id)}
                    >
                      Archiver
                    </Button>
                  </Flex>
                </Flex>
              </ListItem>
            ))}
          </List>
        )}
        {!!entity && !fields.loading && !fields.error && !selected.length && (
          <Text color="gray.600">
            Aucun champ personnalisé pour cette élément.
          </Text>
        )}
        <Button
          alignSelf="start"
          colorScheme="blue"
          isDisabled={!entity || saving || fields.loading || !!fields.error}
          onClick={() => {
            setEditingId(null);
            setLabel("");
            setError("");
            setIsOpen(true);
          }}
        >
          Ajouter
        </Button>
      </Stack>
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        initialFocusRef={labelRef}
        closeOnOverlayClick={!saving}
        closeOnEsc={!saving}
      >
        <ModalOverlay />
        <ModalContent as="form" onSubmit={submit}>
          <ModalHeader>
            {editingId
              ? "Modifier le champ personnalisé"
              : "Ajouter un champ personnalisé"}
          </ModalHeader>
          <ModalCloseButton isDisabled={saving} />
          <ModalBody>
            <Stack spacing={4}>
              <Text color="gray.600">
                Élément concerné :{" "}
                {entity ? inventoryCustomFieldEntities[entity] : ""}
              </Text>
              {error && (
                <Alert status="error">
                  <AlertIcon />
                  {error}
                </Alert>
              )}
              <FormControl isRequired>
                <FormLabel>Champ</FormLabel>
                <Input
                  ref={labelRef}
                  value={label}
                  maxLength={100}
                  isDisabled={saving}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Ex. Référence fournisseur"
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={closeModal} isDisabled={saving}>
              Annuler
            </Button>
            <Button
              type="submit"
              colorScheme="blue"
              isLoading={saving}
              isDisabled={fields.loading || !!fields.error}
            >
              {editingId ? "Enregistrer" : "Ajouter"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
