import type { SkuNumberingSettings } from "../../../../common/types/inventory/StockSettings";
import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Skeleton,
  Stack,
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
import {
  FiArrowLeft,
  FiArrowRight,
  FiBox,
  FiPlus,
  FiSearch,
} from "react-icons/fi";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import type {
  InventoryItem,
  InventoryItemType,
} from "../../../../common/types/inventory/InventoryItem";
import type { InventoryUnit } from "../../../../common/types/inventory/InventoryUnit";
import type { InventoryCategory } from "../../../../common/types/inventory/InventoryCategory";
import InventoryItemForm, {
  itemTypeLabels,
  trackingLabels,
  primaryButton,
} from "../components/InventoryItemForm";

const PAGE_SIZE = 20;
export default function InventoryItemsPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  return companyId ? (
    <CompanyItems key={companyId} companyId={companyId} />
  ) : (
    <Alert bg="#F5F5F5">
      Connectez-vous à une entreprise pour consulter les articles.
    </Alert>
  );
}

function CompanyItems({ companyId }: { companyId: string }) {
  const [numbering, setNumbering] = useState<SkuNumberingSettings>({ enabled: false });
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<InventoryItemType | "">("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [optionsReady, setOptionsReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const toast = useToast();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const filters = {
          search,
          itemType: type || undefined,
          isActive: status ? status === "active" : undefined,
        };
        const [rows, count, options] = await Promise.all([
          window.electron.inventory.items.list(companyId, {
            ...filters,
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          }),
          window.electron.inventory.items.count(companyId, filters),
          window.electron.inventory.items.getCatalogOptions(companyId),
        ]);
        if (!active) return;
        if (page > 0 && page * PAGE_SIZE >= count) {
          setPage(Math.max(0, Math.ceil(count / PAGE_SIZE) - 1));
          return;
        }
        setItems(rows);
        setTotal(count);
        setUnits(options.units);
        setNumbering(options.numbering);
        setCategories(options.categories);
        setOptionsReady(true);
      } catch {
        if (active)
          setError("Impossible de charger le catalogue. Veuillez réessayer.");
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [companyId, search, type, status, page, refresh, syncVersion]);
  const filtered = Boolean(search || type || status);
  const reset = () => {
    setSearch("");
    setType("");
    setStatus("");
    setPage(0);
  };
  return (
    <Box
      minH="100%"
      bg="#FAFAFA"
      color="#262626"
      p={{ base: 5, lg: 9 }}
      pb={24}
    >
      <Flex
        justify="space-between"
        align={{ base: "start", lg: "center" }}
        gap={5}
        wrap="wrap"
        mb={9}
      >
        <Box position="relative" bottom="0.8rem">
          <Heading fontSize="28px" fontWeight="650" letterSpacing="-0.8px">
            Articles
          </Heading>
          <Text fontSize="sm" color="#737373">
            Catalogues de matières et produits
          </Text>
        </Box>
        <Button
          {...primaryButton}
          leftIcon={<FiPlus />}
          fontSize="sm"
          h="42px"
          px={5}
          borderRadius="8px"
          onClick={() => setCreating(true)}
          isDisabled={!optionsReady}
          position="relative"
          bottom="0.8rem"
        >
          Ajouter un article
        </Button>
      </Flex>
      <Box
        border="1px solid #E5E5E5"
        borderRadius="12px"
        bg="white"
        overflow="hidden"
        boxShadow="0 2px 6px rgba(0,0,0,0.02)"
      >
        <Flex
          px={6}
          py={5}
          align="center"
          justify="space-between"
          gap={3}
          borderBottom="1px solid #EAEAEA"
        >
          <HStack spacing={3}>
            <Icon as={FiBox} color="#737373" boxSize={5} />
            <Text fontWeight="600" fontSize="sm">
              Catalogue des articles
            </Text>
            <Badge
              bg="#F1F1F1"
              color="#525252"
              borderRadius="full"
              px={2.5}
              py={0.5}
              fontWeight="500"
            >
              {loading ? "…" : total}
            </Badge>
          </HStack>
          <Text
            fontSize="xs"
            color="#737373"
            display={{ base: "none", lg: "block" }}
          >
            Références, unités et règles de stock
          </Text>
        </Flex>
        <Flex p={5} gap={3} wrap="wrap" borderBottom="1px solid #EAEAEA">
          <InputGroup flex="1" minW="200px">
            <InputLeftElement pointerEvents="none" color="#909090">
              <FiSearch />
            </InputLeftElement>
            <Input
              aria-label="Rechercher un article"
              placeholder="Rechercher par nom ou référence…"
              maxLength={255}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              borderColor="#E5E5E5"
              focusBorderColor="#525252"
              fontSize="sm"
            />
          </InputGroup>
          <Select
            aria-label="Filtrer par type d’article"
            w={{ base: "100%", sm: "200px" }}
            value={type}
            onChange={(e) => {
              setType(e.target.value as InventoryItemType | "");
              setPage(0);
            }}
            borderColor="#E5E5E5"
            focusBorderColor="#525252"
            fontSize="sm"
          >
            <option value="">Tous les types</option>
            {Object.entries(itemTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrer par statut"
            w={{ base: "100%", sm: "150px" }}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            borderColor="#E5E5E5"
            focusBorderColor="#525252"
            fontSize="sm"
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </Select>
        </Flex>
        {error ? (
          <Stack p={8} align="start">
            <Text role="alert" fontSize="sm">
              {error}
            </Text>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Réessayer
            </Button>
          </Stack>
        ) : loading ? (
          <Stack
            p={6}
            spacing={5}
            aria-label="Chargement des articles"
            role="status"
          >
            {[0, 1, 2, 3, 4].map((value) => (
              <Skeleton
                key={value}
                height="36px"
                startColor="#F5F5F5"
                endColor="#E5E5E5"
              />
            ))}
          </Stack>
        ) : items.length === 0 ? (
          <Stack align="center" spacing={3} py={20} px={6} textAlign="center">
            <Flex
              bg="#F5F5F5"
              w={14}
              h={14}
              borderRadius="14px"
              align="center"
              justify="center"
              mb={2}
            >
              <FiBox size={25} color="#737373" />
            </Flex>
            <Text fontWeight="600">
              {filtered
                ? "Aucun article trouvé"
                : "Votre catalogue commence ici"}
            </Text>
            <Text fontSize="sm" color="#737373" maxW="350px">
              {filtered
                ? "Essayez une autre recherche ou modifiez vos filtres."
                : "Ajoutez vos matières et produits pour organiser votre inventaire."}
            </Text>
            <Button
              mt={2}
              variant="outline"
              size="sm"
              onClick={filtered ? reset : () => setCreating(true)}
            >
              {filtered
                ? "Réinitialiser les filtres"
                : "Ajouter votre premier article"}
            </Button>
          </Stack>
        ) : (
          <TableContainer>
            <Table
              variant="simple"
              size="md"
              sx={{
                th: {
                  bg: "#FAFAFA",
                  color: "#737373",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  fontWeight: 600,
                  py: 3.5,
                  borderColor: "#EAEAEA",
                },
                td: { borderColor: "#F0F0F0", py: 4, fontSize: "sm" },
              }}
            >
              <Thead>
                <Tr>
                  <Th>Article</Th>
                  <Th>Type</Th>
                  <Th>Unité</Th>
                  <Th>Suivi</Th>
                  <Th isNumeric>Seuil de réappro.</Th>
                  <Th>Statut</Th>
                </Tr>
              </Thead>
              <Tbody>
                {items.map((item) => (
                  <Tr key={item._id} _hover={{ bg: "#FCFCFC" }}>
                    <Td minW="230px" maxW="340px">
                      <Text fontWeight="600" isTruncated title={item.name}>
                        {item.name}
                      </Text>
                      <Text
                        color="#858585"
                        fontFamily="mono"
                        fontSize="xs"
                        mt={1}
                      >
                        {item.sku}
                      </Text>
                    </Td>
                    <Td color="#525252">{itemTypeLabels[item.itemType]}</Td>
                    <Td color="#525252">
                      {units.find((unit) => unit._id === item.baseUnitId)
                        ?.code ?? "—"}
                    </Td>
                    <Td color="#737373">
                      {trackingLabels[item.trackingMethod]}
                    </Td>
                    <Td isNumeric color="#525252">
                      {item.reorderPoint == null
                        ? "—"
                        : item.reorderPoint.toLocaleString("fr-FR")}
                    </Td>
                    <Td>
                      <Badge
                        textTransform="none"
                        fontSize="xs"
                        fontWeight="500"
                        bg={item.isActive ? "#EEEEEE" : "white"}
                        color={item.isActive ? "#333333" : "#858585"}
                        border="1px solid #E5E5E5"
                        borderRadius="full"
                        px={2.5}
                        py={0.5}
                      >
                        {item.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        )}
        <Flex
          px={5}
          py={4}
          borderTop="1px solid #EAEAEA"
          justify="space-between"
          align="center"
          gap={3}
          wrap="wrap"
        >
          <Text fontSize="xs" color="#737373" aria-live="polite">
            {loading
              ? "Chargement…"
              : error
              ? "Catalogue indisponible"
              : total
              ? `${page * PAGE_SIZE + 1}–${Math.min(
                  (page + 1) * PAGE_SIZE,
                  total
                )} sur ${total} articles`
              : "0 article"}
          </Text>
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              fontWeight="500"
              leftIcon={<FiArrowLeft />}
              isDisabled={loading || Boolean(error) || page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              fontWeight="500"
              rightIcon={<FiArrowRight />}
              isDisabled={
                loading || Boolean(error) || (page + 1) * PAGE_SIZE >= total
              }
              onClick={() => setPage((value) => value + 1)}
            >
              Suivant
            </Button>
          </HStack>
        </Flex>
      </Box>
      {creating && (
        <InventoryItemForm
          companyId={companyId}
          units={units}
          categories={categories}
          numbering={numbering}
          onClose={() => {
            setCreating(false);
            setRefresh((value) => value + 1);
          }}
          onSaved={(item) => {
            setCreating(false);
            reset();
            setRefresh((value) => value + 1);
            toast({
              title: "Article ajouté",
              description: `${item.sku} · ${item.name}`,
              duration: 4000,
              isClosable: true,
            });
          }}
        />
      )}
    </Box>
  );
}
