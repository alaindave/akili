import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { FaSyncAlt } from "react-icons/fa";
import useAdminUser from "../../store/auth.store";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const user = useAdminUser((store) => store.adminUser);

  const handleSync = async () => {
    try {
      setLoading(true);
      const result = await window.electron.sync.sync(user.companyId);
      if (result.success) {
        console.log("SYNC COMPLETED");
      } else {
        console.error(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      bg="transparent"
      onClick={handleSync}
      isLoading={loading}
      color="gray.800"
      _hover={{ bg: "transparent" }}
      fontSize="1.1rem"
    >
      <FaSyncAlt />
    </Button>
  );
}
