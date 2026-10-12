import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiEdit2 } from "react-icons/fi";
import { FaArrowLeftLong } from "react-icons/fa6";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import type {
  InventoryItem,
  InventoryCostingMethod,
  InventoryTrackingMethod,
} from "../../../../common/types/inventory/InventoryItem";
import type { InventoryUnit } from "../../../../common/types/inventory/InventoryUnit";
import type { InventoryCategory } from "../../../../common/types/inventory/InventoryCategory";
import {
  inventoryError,
  itemTypeLabels,
  trackingLabels,
} from "../components/InventoryItemForm";

const costingLabels: Record<InventoryCostingMethod, string> = {
  AVERAGE: "Coût moyen pondéré",
  FIFO: "FIFO (premier entré, premier sorti)",
  STANDARD: "Coût standard",
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Text fontSize="sm" color="gray.500" mb={1}>
        {label}
      </Text>
      <Box overflowWrap="anywhere">{children}</Box>
    </Box>
  );
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR");
}

export default function InventoryItemDetailsPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  const { itemId } = useParams<{ itemId: string }>();
  return companyId && itemId ? (
    <CompanyItem
      key={`${companyId}:${itemId}`}
      companyId={companyId}
      itemId={itemId}
    />
  ) : (
    <Alert status="warning">
      Connectez-vous à une entreprise pour consulter cet article.
    </Alert>
  );
}

function CompanyItem({
  companyId,
  itemId,
}: {
  companyId: string;
  itemId: string;
}) {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const toast = useToast();

  useEffect(() => {
    if (editing) return;
    let active = true;
    Promise.all([
      window.electron.inventory.items.getById(companyId, itemId),
      window.electron.inventory.items.getCatalogOptions(companyId),
    ])
      .then(([record, options]) => {
        if (!active) return;
        setError("");
        setItem(record);
        setUnits(options.units);
        setCategories(options.categories);
      })
      .catch(() => {
        if (active)
          setError("Impossible de charger cet article. Veuillez réessayer.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, itemId, syncVersion, refresh, editing]);

  const unit = units.find((entry) => entry._id === item?.baseUnitId);
  const category = categories.find((entry) => entry._id === item?.categoryId);
  return (
    <Box h="100%" overflowY="auto" bg="#FAFAFA" p={{ base: 3, md: 6 }}>
      {loading ? (
        <Stack role="status" aria-label="Chargement de l’article">
          <Skeleton h="40px" />
          <Skeleton h="300px" />
        </Stack>
      ) : error ? (
        <Stack>
          <Alert status="error">{error}</Alert>
          <Button
            alignSelf="start"
            onClick={() => {
              setLoading(true);
              setRefresh((value) => value + 1);
            }}
          >
            Réessayer
          </Button>
        </Stack>
      ) : !item ? (
        <Alert status="info">
          Cet article est introuvable ou a été supprimé.
        </Alert>
      ) : (
        <Stack spacing={6}>
          <Flex justify="space-between" align="start" gap={4} wrap="wrap">
            <Box minW={0}>
              <HStack>
                <Button as={Link} to="/inventory/items" variant="ghost" mb={5}>
                  <FaArrowLeftLong color="black" />
                </Button>
                <Box>
                  <Heading
                    as="h1"
                    fontSize="1.4rem"
                    color="#03143B"
                    overflowWrap="anywhere"
                  >
                    {item.name}
                  </Heading>
                  <Text color="gray.500" mt={1}>
                    {item.sku}
                  </Text>
                  <Badge mt={2}>{item.isActive ? "Actif" : "Inactif"}</Badge>
                </Box>
              </HStack>
            </Box>
            {!editing && (
              <Button
                colorScheme="yellow"
                leftIcon={<FiEdit2 />}
                onClick={() => setEditing(true)}
              >
                Modifier
              </Button>
            )}
          </Flex>
          <Box
            bg="white"
            border="1px solid #E5E5E5"
            borderRadius="12px"
            p={{ base: 4, md: 6 }}
          >
            <Heading as="h2" size="sm" mb={5}>
              Paramètres de l’article
            </Heading>
            {editing ? (
              <ItemEditor
                item={item}
                companyId={companyId}
                onCancel={() => setEditing(false)}
                onSaved={(saved) => {
                  setItem(saved);
                  setEditing(false);
                  toast({
                    title: "Article modifié",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                  });
                }}
              />
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
                <Detail label="Nom de l’article">{item.name}</Detail>
                <Detail label="Numéro SKU">{item.sku}</Detail>
                <Detail label="Méthode de suivi">
                  {trackingLabels[item.trackingMethod]}
                </Detail>
                <Detail label="Méthode de valorisation">
                  {item.costingMethod
                    ? costingLabels[item.costingMethod]
                    : "Non définie"}
                </Detail>
                <Detail label="Seuil de réapprovisionnement">
                  {item.reorderPoint?.toLocaleString("fr-FR") ?? "Non défini"}
                </Detail>
                <Detail label="Quantité de réapprovisionnement">
                  {item.reorderQuantity?.toLocaleString("fr-FR") ??
                    "Non définie"}
                </Detail>
              </SimpleGrid>
            )}
          </Box>
          <Box
            bg="white"
            border="1px solid #E5E5E5"
            borderRadius="12px"
            p={{ base: 4, md: 6 }}
          >
            <Heading as="h2" size="sm" mb={5}>
              Informations complémentaires
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
              <Detail label="Type">{itemTypeLabels[item.itemType]}</Detail>
              <Detail label="Catégorie">
                {category?.name ?? item.categoryId ?? "Aucune"}
              </Detail>
              <Detail label="Unité de base">
                {unit ? `${unit.name} (${unit.code})` : item.baseUnitId}
              </Detail>
              <Detail label="Description">
                <Text whiteSpace="pre-wrap">
                  {item.description || "Aucune description"}
                </Text>
              </Detail>
              <Detail label="Créé le">{dateLabel(item.createdAt)}</Detail>
              <Detail label="Modifié le">{dateLabel(item.updatedAt)}</Detail>
            </SimpleGrid>
          </Box>
        </Stack>
      )}
    </Box>
  );
}

function ItemEditor({
  item,
  companyId,
  onCancel,
  onSaved,
}: {
  item: InventoryItem;
  companyId: string;
  onCancel: () => void;
  onSaved: (item: InventoryItem) => void;
}) {
  const [name, setName] = useState(item.name);
  const [sku, setSku] = useState(item.sku);
  const [trackingMethod, setTrackingMethod] = useState(item.trackingMethod);
  const [costingMethod, setCostingMethod] = useState<
    InventoryCostingMethod | ""
  >(item.costingMethod ?? "");
  const [reorderPoint, setReorderPoint] = useState(
    item.reorderPoint?.toString() ?? ""
  );
  const [reorderQuantity, setReorderQuantity] = useState(
    item.reorderQuantity?.toString() ?? ""
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!name.trim() || !sku.trim()) {
      setError("Le nom et le numéro SKU sont obligatoires.");
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
        "Le seuil doit être positif ou nul et la quantité strictement positive."
      );
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const saved = await window.electron.inventory.items.update(companyId, {
        id: item._id,
        name: name.trim(),
        sku: sku.trim(),
        trackingMethod,
        costingMethod: costingMethod || null,
        reorderPoint: reorderPoint === "" ? null : Number(reorderPoint),
        reorderQuantity:
          reorderQuantity === "" ? null : Number(reorderQuantity),
      });
      onSaved(saved);
    } catch (cause) {
      setError(inventoryError(cause));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Box as="form" onSubmit={save}>
      <Stack spacing={5}>
        {error && <Alert status="error">{error}</Alert>}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
          <FormControl isRequired isDisabled={saving}>
            <FormLabel>Nom de l’article</FormLabel>
            <Input
              autoFocus
              value={name}
              maxLength={255}
              onChange={(event) => setName(event.target.value)}
            />
          </FormControl>
          <FormControl isRequired isDisabled={saving}>
            <FormLabel>Numéro SKU</FormLabel>
            <Input
              value={sku}
              maxLength={100}
              onChange={(event) => setSku(event.target.value)}
            />
          </FormControl>
          <FormControl isDisabled={saving}>
            <FormLabel>Méthode de suivi</FormLabel>
            <Select
              value={trackingMethod}
              onChange={(event) =>
                setTrackingMethod(event.target.value as InventoryTrackingMethod)
              }
            >
              {Object.entries(trackingLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl isDisabled={saving}>
            <FormLabel>Méthode de valorisation</FormLabel>
            <Select
              value={costingMethod}
              onChange={(event) =>
                setCostingMethod(
                  event.target.value as InventoryCostingMethod | ""
                )
              }
            >
              <option value="">Non définie</option>
              {Object.entries(costingLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl isDisabled={saving}>
            <FormLabel>Seuil de réapprovisionnement</FormLabel>
            <Input
              type="number"
              min={0}
              step="any"
              value={reorderPoint}
              onChange={(event) => setReorderPoint(event.target.value)}
            />
          </FormControl>
          <FormControl isDisabled={saving}>
            <FormLabel>Quantité de réapprovisionnement</FormLabel>
            <Input
              type="number"
              min={0}
              step="any"
              value={reorderQuantity}
              onChange={(event) => setReorderQuantity(event.target.value)}
            />
          </FormControl>
        </SimpleGrid>
        <HStack justify="end">
          <Button variant="outline" isDisabled={saving} onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" colorScheme="yellow" isLoading={saving}>
            Enregistrer
          </Button>
        </HStack>
      </Stack>
    </Box>
  );
}
