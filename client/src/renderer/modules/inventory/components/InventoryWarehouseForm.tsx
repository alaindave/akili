import { useRef, useState, type FormEvent } from "react";
import {
  Alert, AlertIcon, Button, FormControl, FormLabel, Input, Modal,
  ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Select, Stack, Switch, Textarea,
} from "@chakra-ui/react";
import type { InventoryWarehouse } from "../../../../common/types/inventory/InventoryWarehouse";

export const warehouseTypeLabels: Record<InventoryWarehouse["type"], string> = {
  RAW_MATERIAL: "Matières premières",
  PRODUCTION: "Production",
  FINISHED_GOODS: "Produits finis",
  GENERAL: "Général",
  OTHER: "Autre",
};

export default function InventoryWarehouseForm({ companyId, onClose, onSaved }: {
  companyId: string;
  onClose: () => void;
  onSaved: (warehouse: InventoryWarehouse) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<InventoryWarehouse["type"]>("GENERAL");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const initialFocusRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!code.trim() || !name.trim()) {
      setError("Le code et le nom sont obligatoires.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const warehouse = await window.electron.inventory.warehouses.create(companyId, {
        code: code.trim(), name: name.trim(), type, address: address.trim(),
        description: description.trim(), isActive,
      });
      onSaved(warehouse);
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes("Un entrepôt avec ce code existe déjà")
        ? "Un entrepôt avec ce code existe déjà. Choisissez un autre code."
        : "Impossible de créer l’entrepôt. Veuillez réessayer.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={saving ? () => {} : onClose} size="lg" initialFocusRef={initialFocusRef}
      closeOnOverlayClick={!saving} closeOnEsc={!saving}>
      <ModalOverlay />
      <ModalContent as="form" onSubmit={submit}>
        <ModalHeader>Nouvel entrepôt</ModalHeader>
        <ModalCloseButton isDisabled={saving} />
        <ModalBody>
          <Stack spacing={4}>
            {error && <Alert status="error"><AlertIcon />{error}</Alert>}
            <FormControl isRequired isDisabled={saving}>
              <FormLabel>Code</FormLabel>
              <Input ref={initialFocusRef} value={code} onChange={e => setCode(e.target.value)} maxLength={100} placeholder="ENT-001" />
            </FormControl>
            <FormControl isRequired isDisabled={saving}>
              <FormLabel>Nom</FormLabel>
              <Input value={name} onChange={e => setName(e.target.value)} maxLength={255} placeholder="Entrepôt principal" />
            </FormControl>
            <FormControl isRequired isDisabled={saving}>
              <FormLabel>Type</FormLabel>
              <Select value={type} onChange={e => setType(e.target.value as InventoryWarehouse["type"])}>
                {Object.entries(warehouseTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </FormControl>
            <FormControl isDisabled={saving}>
              <FormLabel>Adresse</FormLabel>
              <Input value={address} onChange={e => setAddress(e.target.value)} maxLength={500} />
            </FormControl>
            <FormControl isDisabled={saving}>
              <FormLabel>Description</FormLabel>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} />
            </FormControl>
            <FormControl display="flex" alignItems="center" isDisabled={saving}>
              <FormLabel htmlFor="warehouse-active" mb={0}>Entrepôt actif</FormLabel>
              <Switch id="warehouse-active" colorScheme="yellow" isChecked={isActive} onChange={e => setIsActive(e.target.checked)} />
            </FormControl>
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="outline" onClick={onClose} isDisabled={saving}>Annuler</Button>
          <Button type="submit" colorScheme="yellow" isLoading={saving}>Créer l’entrepôt</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
