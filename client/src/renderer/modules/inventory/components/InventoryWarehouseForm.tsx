import { useRef, useState, type FormEvent } from "react";
import {
  Alert, AlertIcon, Button, FormControl, FormLabel, Input, Modal,
  ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Select, Stack, Switch, Textarea, Text,
} from "@chakra-ui/react";
import type { InventoryWarehouse, InventoryLocation } from "../../../../common/types/inventory/InventoryWarehouse";

export const warehouseTypeLabels: Record<InventoryWarehouse["type"], string> = {
  RAW_MATERIAL: "Matières premières",
  PRODUCTION: "Production",
  FINISHED_GOODS: "Produits finis",
  GENERAL: "Général",
  OTHER: "Autre",
};

export default function InventoryWarehouseForm({ companyId, warehouse, locations, onEditLocation, onClose, onSaved }: {
  companyId: string;
  warehouse?: InventoryWarehouse;
  locations?: InventoryLocation[];
  onEditLocation?: (location: InventoryLocation) => void;
  onClose: () => void;
  onSaved: (warehouse: InventoryWarehouse) => void;
}) {
  const [code, setCode] = useState(warehouse?.code ?? "");
  const [name, setName] = useState(warehouse?.name ?? "");
  const [type, setType] = useState<InventoryWarehouse["type"]>(warehouse?.type ?? "GENERAL");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [description, setDescription] = useState(warehouse?.description ?? "");
  const [isActive, setIsActive] = useState(warehouse?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const initialFocusRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!name.trim() || (warehouse && !code.trim())) {
      setError(warehouse ? "Le code et le nom sont obligatoires." : "Le nom est obligatoire.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const input = {
        code: code.trim(), name: name.trim(), type, address: address.trim(),
        description: description.trim(), isActive,
      };
      const saved = warehouse
        ? await window.electron.inventory.warehouses.update(companyId, warehouse._id, input)
        : await window.electron.inventory.warehouses.create(companyId, input);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes("Un entrepôt avec ce code existe déjà")
        ? "Un entrepôt avec ce code existe déjà. Choisissez un autre code."
        : "Impossible d’enregistrer l’entrepôt. Veuillez réessayer.");
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
        <ModalHeader>{warehouse ? "Modifier l’entrepôt" : "Nouvel entrepôt"}</ModalHeader>
        <ModalCloseButton isDisabled={saving} />
        <ModalBody>
          <Stack spacing={4}>
            {locations && onEditLocation && <FormControl isDisabled={saving}>
              <FormLabel>Élément à modifier</FormLabel>
              <Select value="" onChange={e => { const entry = locations.find(location => location._id === e.target.value); if (entry) onEditLocation(entry); }}>
                <option value="">Entrepôt · {warehouse?.name}</option>
                {locations.map(location => <option key={location._id} value={location._id}>{location.name} ({location.code})</option>)}
              </Select>
              <Text fontSize="xs" color="gray.500" mt={1}>Sélectionnez un emplacement pour modifier ses informations.</Text>
            </FormControl>}
            {error && <Alert status="error"><AlertIcon />{error}</Alert>}
            <FormControl isRequired isDisabled={saving}>
              <FormLabel>Nom</FormLabel>
              <Input ref={initialFocusRef} value={name} onChange={e => setName(e.target.value)} maxLength={255} placeholder="Entrepôt principal" />
            </FormControl>
            {warehouse && <FormControl isRequired isDisabled={saving}>
              <FormLabel>Code</FormLabel>
              <Input value={code} onChange={e => setCode(e.target.value)} maxLength={100} placeholder="ENT-001" />
            </FormControl>}
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
          <Button type="submit" colorScheme="yellow" isLoading={saving}>{warehouse ? "Enregistrer" : "Créer l’entrepôt"}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
