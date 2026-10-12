import { useEffect, useRef, useState } from "react";
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

const titles: Record<InventoryTransactionType, string> = {
  RECEIPT: "Entrée de stock",
  ISSUE: "Sortie de stock",
  TRANSFER: "Transfert de stock",
  ADJUSTMENT: "Ajustement de stock",
};
interface DraftLine {
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
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
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
    if (submitting.current || loading || loadError) return;
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
      warehouseId,
      locationId: locationId || undefined,
      destinationWarehouseId: transfer ? destinationWarehouseId : undefined,
      destinationLocationId: transfer
        ? destinationLocationId || undefined
        : undefined,
      adjustmentDirection: type === "ADJUSTMENT" ? direction : undefined,
      lines: lines.map((line) => ({
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
    return (
      <Box borderWidth="1px" borderRadius="md" p={3}>
        <Text fontWeight="semibold" mb={2}>
          {transfer
            ? destination
              ? "Destination"
              : "Source"
            : "Stock concerné"}
        </Text>
        <Stack spacing={3}>
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
              <option value="">Sans emplacement précis</option>
              {locations
                .filter((entry) => entry.warehouseId === warehouse)
                .map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {entry.code} — {entry.name}
                  </option>
                ))}
            </Select>
          </FormControl>
        </Stack>
      </Box>
    );
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      size="4xl"
      scrollBehavior="inside"
      closeOnOverlayClick={!saving}
      closeOnEsc={!saving}
    >
      <ModalOverlay />
      <ModalContent as="form" onSubmit={submit}>
        <ModalHeader>{titles[type]}</ModalHeader>
        <ModalCloseButton isDisabled={saving} />
        <ModalBody>
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
                      borderWidth="1px"
                      borderRadius="md"
                      p={3}
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
                  <FormLabel htmlFor="transaction-reason">Motif</FormLabel>
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
        <ModalFooter gap={3}>
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
            colorScheme="blue"
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
