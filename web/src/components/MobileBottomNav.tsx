import { CalendarCheckIcon, LandmarkIcon, MessageCircleIcon, UserCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { useTranslate } from "@/utils/i18n";

const MobileBottomNav = () => {
  const t = useTranslate();
  const [mounted, setMounted] = useState(false);
  const [baseHeight, setBaseHeight] = useState<number | null>(null);
  const [navOffset, setNavOffset] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const updateBaseHeight = () => {
      setBaseHeight(window.innerHeight);
    };

    updateBaseHeight();

    let raf = 0;
    const handleResize = () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      raf = requestAnimationFrame(() => {
        if (!baseHeight) {
          return;
        }
        const offset = Math.max(0, baseHeight - window.innerHeight);
        setNavOffset(offset);
      });
    };

    const handleOrientationChange = () => {
      window.setTimeout(() => {
        updateBaseHeight();
        setNavOffset(0);
      }, 250);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, [baseHeight]);

  const items = [
    {
      to: Routes.EXPLORE,
      label: t("common.explore"),
      icon: MessageCircleIcon,
    },
    {
      to: Routes.TODOS,
      label: t("common.todo"),
      icon: CalendarCheckIcon,
    },
    {
      to: Routes.LOANS,
      label: t("common.loan"),
      icon: LandmarkIcon,
    },
    {
      to: Routes.HOME,
      label: t("common.memo"),
      icon: UserCircleIcon,
    },
  ];

  if (!mounted) {
    return null;
  }

  return createPortal(
    <nav
      className="fixed left-0 right-0 bottom-0 z-50 w-full px-0 pb-0 sm:hidden"
      style={{
        transform: `translate3d(0, ${navOffset}px, 0)`,
        height: "52px",
      }}
    >
      <div className="flex h-full w-full items-center justify-between border-t border-border/60 bg-background px-2 py-1 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "group flex flex-1 flex-col items-center gap-0.5 rounded-none px-2 py-1 text-[10px] font-semibold transition-all",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("h-5 w-5 transition-transform group-hover:scale-105", isActive && "scale-110 stroke-[2.5]")} />
                <span className="leading-none">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>,
    document.body,
  );
};

export default MobileBottomNav;
