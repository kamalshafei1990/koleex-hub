"use client";

/* ---------------------------------------------------------------------------
   AppIcon — THE app's identity glyph, wherever it appears.

   An app is shown in three places: its launcher tile, its sidebar row, and
   its own page header. The first two already resolved through the Semantic
   Icon Registry (BoundIcon), while every page header hardcoded its own
   import — so the two drifted apart. The owner found it on Product Data:
   "the small app icon inside the icon is different from outside app icon,
   they should always [be] linked together". Twelve apps had genuinely
   different glyphs, and the rest were one Visual Library binding away from
   the same fate.

   This component is the single mechanism: pass the app id, get the bound
   icon with the REGISTRY entry as the fallback. Nothing to keep in sync,
   and re-binding `app.<id>` in the Visual Library now moves the tile, the
   sidebar row and the page header together.

   Use it for an app's own hero icon. Content icons (a bell inside
   Notifications, a folder inside Taxonomy) are not app identity and stay
   as they are.
   --------------------------------------------------------------------------- */

import BoundIcon from "@/components/common/BoundIcon";
import { APP_REGISTRY } from "@/lib/navigation";

export default function AppIcon({
  appId,
  className = "h-5 w-5",
  size = 20,
}: {
  /** Registry id, e.g. "crm" — the same id the launcher and sidebar use. */
  appId: string;
  className?: string;
  /** Size handed to the fallback component; the bound SVG uses className. */
  size?: number;
}) {
  const Fallback = APP_REGISTRY.find((a) => a.id === appId)?.icon;
  return (
    <BoundIcon
      semanticKey={`app.${appId}`}
      className={className}
      fallback={Fallback ? <Fallback size={size} className={className} /> : null}
    />
  );
}
