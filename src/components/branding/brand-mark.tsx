import Image from "next/image";
import { cn } from "@/lib/utils";

/** Original geometric H monogram; surrounding text supplies the brand name. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/icon.svg"
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      className={cn("size-11 shrink-0", className)}
    />
  );
}
