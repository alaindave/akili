import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { FiArrowLeft, FiTrash2 } from "react-icons/fi";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import type { InventoryLocation } from "../../../../common/types/inventory/InventoryWarehouse";
import { locationTypeLabels } from "../../inventory/components/InventoryLocationForm";
import type {
  OpeningStockDraft,
  OpeningStockLine,
  OpeningStockState,
} from "../../../../common/types/inventory/StockSettings";
import {
  inventoryError,
  itemTypeLabels,
  primaryButton,
} from "../../inventory/components/InventoryItemForm";

function InitializedStock({ state }: { state: OpeningStockState }) {
  return (
    <Stack spacing={2}>
      <Heading size="sm">Stock initialisé</Heading>
      <Text>
        Date et heure :{" "}
        {state.inventoryInitializedAt
          ? new Date(state.inventoryInitializedAt).toLocaleString("fr-FR")
          : "—"}
      </Text>
      <Text>
        Document :{" "}
        <Text as="span" fontFamily="mono" fontWeight="600">
          {state.inventoryInitializationDocumentNumber ?? "—"}
        </Text>
      </Text>
    </Stack>
  );
}

export function StockInitializationSettings({
  companyId,
}: {
  companyId: string;
}) {
  const [state, setState] = useState<OpeningStockState | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  useEffect(() => {
    let active = true;
    setError("");
    void window.electron.inventory.settings
      .getInitialization(companyId)
      .then((result) => {
        if (active) setState(result);
      })
      .catch((err) => {
        if (active) setError(inventoryError(err));
      });
    return () => {
      active = false;
    };
  }, [companyId, syncVersion, retry]);
  return (
    <Box
      bg="white"
      border="1px solid #E5E5E5"
      borderRadius="12px"
      p={{ base: 4, md: 6 }}
    >
      {error ? (
        <Stack>
          <Alert status="error">{error}</Alert>
          <Button onClick={() => setRetry((value) => value + 1)}>
            Réessayer
          </Button>
        </Stack>
      ) : !state ? (
        <Spinner aria-label="Chargement du stock" />
      ) : state.inventoryInitialized ? (
        <InitializedStock state={state} />
      ) : (
        <Stack
          spacing={4}
          align="center
        "
        >
          <Heading size="sm">Stock initial</Heading>
          <Text color="gray.600">
            Entrez les quantités et les prix de vos articles par entrepôt.
          </Text>
          <Button
            colorScheme="yellow"
            as={Link}
            to="/admin/settings/stock/initialization"
          >
            Initialiser stock initial
          </Button>
          {state.draft && (
            <Text fontSize="sm" color="gray.600">
              Un brouillon est disponible et sera repris à l’ouverture.
            </Text>
          )}
        </Stack>
      )}
    </Box>
  );
}

export default function StockInitializationPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  return companyId ? (
    <CompanyInitialization key={companyId} companyId={companyId} />
  ) : (
    <Alert>Connectez-vous à une entreprise.</Alert>
  );
}

function CompanyInitialization({ companyId }: { companyId: string }) {
  const [state, setState] = useState<OpeningStockState | null>(null);
  const [draft, setDraft] = useState<OpeningStockDraft>({
    _id: `opening:${crypto.randomUUID()}`,
    lines: [],
  });
  const [warehouseId, setWarehouseId] = useState("");
  const [locationPath, setLocationPath] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [dirty, setDirty] = useState(false);
  const working = useRef(false);
  const toast = useToast();
  const api = window.electron.inventory.settings;
  useEffect(() => {
    let active = true;
    void api
      .getInitialization(companyId)
      .then((result) => {
        if (!active) return;
        setState(result);
        if (result.draft) setDraft(result.draft);
        setWarehouseId(result.warehouses[0]?._id ?? "");
        setLocationPath([]);
        setError("");
      })
      .catch((err) => {
        if (active) setError(inventoryError(err));
      });
    return () => {
      active = false;
    };
  }, [companyId, retry, api]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function updateLine(index: number, patch: Partial<OpeningStockLine>) {
    setDraft((value) => ({
      ...value,
      lines: value.lines.map((line, position) =>
        position === index ? { ...line, ...patch } : line
      ),
    }));
    setDirty(true);
  }
  async function save(submit: boolean) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (submit) {
        const result = await api.submitOpeningDraft(companyId, draft);
        setNotice(result.warning ?? "Stock initial validé.");
        useSyncStore.setState((store) => ({
          syncVersion: store.syncVersion + 1,
        }));
      } else {
        setDraft(await api.saveOpeningDraft(companyId, draft));
        toast({
          title: "Brouillon sauvegardé",
          status: "success",
          duration: 3500,
          isClosable: true,
        });
      }
      setDirty(false);
      setState(await api.getInitialization(companyId));
    } catch (err) {
      setError(inventoryError(err));
      // A competing device may have completed initialization during submission.
      try {
        setState(await api.getInitialization(companyId));
      } catch {
        /* Keep the form and its draft. */
      }
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const total = draft.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitCost,
    0
  );
  const valid =
    draft.lines.every(
      (line) =>
        Number.isFinite(line.quantity) &&
        line.quantity > 0 &&
        Number.isFinite(line.unitCost) &&
        line.unitCost >= 0
    ) && Number.isFinite(total);
  const number = (value: number) =>
    Number.isFinite(value)
      ? value.toLocaleString("fr-FR", { maximumFractionDigits: 4 })
      : "—";
  const locations = (state?.locations ?? []).filter((location) => location.warehouseId === warehouseId && location.isActive && !location.isDeleted);
  const locationLevels: { options: InventoryLocation[]; selected?: InventoryLocation; parent?: InventoryLocation }[] = [];
  let parent: InventoryLocation | undefined;
  const visited = new Set<string>();
  for (let depth = 0; ; depth++) {
    const options = locations.filter((location) => (location.parentId || "") === (parent?._id ?? "") && !visited.has(location._id));
    if (!options.length) break;
    const selected = options.find((location) => location._id === locationPath[depth]);
    locationLevels.push({ options, selected, parent });
    if (!selected) break;
    visited.add(selected._id);
    parent = selected;
  }
  const locationId = parent?._id;
  const locationLabel = (id?: string) => {
    if (!id) return "Sans emplacement précis";
    const names: string[] = [];
    const seen = new Set<string>();
    let current: string | undefined = id;
    while (current && !seen.has(current)) {
      seen.add(current);
      const location = state?.locations.find((entry) => entry._id === current && entry.warehouseId === warehouseId);
      if (!location) { names.unshift("Emplacement indisponible"); break; }
      names.unshift(location.name);
      current = location.parentId;
    }
    return names.join(" › ");
  };
  return (
    <Box bg="#FAFAFA" minH="100vh" color="#262626" p={{ base: 5, md: 9 }}>
      <Box maxW="1200px" mx="auto">
        <Button
          as={Link}
          to="/admin/settings/stock"
          variant="ghost"
          leftIcon={<FiArrowLeft />}
          size="sm"
          mb={6}
          px={0}
          isDisabled={busy}
          onClick={(event) => {
            if (
              dirty &&
              !window.confirm(
                "Quitter sans sauvegarder les modifications du brouillon ?"
              )
            )
              event.preventDefault();
          }}
        >
          Paramètres de stocks
        </Button>
        <Heading as="h1" color="#1F2937" fontSize={{ base: "1.4rem", sm: "1.4rem", md: "1.5rem" }} fontWeight="700" lineHeight="1.1">
          Initialisation du stock
        </Heading>
        <Text fontSize={{ base: "0.7rem", sm: "0.8rem", md: "0.9rem" }} lineHeight="1.3" color="gray.600" fontWeight="400" mt={{ base: "1px", sm: "1px", md: "2px" }} mb={6}>
          Saisissez votre stock initial par type d’article, entrepôt et emplacement.
        </Text>
        {error && (
          <Alert status="error" mb={4}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert status="info" mb={4}>
            {notice}
          </Alert>
        )}
        {!state ? (
          error ? (
            <Button onClick={() => setRetry((value) => value + 1)}>
              Réessayer
            </Button>
          ) : (
            <Spinner aria-label="Chargement des articles" />
          )
        ) : state.inventoryInitialized ? (
          <Box bg="white" p={6} borderRadius="12px">
            <InitializedStock state={state} />
          </Box>
        ) : (
          <>
            <Flex gap={4} wrap="wrap" mb={4} align="end">
              <FormControl flex="1" minW="220px" maxW="420px" isRequired>
                <FormLabel htmlFor="opening-warehouse">Entrepôt</FormLabel>
                <Select
                  id="opening-warehouse"
                  value={warehouseId}
                  onChange={(event) => { setWarehouseId(event.target.value); setLocationPath([]); }}
                  isDisabled={busy}
                  placeholder="Sélectionner un entrepôt"
                >
                  {state.warehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              {locationLevels.map(({ options, selected, parent: ancestor }, depth) => (
                <FormControl key={ancestor?._id ?? "root"} flex="1" minW="220px" maxW="420px">
                  <FormLabel htmlFor={`opening-location-${depth}`}>
                    {ancestor ? `Sous-emplacement de ${ancestor.name}` : "Zone / emplacement"}
                  </FormLabel>
                  <Select id={`opening-location-${depth}`} value={selected?._id ?? ""} isDisabled={busy}
                    onChange={(event) => setLocationPath((path) => [...path.slice(0, depth), ...(event.target.value ? [event.target.value] : [])])}>
                    <option value="">{ancestor ? `Stocker dans ${ancestor.name}` : "Sans emplacement précis"}</option>
                    {options.map((location) => <option key={location._id} value={location._id}>
                      {locationTypeLabels[location.locationType]} · {location.name} ({location.code})
                    </option>)}
                  </Select>
                </FormControl>
              ))}
            </Flex>
            {warehouseId && <Text fontSize="sm" color="gray.600" mb={6}>
              Emplacement des nouveaux articles : {locationLabel(locationId)}.
            </Text>}
            {!state.warehouses.length && (
              <Alert status="warning" mb={4}>
                Créez un entrepôt actif avant d’ajouter du stock.
              </Alert>
            )}
            <Tabs colorScheme="gray" isLazy>
              <TabList overflowX="auto" mb={5}>
                {Object.entries(itemTypeLabels).map(([type, label]) => (
                  <Tab key={type} flexShrink={0}>
                    {label}
                  </Tab>
                ))}
              </TabList>
              <TabPanels>
                {Object.entries(itemTypeLabels).map(([type, label]) => {
                  const items = state.items.filter(
                    (item) => item.itemType === type
                  );
                  const rows = draft.lines
                    .map((line, index) => ({
                      line,
                      index,
                      item: state.items.find(
                        (item) => item._id === line.itemId
                      ),
                    }))
                    .filter(
                      ({ line, item }) =>
                        line.warehouseId === warehouseId &&
                        item?.itemType === type
                    );
                  return (
                    <TabPanel key={type} p={0}>
                      <Box
                        bg="white"
                        border="1px solid #E5E5E5"
                        borderRadius="12px"
                        p={{ base: 4, md: 6 }}
                      >
                        <FormControl mb={6}>
                          <FormLabel>Ajouter un article — {label}</FormLabel>
                          <Select
                            aria-label={`Ajouter un article : ${label}`}
                            placeholder="Sélectionner un article"
                            value=""
                            isDisabled={busy || !warehouseId}
                            onChange={(event) => {
                              const itemId = event.target.value;
                              if (!itemId) return;
                              setDraft((value) => ({
                                ...value,
                                lines: [
                                  ...value.lines,
                                  {
                                    itemId,
                                    warehouseId,
                                    locationId,
                                    quantity: 1,
                                    unitCost: 0,
                                  },
                                ],
                              }));
                              setDirty(true);
                            }}
                          >
                            {items.map((item) => (
                              <option
                                key={item._id}
                                value={item._id}
                                disabled={
                                  item.trackingMethod === "NONE" &&
                                  draft.lines.some(
                                    (line) =>
                                      line.itemId === item._id &&
                                      line.warehouseId === warehouseId &&
                                      (line.locationId ?? "") === (locationId ?? "")
                                  )
                                }
                              >
                                {item.name} · {item.sku}
                              </option>
                            ))}
                          </Select>
                        </FormControl>
                        <TableContainer>
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>Article</Th>
                                <Th>Emplacement</Th>
                                <Th>Unité</Th>
                                <Th>Quantité</Th>
                                <Th>Prix unitaire</Th>
                                <Th isNumeric>Valeur totale</Th>
                                <Th>Actions</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {rows.map(({ line, index, item }) => (
                                <Tr key={index}>
                                  <Td py={4}>
                                    <Text fontWeight="600">{item?.name}</Text>
                                    <Text
                                      fontFamily="mono"
                                      fontSize="xs"
                                      color="gray.500"
                                    >
                                      {item?.sku}
                                    </Text>
                                    {item?.trackingMethod === "LOT" && (
                                      <Input
                                        mt={2}
                                        aria-label={`Lot de ${item.name}`}
                                        placeholder="Numéro de lot"
                                        value={line.lotId ?? ""}
                                        isDisabled={busy}
                                        onChange={(event) =>
                                          updateLine(index, {
                                            lotId: event.target.value,
                                          })
                                        }
                                      />
                                    )}
                                    {item?.trackingMethod === "SERIAL" && (
                                      <Input
                                        mt={2}
                                        aria-label={`Numéro de série de ${item.name}`}
                                        placeholder="Numéro de série"
                                        value={line.serialNumber ?? ""}
                                        isDisabled={busy}
                                        onChange={(event) =>
                                          updateLine(index, {
                                            serialNumber: event.target.value,
                                          })
                                        }
                                      />
                                    )}
                                  </Td>
                                  <Td whiteSpace="normal" minW="140px" maxW="240px">
                                    {locationLabel(line.locationId)}
                                  </Td>
                                  <Td>
                                    {state.units.find(
                                      (unit) => unit._id === item?.baseUnitId
                                    )?.name ?? "—"}
                                  </Td>
                                  <Td>
                                    <Input
                                      aria-label={`Quantité de ${item?.name}`}
                                      type="number"
                                      min="0"
                                      step={
                                        10 **
                                        -(
                                          state.units.find(
                                            (unit) =>
                                              unit._id === item?.baseUnitId
                                          )?.decimalPlaces ?? 0
                                        )
                                      }
                                      w="120px"
                                      value={
                                        Number.isFinite(line.quantity)
                                          ? line.quantity
                                          : ""
                                      }
                                      isDisabled={
                                        busy ||
                                        item?.trackingMethod === "SERIAL"
                                      }
                                      onChange={(event) =>
                                        updateLine(index, {
                                          quantity:
                                            event.target.value === ""
                                              ? NaN
                                              : Number(event.target.value),
                                        })
                                      }
                                    />
                                  </Td>
                                  <Td>
                                    <Input
                                      aria-label={`Prix unitaire de ${item?.name}`}
                                      type="number"
                                      min="0"
                                      step="any"
                                      w="140px"
                                      value={
                                        Number.isFinite(line.unitCost)
                                          ? line.unitCost
                                          : ""
                                      }
                                      isDisabled={busy}
                                      onChange={(event) =>
                                        updateLine(index, {
                                          unitCost:
                                            event.target.value === ""
                                              ? NaN
                                              : Number(event.target.value),
                                        })
                                      }
                                    />
                                  </Td>
                                  <Td isNumeric>
                                    {number(line.quantity * line.unitCost)}
                                  </Td>
                                  <Td>
                                    <Button
                                      aria-label={`Retirer ${item?.name}`}
                                      variant="ghost"
                                      size="sm"
                                      isDisabled={busy}
                                      onClick={() => {
                                        setDraft((value) => ({
                                          ...value,
                                          lines: value.lines.filter(
                                            (_, position) => position !== index
                                          ),
                                        }));
                                        setDirty(true);
                                      }}
                                    >
                                      <FiTrash2 />
                                    </Button>
                                  </Td>
                                </Tr>
                              ))}
                              {!rows.length && (
                                <Tr>
                                  <Td
                                    colSpan={7}
                                    py={8}
                                    textAlign="center"
                                    color="gray.500"
                                  >
                                    Sélectionnez un article pour cet entrepôt.
                                  </Td>
                                </Tr>
                              )}
                            </Tbody>
                          </Table>
                        </TableContainer>
                      </Box>
                    </TabPanel>
                  );
                })}
              </TabPanels>
            </Tabs>
            <Flex
              mt={6}
              p={5}
              bg="white"
              border="1px solid #E5E5E5"
              borderRadius="12px"
              justify="space-between"
              align="center"
              gap={4}
              wrap="wrap"
            >
              <Box>
                <Text fontWeight="600">Total : {number(total)}</Text>
                <Text fontSize="sm" color="gray.600">
                  {draft.lines.length} ligne(s)
                </Text>
              </Box>
              <HStack spacing={3} wrap="wrap">
                <Button
                  variant="outline"
                  isLoading={busy}
                  isDisabled={!valid}
                  onClick={() => void save(false)}
                >
                  Sauvegarder brouillon
                </Button>
                <Button
                  {...primaryButton}
                  isLoading={busy}
                  isDisabled={!valid || !draft.lines.length}
                  onClick={() => void save(true)}
                >
                  Soumettre
                </Button>
              </HStack>
            </Flex>
            <Text mt={3} color="gray.600" fontSize="sm">
              Une connexion est nécessaire pour soumettre.
            </Text>
            {!valid && (
              <Alert status="warning" mt={3}>
                Entrez des quantités positives et des prix unitaires valides.
              </Alert>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
