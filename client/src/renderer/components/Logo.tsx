import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
// @ts-ignore
import defaultLogo from "../assets/afritan_logo.png";
import "../styles/App.css";
import useAdminUser from "../../store/auth.store";

interface Props {
  text: string;
}

const Logo = ({ text }: Props) => {
  const user = useAdminUser((store) => store.adminUser);

  const [logoSrc, setLogoSrc] = useState<string>(defaultLogo);

  const [companyName, setCompanyName] = useState("AFRITAN");

  useEffect(() => {
    let cancelled = false;

    const loadCompanyLogo = async () => {
      try {
        if (!user?.companyId) {
          return;
        }

        const company = await window.electron.company.getById(user.companyId);

        if (cancelled || !company) {
          return;
        }

        /**
         * Use the company name stored in SQLite.
         */
        if (company.name?.trim()) {
          console.log("COMPANY NAME", company.name);
          setCompanyName(company.name.trim());
        }

        /**
         * If the company has a stored logo,
         * resolve its local path through Electron.
         */
        if (company.logoPath) {
          const logoUrl = await window.electron.company.getLogoUrl(
            company.logoPath
          );

          console.log("FETCHED LOGO URL", logoUrl);

          if (!cancelled && logoUrl) {
            setLogoSrc(logoUrl);
          }
        }
      } catch (error) {
        console.error("Failed to load company logo:", error);

        /**
         * Keep the default bundled logo
         * if the stored logo cannot be loaded.
         */
        if (!cancelled) {
          setLogoSrc(defaultLogo);
        }
      }
    };

    loadCompanyLogo();

    return () => {
      cancelled = true;
    };
  }, [user?.companyId]);

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
      <Link to="/admin">
        <Image
          src={logoSrc}
          width={{
            base: "4rem",
            sm: "4.5rem",
            md: "5rem",
          }}
          height={{
            base: "4rem",
            sm: "4.5rem",
            md: "5rem",
          }}
          objectFit="contain"
          fallbackSrc={defaultLogo}
        />
      </Link>

      {/* Text */}
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
          whiteSpace="nowrap"
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
    </Flex>
  );
};

export default Logo;
