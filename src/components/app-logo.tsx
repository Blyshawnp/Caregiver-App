"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type AppLogoVariant = "auth" | "header" | "compact";

const logoSizes: Record<
  AppLogoVariant,
  {
    wrapper: string;
    image: string;
    width: number;
    height: number;
    sizes: string;
    fallback: string;
  }
> = {
  auth: {
    wrapper: "w-[220px] sm:w-[260px]",
    image: "w-[220px] sm:w-[260px] h-auto",
    width: 260,
    height: 146,
    sizes: "(min-width: 640px) 260px, 220px",
    fallback: "w-[220px] sm:w-[260px] min-h-[82px] text-base",
  },
  header: {
    wrapper: "w-[120px] sm:w-[150px]",
    image: "w-[120px] sm:w-[150px] h-auto",
    width: 150,
    height: 84,
    sizes: "(min-width: 640px) 150px, 120px",
    fallback: "w-[120px] sm:w-[150px] min-h-[54px] text-[10px]",
  },
  compact: {
    wrapper: "w-32",
    image: "w-32 h-auto",
    width: 128,
    height: 72,
    sizes: "128px",
    fallback: "w-32 min-h-[46px] text-[9px]",
  },
};

export default function AppLogo({
  href = "/home",
  showText = true,
  textSize = "text-[11px]",
  variant = "compact",
  className = "",
}: {
  href?: string;
  showText?: boolean;
  textSize?: string;
  variant?: AppLogoVariant;
  className?: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const size = logoSizes[variant];

  return (
    <Link
      href={href}
      aria-label="Caregiver App home"
      className={`flex items-center gap-3 min-w-0 ${className}`}
    >
      <span className={`relative shrink-0 overflow-visible ${size.wrapper}`}>
        {logoFailed ? (
          <span
            className={`flex items-center justify-center text-center font-extrabold uppercase leading-none text-forest-700 ${size.fallback}`}
          >
            Caregiver App
          </span>
        ) : (
          <Image
            src="/CVPlogo.png"
            alt="Caregiver App"
            width={size.width}
            height={size.height}
            sizes={size.sizes}
            priority
            onError={() => setLogoFailed(true)}
            className={`object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)] ${size.image}`}
          />
        )}
      </span>
      {(showText || logoFailed) && (
        <span className="min-w-0 leading-none">
          <span className={`block uppercase tracking-[0.18em] font-extrabold text-forest-700 ${textSize} truncate`}>
            Caregiver App
          </span>
        </span>
      )}
    </Link>
  );
}
