import { Text, type TextProps } from "@chakra-ui/react";

export default function PageSubtitle(props: TextProps) {
  return (
    <Text
      {...props}
      fontWeight="500"
      color="gray.500"
      fontSize={{
        base: "0.7rem",
        sm: "0.75rem",
        md: "0.8rem",
        lg: "0.85rem",
      }}
      letterSpacing="-0.01em"
      lineHeight="1.3"
      whiteSpace="nowrap"
      wordBreak="normal"
      overflowWrap="normal"
    />
  );
}
