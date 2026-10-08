import { useState } from "react";
import { Box, Button, Center, SimpleGrid, Text, useToast } from "@chakra-ui/react";
import { FiArrowDownLeft, FiArrowUpRight, FiPlus, FiRepeat } from "react-icons/fi";
import InventoryItemForm from "./InventoryItemForm";

type CatalogOptions = Awaited<ReturnType<typeof window.electron.inventory.items.getCatalogOptions>>;

export default function InventoryQuickActions({ companyId, onSaved }: { companyId: string; onSaved: () => void }) {
  const [options, setOptions] = useState<CatalogOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function createItem() {
    setLoading(true);
    try {
      setOptions(await window.electron.inventory.items.getCatalogOptions(companyId));
    } catch {
      toast({ title: "Impossible d’ouvrir le formulaire", description: "Veuillez réessayer.", status: "error", isClosable: true });
    } finally { setLoading(false); }
  }

  const unavailable = (label: string) => toast({
    title: label, description: "Cette fonctionnalité n’est pas encore disponible.",
    status: "info", duration: 4000, isClosable: true,
  });
  const actions = [
    { label: "Nouvel article", icon: FiPlus, color: "blue.400", onClick: createItem },
    { label: "Entrée de stock", icon: FiArrowDownLeft, color: "green.400", onClick: () => unavailable("Entrée de stock") },
    { label: "Sortie de stock", icon: FiArrowUpRight, color: "purple.400", onClick: () => unavailable("Sortie de stock") },
    { label: "Transfert", icon: FiRepeat, color: "orange.400", onClick: () => unavailable("Transfert") },
  ];

  return (
    <Box as="nav" aria-label="Actions rapides" bg="linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))"
      border="1px solid rgba(255,255,255,0.12)" boxShadow="0 2px 8px rgba(0,0,0,0.5)" borderRadius="md"
      minH="50px" maxW="1050px" w="100%" mx="auto" p={2}>
      <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={{ base: 2, lg: 4 }}>
        {actions.map(({ label, icon: Icon, color, onClick }, index) => (
          <Button key={label} fontWeight="600" fontSize="0.95rem" bg="transparent" h="auto" minH="34px"
            py={1} px={2} justifyContent="start" whiteSpace="normal" _hover={{ bg: "blackAlpha.100" }}
            onClick={onClick} isLoading={index === 0 && loading} isDisabled={!companyId}>
            <Center boxSize="1.8rem" bg={color} color="white" borderRadius="md" flexShrink={0} mr={3}><Icon size={16} /></Center>
            <Text>{label}</Text>
          </Button>
        ))}
      </SimpleGrid>
      {options && <InventoryItemForm companyId={companyId} units={options.units} categories={options.categories}
        numbering={options.numbering} onClose={() => setOptions(null)} onSaved={item => {
          setOptions(null); onSaved();
          toast({ title: "Article ajouté", description: `${item.sku} · ${item.name}`, status: "success", duration: 4000, isClosable: true });
        }} />}
    </Box>
  );
}
