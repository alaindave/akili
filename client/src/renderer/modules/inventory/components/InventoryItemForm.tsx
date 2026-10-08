import { categorySkuPrefix } from "../../../../common/types/inventory/sku";
import type { SkuNumberingSettings } from "../../../../common/types/inventory/StockSettings";
import { useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type {
  InventoryItem,
  InventoryItemType,
  InventoryTrackingMethod,
  InventoryCostingMethod,
} from "../../../../common/types/inventory/InventoryItem";
import type {
  InventoryUnit,
} from "../../../../common/types/inventory/InventoryUnit";
import type { InventoryCategory } from "../../../../common/types/inventory/InventoryCategory";

export const itemTypeLabels: Record<InventoryItemType, string> = {
  RAW_MATERIAL: "Matière première",
  COMPONENT: "Composant",
  SEMI_FINISHED: "Produit semi-fini",
  FINISHED_GOOD: "Produit fini",
  CONSUMABLE: "Consommable",
};
export const trackingLabels: Record<InventoryTrackingMethod, string> = {
  NONE: "Sans suivi",
  LOT: "Par lot",
  SERIAL: "Par numéro de série",
};
export const primaryButton = {
  bg: "#202020",
  color: "white",
  _hover: { bg: "#383838" },
  _active: { bg: "#111111" },
};
export function inventoryError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+':\s*(Error:\s*)?/,
        ""
      )
    : "Impossible d’enregistrer. Veuillez réessayer.";
}

interface Props {
  companyId: string;
  units: InventoryUnit[];
  categories: InventoryCategory[];
  numbering: SkuNumberingSettings;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
}

export default function InventoryItemForm({
  companyId,
  units,
  numbering,
  categories,
  onClose,
  onSaved,
}: Props) {
  const [autoGenerateSku, setAutoGenerateSku] = useState(numbering.enabled);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<InventoryItemType>("RAW_MATERIAL");
  const [baseUnitId, setBaseUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [trackingMethod, setTrackingMethod] =
    useState<InventoryTrackingMethod>("NONE");
  const [costingMethod, setCostingMethod] = useState<
    InventoryCostingMethod | ""
  >("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [reorderQuantity, setReorderQuantity] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const busy = saving;
  const selectedCategory = categories.find(category => category._id === categoryId);
  const skuPreview = selectedCategory ? `${categorySkuPrefix(selectedCategory.name)}-12345` : "Sélectionnez une catégorie";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if ((!autoGenerateSku && !sku.trim()) || !name.trim() || !baseUnitId) {
      setError("Renseignez la référence, le nom et l’unité de base.");
      return;
    }
    if (autoGenerateSku && !categoryId) {
      setError("Sélectionnez une catégorie pour générer la référence SKU.");
      return;
    }
    if (
      (reorderPoint !== "" &&
        (!Number.isFinite(Number(reorderPoint)) || Number(reorderPoint) < 0)) ||
      (reorderQuantity !== "" &&
        (!Number.isFinite(Number(reorderQuantity)) ||
          Number(reorderQuantity) <= 0))
    ) {
      setError(
        "Le seuil doit être positif ou nul et la quantité de réapprovisionnement strictement positive."
      );
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const item = await window.electron.inventory.items.create(companyId, {
        sku,
        autoGenerateSku,
        name,
        description: description.trim() || undefined,
        itemType,
        baseUnitId,
        categoryId: categoryId || undefined,
        trackingMethod,
        costingMethod: costingMethod || undefined,
        reorderPoint: reorderPoint === "" ? undefined : Number(reorderPoint),
        reorderQuantity:
          reorderQuantity === "" ? undefined : Number(reorderQuantity),
        isActive,
      });
      onSaved(item);
    } catch (err) {
      setError(inventoryError(err));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!busy) onClose();
      }}
      size="2xl"
      initialFocusRef={initialFocusRef}
      scrollBehavior="inside"
      closeOnOverlayClick={!busy}
      closeOnEsc={!busy}
    >
      <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(8px)" />
      <ModalContent
        borderRadius="16px"
        mx={4}
        color="#242424"
        as="form"
        onSubmit={submit}
      >
        <ModalHeader pt={7} pb={5} borderBottom="1px solid #EAEAEA">
          <Text fontSize="xl" fontWeight="650">
            Ajouter un article
          </Text>
          <Text mt={1} fontSize="sm" fontWeight="normal" color="#737373">
            Définissez les informations de votre nouvel article.
          </Text>
        </ModalHeader>
        <ModalCloseButton top={6} isDisabled={busy} />
        <ModalBody
          py={6}
          sx={{
            "input, select, textarea": {
              borderColor: "#DCDCDC",
              borderRadius: "8px",
            },
            "input:focus, select:focus, textarea:focus": {
              borderColor: "#525252",
              boxShadow: "0 0 0 1px #525252",
            },
            label: { fontSize: "sm", fontWeight: 500 },
          }}
        >
          <Stack spacing={6}>
            {error && (
              <Alert
                status="error"
                bg="#F5F5F5"
                color="#242424"
                border="1px solid #D4D4D4"
                borderRadius="md"
                role="alert"
              >
                {error}
              </Alert>
            )}
            <Box as="fieldset" disabled={busy} minW={0} border={0} p={0}>
              <Stack spacing={4}>
                <Text
                  fontSize="xs"
                  letterSpacing="0.12em"
                  fontWeight="700"
                  color="#737373"
                >
                  INFORMATIONS GÉNÉRALES
                </Text>
                {numbering.enabled && <Checkbox size="sm" colorScheme="blackAlpha" isChecked={autoGenerateSku} onChange={e => setAutoGenerateSku(e.target.checked)}>Générer automatiquement la référence SKU</Checkbox>}
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  <FormControl isRequired={!autoGenerateSku}>
                    <FormLabel htmlFor="item-sku">Référence / SKU</FormLabel>
                    <Input
                      ref={autoGenerateSku ? undefined : initialFocusRef}
                      id="item-sku"
                      isDisabled={autoGenerateSku}
                      value={autoGenerateSku ? skuPreview : sku}
                      maxLength={100}
                      placeholder="Ex. MAT-001"
                      onChange={(e) => setSku(e.target.value)}
                    />
                    <FormHelperText fontSize="xs">
                      {autoGenerateSku ? "Exemple de format. Cinq chiffres aléatoires seront attribués à l’enregistrement." : "Une référence unique par article."}
                    </FormHelperText>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel htmlFor="item-name">Nom de l’article</FormLabel>
                    <Input
                      ref={autoGenerateSku ? initialFocusRef : undefined}
                      id="item-name"
                      value={name}
                      maxLength={255}
                      placeholder="Ex. Cuir pleine fleur"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel htmlFor="item-type">Type d’article</FormLabel>
                    <Select
                      id="item-type"
                      value={itemType}
                      onChange={(e) =>
                        setItemType(e.target.value as InventoryItemType)
                      }
                    >
                      {Object.entries(itemTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl isRequired={autoGenerateSku}>
                    <FormLabel htmlFor="item-category">Catégorie</FormLabel>
                    <Select
                      id="item-category"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <option value="">Sans catégorie</option>
                      {categories.map((category) => (
                        <option key={category._id} value={category._id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </SimpleGrid>
                <FormControl>
                  <FormLabel htmlFor="item-description">
                    Description{" "}
                    <Text as="span" color="#999" fontWeight="normal">
                      (facultatif)
                    </Text>
                  </FormLabel>
                  <Textarea
                    id="item-description"
                    rows={2}
                    value={description}
                    maxLength={5000}
                    placeholder="Précisions, caractéristiques ou usage de l’article…"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </FormControl>
                <Divider borderColor="#EAEAEA" my={1} />
                <Text
                  fontSize="xs"
                  letterSpacing="0.12em"
                  fontWeight="700"
                  color="#737373"
                >
                  UNITÉ ET GESTION DU STOCK
                </Text>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel htmlFor="item-unit">Unité de base</FormLabel>
                    <Select
                      id="item-unit"
                      value={baseUnitId}
                      onChange={(e) => setBaseUnitId(e.target.value)}
                    >
                      <option value="">Sélectionner une unité</option>
                      {units.map((value) => (
                        <option key={value._id} value={value._id}>
                          {value.name} ({value.code})
                        </option>
                      ))}
                    </Select>
                    {units.length === 0 && (
                      <FormHelperText>
                        Configurez une unité de mesure dans Paramètres de stocks
                        avant d’ajouter un article.
                      </FormHelperText>
                    )}
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel htmlFor="item-tracking">
                      Méthode de suivi
                    </FormLabel>
                    <Select
                      id="item-tracking"
                      value={trackingMethod}
                      onChange={(e) =>
                        setTrackingMethod(
                          e.target.value as InventoryTrackingMethod
                        )
                      }
                    >
                      {Object.entries(trackingLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel htmlFor="item-costing">
                      Méthode de valorisation
                    </FormLabel>
                    <Select
                      id="item-costing"
                      value={costingMethod}
                      onChange={(e) =>
                        setCostingMethod(
                          e.target.value as InventoryCostingMethod | ""
                        )
                      }
                    >
                      <option value="">Non définie</option>
                      <option value="AVERAGE">Coût moyen pondéré</option>
                      <option value="FIFO">
                        Premier entré, premier sorti (FIFO)
                      </option>
                      <option value="STANDARD">Coût standard</option>
                    </Select>
                  </FormControl>
                  <Box />
                  <FormControl>
                    <FormLabel htmlFor="item-reorder-point">
                      Seuil de réapprovisionnement
                    </FormLabel>
                    <Input
                      id="item-reorder-point"
                      type="number"
                      min={0}
                      step="any"
                      value={reorderPoint}
                      placeholder="Non défini"
                      onChange={(e) => setReorderPoint(e.target.value)}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel htmlFor="item-reorder-quantity">
                      Quantité à réapprovisionner
                    </FormLabel>
                    <Input
                      id="item-reorder-quantity"
                      type="number"
                      min={0}
                      step="any"
                      value={reorderQuantity}
                      placeholder="Non définie"
                      onChange={(e) => setReorderQuantity(e.target.value)}
                    />
                  </FormControl>
                </SimpleGrid>
                <Checkbox
                  colorScheme="blackAlpha"
                  isChecked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  pt={2}
                >
                  Article actif
                </Checkbox>
              </Stack>
            </Box>
          </Stack>
        </ModalBody>
        <ModalFooter
          borderTop="1px solid #EAEAEA"
          py={4}
          bg="#FAFAFA"
          borderBottomRadius="16px"
        >
          <HStack spacing={3}>
            <Button
              type="button"
              variant="outline"
              bg="white"
              onClick={onClose}
              isDisabled={busy}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              {...primaryButton}
              isLoading={saving}
              isDisabled={units.length === 0}
              loadingText="Enregistrement…"
            >
              Enregistrer l’article
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
