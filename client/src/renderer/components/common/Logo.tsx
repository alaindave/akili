import { Box, Flex, Image, Skeleton, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import defaultLogo from "../../../renderer/assets/AkiliLogo.png";
import type { CompanyBranding } from "../../../common/types/shared/Company";
import "../../styles/App.css";
import useSyncStore from "../../../store/sync.store";

interface Props {
  text?: string;
  companyId?: string;
  showCompanyName: boolean;
  width: string;
  height: string;
  isDisabled?: boolean;
}

const Logo = ({
  text,
  companyId,
  showCompanyName,
  width,
  height,
  isDisabled,
}: Props) => {
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const [branding, setBranding] = useState<
    (CompanyBranding & { companyId: string }) | null
  >(null);
  const selectedBranding = branding?.companyId === companyId ? branding : null;
  const isLoading = Boolean(companyId) && !selectedBranding;
  const logoSrc = selectedBranding?.logoUrl || defaultLogo;
  const companyName = selectedBranding?.name.trim() || "";

  useEffect(() => {
    let cancelled = false;
    const loadCompanyLogo = async () => {
      try {
        if (companyId) {
          const company = await window.electron.company.getBranding(companyId);
          let logoUrl = company?.logoUrl ?? null;

          if (logoUrl) {
            const source = logoUrl;
            const image = new window.Image();
            const loaded = await new Promise<boolean>((resolve) => {
              image.onload = () => resolve(true);
              image.onerror = () => resolve(false);
              image.src = source;
            });
            if (!loaded) logoUrl = null;
          }

          if (cancelled) {
            return;
          }
          setBranding({ name: company?.name ?? "", logoUrl, companyId });
        }
      } catch (error) {
        console.error("Failed to load company logo:", error);

        if (!cancelled && companyId) {
          // Keep existing branding on refresh errors; use Akili on initial failure.
          setBranding((previous) =>
            previous?.companyId === companyId
              ? previous
              : { companyId, name: "", logoUrl: null }
          );
        }
      }
    };

    loadCompanyLogo();

    return () => {
      cancelled = true;
    };
  }, [companyId, syncVersion]);

  return (
    <Flex
      align="center"
      width="fit-content"
      maxWidth="100%"
      gap={{
        base: "4px",
        sm: "6px",
        md: "8px",
      }}
    >
      {/* Logo */}
      <Link
        to="/admin"
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault(); // Prevents React Router navigation
          }
        }}
        style={{
          pointerEvents: isDisabled ? "none" : "auto",
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
      >
        {isLoading ? (
          <Skeleton width={width} height={height} borderRadius="md" />
        ) : (
          <Image
            src={logoSrc}
            width={width}
            height={height}
            objectFit="contain"
            ignoreFallback
            onError={(event) => {
              if (event.currentTarget.getAttribute("src") !== defaultLogo) {
                event.currentTarget.src = defaultLogo;
              }
            }}
          />
        )}
      </Link>

      {/* Text */}
      {showCompanyName && (
        <Box
          minWidth={0}
          display="flex"
          flexDirection="column"
          justifyContent="center"
        >
          {/* Company name */}
          <Text
            color="#1F2937"
            fontSize={{
              base: "20px",
              sm: "22px",
              md: "25px",
            }}
            fontWeight="700"
            lineHeight="1.1"
            whiteSpace="normal"
          >
            {companyName}
          </Text>

          {/* Subtitle */}
          <Text
            marginTop={{
              base: "1px",
              sm: "1px",
              md: "2px",
            }}
            mr="0.8rem"
            fontSize={{
              base: "0.7rem",
              sm: "0.8rem",
              md: "0.85rem",
            }}
            lineHeight="1.3"
            color="gray.800"
            fontWeight="400"
            whiteSpace="nowrap"
          >
            {text}
          </Text>
        </Box>
      )}
    </Flex>
  );
};

export default Logo;
