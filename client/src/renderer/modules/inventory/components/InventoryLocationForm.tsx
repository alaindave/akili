import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, AlertIcon, Button, FormControl, FormLabel, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Stack, Switch } from "@chakra-ui/react";
import type { InventoryLocation, InventoryWarehouse } from "../../../../common/types/inventory/InventoryWarehouse";

export const locationTypeLabels: Record<InventoryLocation["locationType"], string> = {
  ZONE: "Zone", RACK: "Rayon", BIN: "Bac", FLOOR: "Sol", OTHER: "Autre",
};
const codePrefixes = { ZONE: "Z", RACK: "R", BIN: "B", FLOOR: "S", OTHER: "A" };
const rank = { ZONE: 0, RACK: 1, BIN: 2, FLOOR: 2, OTHER: 2 };
export default function InventoryLocationForm({ companyId, warehouse, locations, location, onClose, onSaved }: {
  companyId: string; warehouse: InventoryWarehouse; locations: InventoryLocation[];
  location?: InventoryLocation; onClose: () => void; onSaved: () => void;
}) {
  const [code, setCode] = useState(location?.code ?? "");
  const [name, setName] = useState(location?.name ?? "");
  const [type, setType] = useState<InventoryLocation["locationType"]>(location?.locationType ?? "ZONE");
  const [parentId, setParentId] = useState(location?.parentId ?? "");
  const [isActive, setIsActive] = useState(location?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(!location);
  const [codeError, setCodeError] = useState("");
  const [codeVersion, setCodeVersion] = useState(0);
  useEffect(() => {
    if (location) return;
    let active = true;
    setCode("");
    setGenerating(true);
    setCodeError("");
    async function generate() {
      try {
        // Include deleted locations: their codes remain reserved by the database.
        let highest = 0;
        const prefix = codePrefixes[type];
        const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
        for (let offset = 0; ; offset += 100) {
          const entries = await window.electron.inventory.locations.list(companyId, {
            warehouseId: warehouse._id, includeDeleted: true, limit: 100, offset,
          });
          if (!active) return;
          entries.forEach(entry => {
            const match = entry.code.match(pattern);
            if (match) highest = Math.max(highest, Number(match[1]));
          });
          if (entries.length < 100) break;
        }
        if (highest >= 99) throw new Error("sequence-exhausted");
        if (active) setCode(`${prefix}-${String(highest + 1).padStart(2, "0")}`);
      } catch (cause) {
        if (active) setCodeError(cause instanceof Error && cause.message === "sequence-exhausted"
          ? "La séquence de codes à deux chiffres est épuisée pour ce type dans cet entrepôt."
          : "Impossible de générer le code. Veuillez réessayer.");
      } finally { if (active) setGenerating(false); }
    }
    void generate();
    return () => { active = false; };
  }, [companyId, warehouse._id, type, location, codeVersion]);
  const submitting = useRef(false);
  const focus = useRef<HTMLInputElement>(null);
  const descendants = new Set(location ? [location._id] : []);
  let added = true;
  while (added) {
    added = false;
    locations.forEach(entry => {
      if (entry.parentId && descendants.has(entry.parentId) && !descendants.has(entry._id)) { descendants.add(entry._id); added = true; }
    });
  }
  const parents = locations.filter(entry => !descendants.has(entry._id) && ["ZONE", "RACK"].includes(entry.locationType) && rank[entry.locationType] < rank[type]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || generating || codeError) return;
    if (!code.trim() || !name.trim()) { setError("Le code et le nom sont obligatoires."); return; }
    submitting.current = true; setSaving(true); setError("");
    try {
      const input = { warehouseId: warehouse._id, parentId: parentId || null, code: code.trim(), name: name.trim(), locationType: type, isActive };
      if (location) await window.electron.inventory.locations.update(companyId, location._id, input);
      else await window.electron.inventory.locations.create(companyId, input);
      onSaved();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const known = ["Un emplacement avec ce code existe déjà.", "Parent incompatible avec le type d’emplacement.", "Ce type est incompatible avec les emplacements enfants."];
      if (!location && message.includes("Un emplacement avec ce code existe déjà.")) {
        setCodeVersion(value => value + 1);
        setError("Ce code vient d’être utilisé. Un nouveau code sera généré ; veuillez enregistrer à nouveau.");
        return;
      }
      setError(known.find(text => message.includes(text)) ?? "Impossible d’enregistrer l’emplacement. Veuillez réessayer.");
    } finally { submitting.current = false; setSaving(false); }
  }
  return <Modal isOpen onClose={saving ? () => {} : onClose} size="lg" initialFocusRef={focus} closeOnOverlayClick={!saving} closeOnEsc={!saving}>
    <ModalOverlay /><ModalContent as="form" onSubmit={submit}>
      <ModalHeader>{location ? "Modifier l’emplacement" : "Nouvel emplacement"}</ModalHeader><ModalCloseButton isDisabled={saving} />
      <ModalBody><Stack spacing={4}>
        {error && <Alert status="error"><AlertIcon />{error}</Alert>}
        <FormControl><FormLabel>Entrepôt</FormLabel><Input value={`${warehouse.name} · ${warehouse.code}`} isReadOnly /></FormControl>
        <FormControl isRequired isDisabled={saving}><FormLabel>Type d’emplacement</FormLabel>
          <Select value={type} onChange={e => { setType(e.target.value as InventoryLocation["locationType"]); setParentId(""); if (!location) { setCode(""); setGenerating(true); } }}>
            {Object.entries(locationTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </FormControl>
        <FormControl isRequired isDisabled={saving}><FormLabel>Code de l’emplacement</FormLabel><Input value={code} isReadOnly={!location} bg={location ? undefined : "gray.50"} placeholder={generating ? "Génération du code…" : ""} onChange={e => setCode(e.target.value)} maxLength={100} /></FormControl>
        {codeError && <Alert status="error"><AlertIcon />{codeError}<Button ml={2} size="sm" onClick={() => setCodeVersion(value => value + 1)}>Réessayer</Button></Alert>}
        <FormControl isRequired isDisabled={saving}><FormLabel>Nom de l’emplacement</FormLabel><Input ref={focus} value={name} onChange={e => setName(e.target.value)} maxLength={255} /></FormControl>
        <FormControl isDisabled={saving}><FormLabel>Emplacement parent</FormLabel><Select value={parentId} onChange={e => setParentId(e.target.value)}>
          <option value="">Entrepôt · {warehouse.name}</option>
          {parents.map(entry => <option key={entry._id} value={entry._id}>{locationTypeLabels[entry.locationType]} · {entry.name} ({entry.code})</option>)}
        </Select></FormControl>
        <FormControl display="flex" alignItems="center" isDisabled={saving}><FormLabel htmlFor="location-active" mb={0}>Emplacement actif</FormLabel><Switch id="location-active" colorScheme="yellow" isChecked={isActive} onChange={e => setIsActive(e.target.checked)} /></FormControl>
      </Stack></ModalBody>
      <ModalFooter gap={3}><Button variant="outline" onClick={onClose} isDisabled={saving}>Annuler</Button><Button type="submit" colorScheme="yellow" isLoading={saving} isDisabled={generating || !!codeError || !code}>{location ? "Enregistrer" : "Créer l’emplacement"}</Button></ModalFooter>
    </ModalContent>
  </Modal>;
}
