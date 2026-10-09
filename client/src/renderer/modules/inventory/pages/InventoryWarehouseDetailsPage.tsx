import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiEdit2, FiFolder, FiPlus } from "react-icons/fi";
import type {
  InventoryLocation,
  InventoryWarehouse,
} from "../../../../common/types/inventory/InventoryWarehouse";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import InventoryWarehouseForm from "../components/InventoryWarehouseForm";
import InventoryLocationForm, {
  locationTypeLabels,
} from "../components/InventoryLocationForm";

export default function InventoryWarehouseDetailsPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  const { warehouseId } = useParams();
  return companyId && warehouseId ? (
    <WarehouseDetails
      key={`${companyId}-${warehouseId}`}
      companyId={companyId}
      warehouseId={warehouseId}
    />
  ) : (
    <Alert>Entrepôt indisponible.</Alert>
  );
}
function WarehouseDetails({
  companyId,
  warehouseId,
}: {
  companyId: string;
  warehouseId: string;
}) {
  const [warehouse, setWarehouse] = useState<InventoryWarehouse | null>(null);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState(false);
  const [locationForm, setLocationForm] = useState<
    InventoryLocation | "new" | null
  >(null);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const toast = useToast();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      window.electron.inventory.warehouses.getById(companyId, warehouseId),
      window.electron.inventory.locations.getByWarehouse(
        companyId,
        warehouseId
      ),
    ])
      .then(([warehouse, locations]) => {
        if (active) {
          setWarehouse(warehouse);
          setLocations(locations);
        }
      })
      .catch(() => {
        if (active)
          setError("Impossible de charger l’entrepôt. Veuillez réessayer.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, warehouseId, refresh, syncVersion]);
  const saved = () => {
    setEditing(false);
    setLocationForm(null);
    setRefresh((value) => value + 1);
    toast({
      title: "Modifications enregistrées",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };
  // Render each location once, including legacy orphans/cycles without infinite recursion.
  const sortedLocations = [...locations].sort((a, b) =>
    a.code.localeCompare(b.code, "fr", { numeric: true, sensitivity: "base" })
  );
  const visited = new Set<string>();
  const children = new Map<string, InventoryLocation[]>();
  sortedLocations.forEach((location) => {
    const parent = location.parentId ?? "";
    children.set(parent, [...(children.get(parent) ?? []), location]);
  });
  function renderLocation(location: InventoryLocation): JSX.Element | null {
    if (visited.has(location._id)) return null;
    visited.add(location._id);
    return (
      <Box as="li" key={location._id} listStyleType="none" py={1}>
        <Flex
          align="center"
          justify="space-between"
          gap={3}
          p={3}
          bg="#FAFAFA"
          border="1px solid #EAEAEA"
          borderRadius="8px"
        >
          <HStack spacing={3} minW={0}>
            <FiFolder aria-hidden="true" />
            <Box minW={0}>
              <Text fontWeight="600" overflowWrap="anywhere">
                {location.name}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {location.code}
              </Text>
            </Box>
          </HStack>
          <HStack flexShrink={0}>
            <Badge textTransform="none">
              {locationTypeLabels[location.locationType] ??
                location.locationType}
            </Badge>
            {!location.isActive && <Badge colorScheme="gray">Inactif</Badge>}
            <IconButton
              aria-label={`Modifier ${location.name}`}
              icon={<FiEdit2 />}
              size="sm"
              variant="ghost"
              onClick={() => setLocationForm(location)}
            />
          </HStack>
        </Flex>
        {!!children.get(location._id)?.length && (
          <Box
            as="ul"
            pl={{ base: 3, md: 6 }}
            ml={3}
            mt={1}
            borderLeft="1px solid #D1D9E0"
          >
            {children.get(location._id)!.map(renderLocation)}
          </Box>
        )}
      </Box>
    );
  }
  const ids = new Set(locations.map((location) => location._id));
  const tree = sortedLocations
    .filter((location) => !location.parentId || !ids.has(location.parentId))
    .map(renderLocation);
  const detached = sortedLocations
    .filter((location) => !visited.has(location._id))
    .map(renderLocation);
  return (
    <Box
      p={{ base: 4, md: 6 }}
      h="100%"
      minH={0}
      overflow="hidden"
      display="flex"
      flexDirection="column"
      bg="#F8FAFC"
    >
      <Flex
        justify="space-between"
        align="start"
        gap={5}
        wrap="wrap"
        mb={8}
        flexShrink={0}
      >
        <HStack align="start" spacing={3}>
          <IconButton
            as={Link}
            to="/inventory/warehouses"
            aria-label="Retour aux entrepôts"
            icon={<FiArrowLeft />}
            variant="outline"
          />
          <Box>
            <Heading as="h1" fontSize="1.2rem" color="#03143B">
              {warehouse?.name ?? "Entrepôt"}
            </Heading>
            <Text mt={1} color="gray.500" fontSize="1rem" fontFamily="mono">
              {warehouse?.code}
            </Text>
          </Box>
        </HStack>
        <HStack flexWrap="wrap">
          <Button
            leftIcon={<FiEdit2 />}
            variant="outline"
            isDisabled={loading || !!error || !warehouse}
            onClick={() => setEditing(true)}
          >
            Modifier
          </Button>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="yellow"
            isDisabled={loading || !!error || !warehouse}
            onClick={() => setLocationForm("new")}
          >
            Nouvel emplacement
          </Button>
        </HStack>
      </Flex>
      {loading ? (
        <HStack role="status">
          <Spinner />
          <Text>Chargement de l’entrepôt…</Text>
        </HStack>
      ) : error ? (
        <Stack align="start">
          <Alert status="error">{error}</Alert>
          <Button onClick={() => setRefresh((value) => value + 1)}>
            Réessayer
          </Button>
        </Stack>
      ) : !warehouse ? (
        <Alert status="warning">Cet entrepôt est introuvable.</Alert>
      ) : (
        <Box
          mt={{ base: 0, md: "clamp(0rem, 8vh, 1rem)" }}
          flex="1"
          minH={0}
          overflowY="auto"
          overscrollBehavior="contain"
          bg="white"
          border="1px solid #E5E5E5"
          borderRadius="12px"
        >
          <HStack
            justify="space-between"
            position="sticky"
            top={0}
            zIndex={1}
            bg="white"
            p={{ base: 4, md: 6 }}
            borderBottom="1px solid #E5E5E5"
          >
            <Heading as="h2" size="sm">
              Emplacements
            </Heading>
            <Badge borderRadius="full" px={3}>
              {locations.length}
            </Badge>
          </HStack>
          {locations.length ? (
            <Box
              as="ul"
              p={{ base: 4, md: 6 }}
              aria-label="Arborescence des emplacements"
            >
              {tree}
              {detached}
            </Box>
          ) : (
            <Stack align="center" py={12}>
              <FiFolder size={30} />
              <Text>Aucun emplacement dans cet entrepôt.</Text>
              <Button variant="outline" onClick={() => setLocationForm("new")}>
                Créer un emplacement
              </Button>
            </Stack>
          )}
        </Box>
      )}
      {editing && warehouse && (
        <InventoryWarehouseForm
          companyId={companyId}
          warehouse={warehouse}
          locations={locations}
          onEditLocation={(location) => {
            setEditing(false);
            setLocationForm(location);
          }}
          onClose={() => setEditing(false)}
          onSaved={saved}
        />
      )}
      {locationForm && warehouse && (
        <InventoryLocationForm
          companyId={companyId}
          warehouse={warehouse}
          locations={locations}
          location={locationForm === "new" ? undefined : locationForm}
          onClose={() => setLocationForm(null)}
          onSaved={saved}
        />
      )}
    </Box>
  );
}
