import { useEffect, useRef, useState } from "react";
import InventoryCustomFields, {
  CustomFieldsLoadStatus,
  useInventoryCustomFields,
} from "./InventoryCustomFields";
import { Global } from "@emotion/react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
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
  Spinner,
  Stack,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import DatePicker from "react-datepicker";
import { fr } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import type {
  InventoryBalance,
  InventoryItem,
} from "../../../../common/types/inventory/InventoryItem";
import type {
  InventoryLocation,
  InventoryWarehouse,
} from "../../../../common/types/inventory/InventoryWarehouse";
import type { InventoryUnit } from "../../../../common/types/inventory/InventoryUnit";
import type {
  InventoryTransactionInput,
  InventoryTransactionType,
} from "../../../../common/types/inventory/InventoryTransaction";
import useAdminUser from "../../../../store/auth.store";
import { locationTypeLabels } from "./InventoryLocationForm";

const titles: Record<InventoryTransactionType, string> = {
  RECEIPT: "Entrée de stock",
  ISSUE: "Sortie de stock",
  TRANSFER: "Transfert de stock",
  ADJUSTMENT: "Ajustement de stock",
};
interface DraftLine {
  customFields?: Record<string, string>;
  key: string;
  itemId: string;
  quantity: string;
  unitCost: string;
  lotId: string;
  serialNumber: string;
}
const newLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  itemId: "",
  quantity: "",
  unitCost: "",
  lotId: "",
  serialNumber: "",
});

interface Props {
  companyId: string;
  type: InventoryTransactionType;
  items: InventoryItem[];
  warehouses: InventoryWarehouse[];
  onClose: () => void;
  onSaved: () => void;
}

export default function InventoryTransactionModal({
  companyId,
  type,
  items,
  warehouses,
  onClose,
  onSaved,
}: Props) {
  const user = useAdminUser((store) => store.adminUser);
  const toast = useToast();
  const [requestId] = useState(() => crypto.randomUUID());
  const [date, setDate] = useState<Date | null>(() => new Date());
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const customFieldState = useInventoryCustomFields(companyId);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locationPath, setLocationPath] = useState<string[]>([]);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine()]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const receipt = type === "RECEIPT";
  const transfer = type === "TRANSFER";
  const incoming =
    type === "RECEIPT" || (type === "ADJUSTMENT" && direction === "IN");
  const activeItems = items.filter((item) => item.isActive && !item.isDeleted);
  const availableBalances = balances.filter(
    (balance) =>
      !balance.isDeleted &&
      balance.warehouseId === warehouseId &&
      (balance.locationId || "") === locationId &&
      balance.quantityOnHand - balance.quantityReserved > 0
  );
  const availableItemIds = new Set(
    availableBalances.map((balance) => balance.itemId)
  );
  const selectableItems =
    type === "ISSUE"
      ? activeItems.filter((item) => availableItemIds.has(item._id))
      : activeItems;
  const activeWarehouses = warehouses.filter(
    (warehouse) => warehouse.isActive && !warehouse.isDeleted
  );
  const unsupportedCosting = lines.some((line) => {
    const item = activeItems.find((entry) => entry._id === line.itemId);
    return item?.costingMethod && item.costingMethod !== "AVERAGE";
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    const loadLocations = async () => {
      const result: InventoryLocation[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await window.electron.inventory.locations.list(companyId, {
          isActive: true,
          limit: 100,
          offset,
        });
        result.push(...page);
        if (page.length < 100) return result;
      }
    };
    const loadBalances = async () => {
      const result: InventoryBalance[] = [];
      if (type !== "ISSUE") return result;
      for (let offset = 0; ; offset += 100) {
        const page = await window.electron.inventory.balances.list(companyId, {
          limit: 100,
          offset,
        });
        result.push(...page);
        if (page.length < 100) return result;
      }
    };
    void Promise.all([
      loadLocations(),
      window.electron.inventory.settings.get(companyId),
      loadBalances(),
    ])
      .then(([loadedLocations, settings, loadedBalances]) => {
        if (active) {
          setLocations(loadedLocations);
          setUnits(settings.units);
          setBalances(loadedBalances);
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            "Impossible de charger les emplacements, unités et stocks."
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, type, retry]);

  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      submitting.current ||
      loading ||
      loadError ||
      customFieldState.loading ||
      customFieldState.error
    )
      return;
    setError("");
    if (
      type === "ISSUE" &&
      lines.some(
        (line) => !selectableItems.some((item) => item._id === line.itemId)
      )
    ) {
      setError(
        "Sélectionnez des articles avec du stock disponible à cet emplacement."
      );
      return;
    }
    if (!date || Number.isNaN(date.getTime())) {
      setError("Indiquez une date valide.");
      return;
    }
    if (
      transfer &&
      warehouseId === destinationWarehouseId &&
      locationId === destinationLocationId
    ) {
      setError("La source et la destination doivent être différentes.");
      return;
    }
    const input: InventoryTransactionInput = {
      requestId,
      type,
      date: date.toISOString(),
      reference,
      reason,
      customFields,
      warehouseId,
      locationId: locationId || undefined,
      destinationWarehouseId: transfer ? destinationWarehouseId : undefined,
      destinationLocationId: transfer
        ? destinationLocationId || undefined
        : undefined,
      adjustmentDirection: type === "ADJUSTMENT" ? direction : undefined,
      lines: lines.map((line) => ({
        customFields: line.customFields,
        itemId: line.itemId,
        quantity: Number(line.quantity),
        unitCost:
          incoming && line.unitCost !== "" ? Number(line.unitCost) : undefined,
        lotId: line.lotId.trim() || undefined,
        serialNumber: line.serialNumber.trim() || undefined,
      })),
    };
    submitting.current = true;
    setSaving(true);
    try {
      await window.electron.inventory.movements.postTransaction(
        companyId,
        input
      );
      toast({
        title: "Opération enregistrée",
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.replace(
              /^Error invoking remote method '[^']+': (Error: )?/,
              ""
            )
          : "Impossible d’enregistrer l’opération."
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };
  const placeFields = (destination: boolean) => {
    const warehouse = destination ? destinationWarehouseId : warehouseId;
    const location = destination ? destinationLocationId : locationId;
    const label = destination ? "destination" : "source";
    const locationLevels: InventoryLocation[][] = [];
    if (type === "RECEIPT" && warehouse) {
      const warehouseLocations = locations.filter(
        (entry) =>
          entry.warehouseId === warehouse && entry.isActive && !entry.isDeleted
      );
      for (let depth = 0; depth <= locationPath.length; depth += 1) {
        const parentId = depth === 0 ? "" : locationPath[depth - 1];
        const children = warehouseLocations.filter(
          (entry) =>
            (entry.parentId || "") === parentId &&
            !locationPath.slice(0, depth).includes(entry._id)
        );
        if (!children.length) break;
        locationLevels.push(children);
        if (!children.some((entry) => entry._id === locationPath[depth])) break;
      }
    }
    return (
      <Box
        borderWidth="1px"
        borderColor={receipt ? "#bbb" : undefined}
        bg={receipt ? "#f7f7f7" : undefined}
        borderRadius={receipt ? 0 : "md"}
        p={receipt ? "16px" : 3}
      >
        <Text fontWeight="semibold" mb={2}>
          {transfer
            ? destination
              ? "Destination"
              : "Source"
            : "Stock concerné"}
        </Text>
        <Stack
          spacing={3}
          sx={
            receipt
              ? {
                  display: "grid",
                  gridTemplateColumns: {
                    base: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: "12px",
                  "& > *": { margin: "0 !important" },
                }
              : undefined
          }
        >
          <FormControl isRequired>
            <FormLabel htmlFor={`transaction-warehouse-${label}`}>
              Entrepôt
            </FormLabel>
            <Select
              id={`transaction-warehouse-${label}`}
              value={warehouse}
              onChange={(event) => {
                if (destination) {
                  setDestinationWarehouseId(event.target.value);
                  setDestinationLocationId("");
                } else {
                  setWarehouseId(event.target.value);
                  setLocationId("");
                  setLocationPath([]);
                  if (type === "ISSUE") setLines([newLine()]);
                }
              }}
            >
              <option value="">Sélectionner un entrepôt</option>
              {activeWarehouses.map((entry) => (
                <option key={entry._id} value={entry._id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </FormControl>
          {type === "RECEIPT" ? (
            locationLevels.map((options, depth) => {
              const types = [
                ...new Set(options.map((entry) => entry.locationType)),
              ];
              const levelLabel = types
                .map((entry) => locationTypeLabels[entry])
                .join(" / ");
              const fieldId = `transaction-location-${label}-${depth}`;
              return (
                <FormControl key={fieldId}>
                  <FormLabel htmlFor={fieldId}>{levelLabel}</FormLabel>
                  <Select
                    id={fieldId}
                    value={locationPath[depth] ?? ""}
                    isDisabled={saving}
                    onChange={(event) => {
                      const nextPath = locationPath.slice(0, depth);
                      if (event.target.value) nextPath.push(event.target.value);
                      setLocationPath(nextPath);
                      setLocationId(nextPath[nextPath.length - 1] ?? "");
                    }}
                  >
                    <option value="">Emplacement précis</option>
                    {options.map((entry) => (
                      <option key={entry._id} value={entry._id}>
                        {entry.code} — {entry.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              );
            })
          ) : (
            <FormControl>
              <FormLabel htmlFor={`transaction-location-${label}`}>
                Emplacement
              </FormLabel>
              <Select
                id={`transaction-location-${label}`}
                value={location}
                isDisabled={!warehouse || saving}
                onChange={(event) => {
                  if (destination) setDestinationLocationId(event.target.value);
                  else {
                    setLocationId(event.target.value);
                    if (type === "ISSUE") setLines([newLine()]);
                  }
                }}
              >
                <option value="">Emplacement précis</option>
                {locations
                  .filter((entry) => entry.warehouseId === warehouse)
                  .map((entry) => (
                    <option key={entry._id} value={entry._id}>
                      {entry.code} — {entry.name}
                    </option>
                  ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </Box>
    );
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      size="4xl"
      scrollBehavior={receipt ? "outside" : "inside"}
      closeOnOverlayClick={!saving}
      closeOnEsc={!saving}
    >
      {receipt && (
        <Global
          styles={`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body:has([data-stock-paper]) { background: white; }
          body:has([data-stock-paper]) *:has([data-stock-paper]) {
            height: auto !important; min-height: 0 !important; max-height: none !important;
            overflow: visible !important; display: block !important; position: static !important;
            padding: 0 !important; margin: 0 !important;
          }
          body:has([data-stock-paper]) *:has([data-stock-paper]) > :not([data-stock-paper]):not(:has([data-stock-paper])) {
            display: none !important;
          }
        }
      `}
        />
      )}
      <ModalOverlay />
      <ModalContent
        as="form"
        onSubmit={submit}
        data-stock-paper={receipt ? "" : undefined}
        w={receipt ? "calc(100% - 24px)" : undefined}
        maxW={receipt ? "210mm" : undefined}
        minH={receipt ? { base: 0, sm: "297mm" } : undefined}
        mx={receipt ? "auto" : undefined}
        p={receipt ? { base: "28px 18px", sm: "14mm 13mm" } : undefined}
        border={receipt ? "1px solid #d0d0d0" : undefined}
        borderRadius={receipt ? 0 : undefined}
        bg={receipt ? "white" : undefined}
        color={receipt ? "#171717" : undefined}
        boxShadow={receipt ? "0 4px 24px rgb(0 0 0 / 8%)" : undefined}
        fontSize={receipt ? "13px" : undefined}
        sx={
          receipt
            ? {
                fontVariantNumeric: "tabular-nums",
                colorScheme: "light",
                ".chakra-form__label": {
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#444",
                },
                ".chakra-input, .chakra-select, .chakra-textarea": {
                  border: "1px solid #aaa",
                  borderRadius: 0,
                  background: "white",
                  color: "#171717",
                  fontSize: "13px",
                  "&::placeholder": { color: "#777" },
                },
                ".chakra-input[readonly]": { background: "#f5f5f5" },
                ".chakra-input:focus-visible, .chakra-select:focus-visible, .chakra-textarea:focus-visible, button:focus-visible":
                  {
                    borderColor: "#171717",
                    outline: "2px solid #171717",
                    outlineOffset: "2px",
                    boxShadow: "none",
                  },
                ".chakra-form__required-indicator": { color: "#171717" },
                ".chakra-button": { borderRadius: 0, fontSize: "12px" },
                ".chakra-button:not([type=submit])": { color: "#171717" },
                ".chakra-alert": {
                  border: "1px solid #888",
                  background: "#f3f3f3",
                  color: "#171717",
                  fontSize: "12px",
                },
                ".react-datepicker__day--selected, .react-datepicker__day--keyboard-selected, .react-datepicker__time-list-item--selected":
                  {
                    backgroundColor: "#333 !important",
                    color: "#fff !important",
                  },
                "@media print": {
                  width: "100%",
                  maxWidth: "none",
                  minHeight: 0,
                  margin: 0,
                  padding: 0,
                  border: 0,
                  boxShadow: "none",
                  "button, .chakra-modal__footer": { display: "none" },
                },
              }
            : undefined
        }
      >
        <ModalHeader
          p={receipt ? 0 : undefined}
          mb={receipt ? "16px" : undefined}
        >
          {receipt ? (
            <Box
              borderBottom="2px solid #171717"
              pb="24px"
              mb="4px"
              sx={{ "@media print": { breakInside: "avoid" } }}
            >
              <Text
                fontSize={{ base: "9px", sm: "10px" }}
                fontWeight={600}
                letterSpacing="0.12em"
                textTransform="uppercase"
                color="#555"
              >
                Gestion des stocks / Réception
              </Text>
              <Text
                as="h1"
                mt="22px"
                fontFamily='Georgia, "Times New Roman", serif'
                fontSize="clamp(28px, 4vw, 38px)"
                lineHeight="1.15"
                fontWeight={400}
                letterSpacing="-0.025em"
                color="#171717"
              >
                Bon d’entrée
              </Text>
            </Box>
          ) : (
            titles[type]
          )}
        </ModalHeader>
        <ModalCloseButton isDisabled={saving} />
        <ModalBody p={receipt ? 0 : undefined} flex={receipt ? 1 : undefined}>
          {loading ? (
            <HStack role="status">
              <Spinner size="sm" />
              <Text>Chargement…</Text>
            </HStack>
          ) : loadError ? (
            <Stack>
              <Alert status="error">{loadError}</Alert>
              <Button onClick={() => setRetry((value) => value + 1)}>
                Réessayer
              </Button>
            </Stack>
          ) : (
            <Box as="fieldset" disabled={saving} border={0} p={0} minW={0}>
              <Stack spacing={4}>
                <CustomFieldsLoadStatus state={customFieldState} />
                <InventoryCustomFields
                  width="300px"
                  fields={customFieldState.fields}
                  entity="DOCUMENT"
                  values={customFields}
                  onChange={setCustomFields}
                  disabled={saving}
                />
                {error && (
                  <Alert status="error" role="alert">
                    {error}
                  </Alert>
                )}
                {unsupportedCosting && (
                  <Alert status="warning">
                    Ces formulaires prennent en charge le coût moyen. La
                    comptabilisation FIFO et au coût standard n’est pas encore
                    disponible.
                  </Alert>
                )}
                {(!activeItems.length || !activeWarehouses.length) && (
                  <Alert status="warning">
                    Créez au moins un article actif et un entrepôt actif avant
                    d’enregistrer une opération.
                  </Alert>
                )}
                {receipt && (
                  <Text
                    py="10px"
                    borderBottom="1px solid #999"
                    fontSize="10px"
                    fontWeight={700}
                    lineHeight="1.5"
                    letterSpacing="0.1em"
                    textTransform="uppercase"
                    color="#333"
                  >
                    01 / Informations générales
                  </Text>
                )}
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl
                    isRequired
                    sx={{ ".react-datepicker-wrapper": { width: "100%" } }}
                  >
                    <FormLabel htmlFor="transaction-date">
                      Date et heure
                    </FormLabel>
                    <DatePicker
                      id="transaction-date"
                      selected={date}
                      onChange={(value: Date | null) => setDate(value)}
                      dateFormat="dd-MM-yyyy HH:mm"
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeCaption="Heure"
                      locale={fr}
                      strictParsing
                      required
                      disabled={saving}
                      customInput={<Input />}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel htmlFor="transaction-reference">
                      Référence
                    </FormLabel>
                    <Input
                      id="transaction-reference"
                      value={reference}
                      maxLength={255}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Bon de livraison, commande…"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel htmlFor="transaction-user">
                      Responsable
                    </FormLabel>
                    <Input
                      id="transaction-user"
                      isReadOnly
                      value={
                        `${user.firstName ?? ""} ${
                          user.lastName ?? ""
                        }`.trim() || user.email
                      }
                    />
                  </FormControl>
                  {type === "ADJUSTMENT" && (
                    <FormControl isRequired>
                      <FormLabel htmlFor="transaction-direction">
                        Sens de l’ajustement
                      </FormLabel>
                      <Select
                        id="transaction-direction"
                        value={direction}
                        onChange={(event) =>
                          setDirection(event.target.value as "IN" | "OUT")
                        }
                      >
                        <option value="IN">Ajouter au stock</option>
                        <option value="OUT">Retirer du stock</option>
                      </Select>
                    </FormControl>
                  )}
                </SimpleGrid>
                <SimpleGrid
                  columns={{ base: 1, md: transfer ? 2 : 1 }}
                  spacing={4}
                >
                  {placeFields(false)}
                  {transfer && placeFields(true)}
                </SimpleGrid>
                {type === "ADJUSTMENT" && (
                  <Text fontSize="sm" color="gray.600">
                    Saisissez la quantité à ajouter ou à retirer, et non le
                    nouveau stock total.
                  </Text>
                )}
                {!incoming && (
                  <Text fontSize="sm" color="gray.600">
                    Les quantités réservées ne sont pas disponibles.
                  </Text>
                )}
                {type === "ISSUE" && warehouseId && !selectableItems.length && (
                  <Alert status="info">
                    Aucun article avec du stock non réservé à cet emplacement.
                  </Alert>
                )}
                {receipt && (
                  <Text
                    py="10px"
                    borderBottom="1px solid #999"
                    fontSize="10px"
                    fontWeight={700}
                    lineHeight="1.5"
                    letterSpacing="0.1em"
                    textTransform="uppercase"
                    color="#333"
                  >
                    02 / Articles réceptionnés
                  </Text>
                )}
                {lines.map((line, index) => {
                  const item = activeItems.find(
                    (entry) => entry._id === line.itemId
                  );
                  const unit = units.find(
                    (entry) => entry._id === item?.baseUnitId
                  );
                  const itemBalances = availableBalances.filter(
                    (balance) => balance.itemId === line.itemId
                  );
                  const selectedBalance = itemBalances.find(
                    (balance) =>
                      (balance.lotId || "") === line.lotId &&
                      (balance.serialNumber || "") === line.serialNumber
                  );
                  return (
                    <Box
                      key={line.key}
                      borderWidth={receipt ? 0 : "1px"}
                      borderBottom={receipt ? "1px solid #bbb" : undefined}
                      borderRadius={receipt ? 0 : "md"}
                      p={receipt ? "14px 0" : 3}
                      sx={
                        receipt
                          ? { "@media print": { breakInside: "avoid" } }
                          : undefined
                      }
                    >
                      <HStack justify="space-between" mb={2}>
                        <Text fontWeight="semibold">Article {index + 1}</Text>
                        <IconButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Retirer l’article ${index + 1}`}
                          icon={<FiTrash2 />}
                          isDisabled={saving || lines.length === 1}
                          onClick={() =>
                            setLines((current) =>
                              current.filter((entry) => entry.key !== line.key)
                            )
                          }
                        />
                      </HStack>
                      <InventoryCustomFields
                        width="300px"
                        fields={customFieldState.fields}
                        entity="DOCUMENT_LINE"
                        values={line.customFields ?? {}}
                        onChange={(values) =>
                          updateLine(line.key, { customFields: values })
                        }
                        disabled={saving}
                      />
                      <SimpleGrid
                        columns={{ base: 1, md: incoming ? 3 : 2 }}
                        spacing={3}
                      >
                        <FormControl isRequired>
                          <FormLabel htmlFor={`${line.key}-item`}>
                            Article
                          </FormLabel>
                          <Select
                            id={`${line.key}-item`}
                            value={line.itemId}
                            isDisabled={
                              type === "ISSUE" && !selectableItems.length
                            }
                            onChange={(event) => {
                              const stocked = availableBalances.filter(
                                (balance) =>
                                  balance.itemId === event.target.value
                              );
                              const onlyBalance =
                                type === "ISSUE" && stocked.length === 1
                                  ? stocked[0]
                                  : undefined;
                              updateLine(line.key, {
                                itemId: event.target.value,
                                lotId: onlyBalance?.lotId || "",
                                serialNumber: onlyBalance?.serialNumber || "",
                                quantity: "",
                                unitCost: "",
                              });
                            }}
                          >
                            <option value="">Sélectionner un article</option>
                            {selectableItems.map((entry) => (
                              <option key={entry._id} value={entry._id}>
                                {entry.sku} — {entry.name}
                              </option>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel htmlFor={`${line.key}-quantity`}>
                            Quantité{unit ? ` (${unit.code})` : ""}
                          </FormLabel>
                          <Input
                            id={`${line.key}-quantity`}
                            type="number"
                            min={unit ? 10 ** -unit.decimalPlaces : "0.000001"}
                            step={unit ? 10 ** -unit.decimalPlaces : "any"}
                            value={line.quantity}
                            onChange={(event) =>
                              updateLine(line.key, {
                                quantity: event.target.value,
                              })
                            }
                          />
                        </FormControl>
                        {incoming && (
                          <FormControl isRequired>
                            <FormLabel htmlFor={`${line.key}-cost`}>
                              Coût unitaire
                            </FormLabel>
                            <Input
                              id={`${line.key}-cost`}
                              type="number"
                              min={0}
                              step="any"
                              value={line.unitCost}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  unitCost: event.target.value,
                                })
                              }
                            />
                          </FormControl>
                        )}
                        {type === "ISSUE" &&
                        item &&
                        item.trackingMethod !== "NONE" ? (
                          <FormControl isRequired>
                            <FormLabel htmlFor={`${line.key}-stock`}>
                              {item.trackingMethod === "LOT"
                                ? "Lot en stock"
                                : "Numéro de série en stock (quantité 1)"}
                            </FormLabel>
                            <Select
                              id={`${line.key}-stock`}
                              value={selectedBalance?._id ?? ""}
                              onChange={(event) => {
                                const balance = itemBalances.find(
                                  (entry) => entry._id === event.target.value
                                );
                                updateLine(line.key, {
                                  lotId: balance?.lotId || "",
                                  serialNumber: balance?.serialNumber || "",
                                  quantity: "",
                                });
                              }}
                            >
                              <option value="">
                                Sélectionner le stock à sortir
                              </option>
                              {itemBalances.map((balance) => (
                                <option key={balance._id} value={balance._id}>
                                  {[balance.lotId, balance.serialNumber]
                                    .filter(Boolean)
                                    .join(" / ")}{" "}
                                  — Disponible :{" "}
                                  {balance.quantityOnHand -
                                    balance.quantityReserved}
                                </option>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <>
                            {item?.trackingMethod === "LOT" && (
                              <FormControl isRequired>
                                <FormLabel htmlFor={`${line.key}-lot`}>
                                  Lot
                                </FormLabel>
                                <Input
                                  id={`${line.key}-lot`}
                                  value={line.lotId}
                                  maxLength={255}
                                  onChange={(event) =>
                                    updateLine(line.key, {
                                      lotId: event.target.value,
                                    })
                                  }
                                />
                              </FormControl>
                            )}
                            {item?.trackingMethod === "SERIAL" && (
                              <FormControl isRequired>
                                <FormLabel htmlFor={`${line.key}-serial`}>
                                  Numéro de série (quantité 1)
                                </FormLabel>
                                <Input
                                  id={`${line.key}-serial`}
                                  value={line.serialNumber}
                                  maxLength={255}
                                  onChange={(event) =>
                                    updateLine(line.key, {
                                      serialNumber: event.target.value,
                                    })
                                  }
                                />
                              </FormControl>
                            )}
                          </>
                        )}
                        {type === "ISSUE" && selectedBalance && (
                          <Text fontSize="sm" color="gray.600">
                            Disponible :{" "}
                            {selectedBalance.quantityOnHand -
                              selectedBalance.quantityReserved}{" "}
                            {unit?.code}
                          </Text>
                        )}
                      </SimpleGrid>
                    </Box>
                  );
                })}
                <Button
                  type="button"
                  alignSelf="start"
                  leftIcon={<FiPlus />}
                  onClick={() => setLines((current) => [...current, newLine()])}
                  isDisabled={saving || lines.length >= 100}
                >
                  Ajouter un article
                </Button>
                <FormControl isRequired>
                  <FormLabel
                    htmlFor="transaction-reason"
                    py={receipt ? "10px" : undefined}
                    borderBottom={receipt ? "1px solid #999" : undefined}
                    letterSpacing={receipt ? "0.1em" : undefined}
                    textTransform={receipt ? "uppercase" : undefined}
                    lineHeight={receipt ? "1.5" : undefined}
                    mb={receipt ? 0 : undefined}
                    sx={
                      receipt
                        ? {
                            "&&": {
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#333",
                            },
                          }
                        : undefined
                    }
                  >
                    {receipt ? "03 / Motif" : "Motif"}
                  </FormLabel>
                  <Textarea
                    id="transaction-reason"
                    value={reason}
                    maxLength={2000}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </FormControl>
              </Stack>
            </Box>
          )}
        </ModalBody>
        <ModalFooter
          gap={3}
          p={receipt ? 0 : undefined}
          mt={receipt ? "28px" : undefined}
          pt={receipt ? "18px" : undefined}
          borderTop={receipt ? "1px solid #171717" : undefined}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            isDisabled={saving}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            colorScheme={receipt ? "gray" : "blue"}
            bg={receipt ? "#171717" : undefined}
            color={receipt ? "white" : undefined}
            px={receipt ? "24px" : undefined}
            _hover={receipt ? { bg: "#333" } : undefined}
            isLoading={saving}
            isDisabled={
              loading ||
              Boolean(loadError) ||
              unsupportedCosting ||
              !selectableItems.length ||
              !activeWarehouses.length
            }
          >
            Enregistrer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
