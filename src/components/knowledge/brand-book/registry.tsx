"use client";

/* ---------------------------------------------------------------------------
   Which component draws which chapter.

   Each chapter file is its own chunk (next/dynamic in a client module is a
   real split): opening chapter 36 downloads the logo chapters, not the
   color or typography ones. The placeholder holds the page's height so the
   footer does not jump when the chapter arrives.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-4 w-40 rounded bg-[var(--bg-surface)]" />
      <div className="h-10 w-2/3 rounded bg-[var(--bg-surface)]" />
      <div className="h-[60vh] rounded-2xl bg-[var(--bg-surface-subtle)]" />
    </div>
  );
}

/* next/dynamic needs its options written inline at every call (it is a
   compile-time transform), hence the repetition. */

export const CHAPTER_VIEWS: Record<string, ComponentType> = {
  "welcome": dynamic(() => import("./chapters/intro").then((m) => m.Welcome), { loading: Loading }),
  "how-to-use": dynamic(() => import("./chapters/intro").then((m) => m.HowToUse), { loading: Loading }),
  "at-a-glance": dynamic(() => import("./chapters/intro").then((m) => m.AtAGlance), { loading: Loading }),
  "logo": dynamic(() => import("./chapters/logo").then((m) => m.Logo), { loading: Loading }),
  "logo-construction": dynamic(() => import("./chapters/logo").then((m) => m.Construction), { loading: Loading }),
  "logo-size-placement": dynamic(() => import("./chapters/logo").then((m) => m.SizePlacement), { loading: Loading }),
  "logo-backgrounds": dynamic(() => import("./chapters/logo").then((m) => m.Backgrounds), { loading: Loading }),
  "logo-misuse": dynamic(() => import("./chapters/logo").then((m) => m.Misuse), { loading: Loading }),
  "k-monogram": dynamic(() => import("./chapters/marks").then((m) => m.KMonogram), { loading: Loading }),
  "hub-mark": dynamic(() => import("./chapters/marks").then((m) => m.HubMarkChapter), { loading: Loading }),
  "lockups": dynamic(() => import("./chapters/marks").then((m) => m.Lockups), { loading: Loading }),
  "co-branding": dynamic(() => import("./chapters/marks").then((m) => m.CoBranding), { loading: Loading }),
  "color-palette": dynamic(() => import("./chapters/color").then((m) => m.ColorPalette), { loading: Loading }),
  "hub-blue": dynamic(() => import("./chapters/color").then((m) => m.HubBlue), { loading: Loading }),
  "color-usage": dynamic(() => import("./chapters/color").then((m) => m.ColorUsage), { loading: Loading }),
  "color-print": dynamic(() => import("./chapters/color").then((m) => m.ColorPrint), { loading: Loading }),
  "contrast": dynamic(() => import("./chapters/color").then((m) => m.Contrast), { loading: Loading }),
  "typefaces": dynamic(() => import("./chapters/type").then((m) => m.Typefaces), { loading: Loading }),
  "type-scale": dynamic(() => import("./chapters/type").then((m) => m.TypeScale), { loading: Loading }),
  "arabic-type": dynamic(() => import("./chapters/type").then((m) => m.ArabicType), { loading: Loading }),
  "chinese-type": dynamic(() => import("./chapters/type").then((m) => m.ChineseType), { loading: Loading }),
  "multilingual": dynamic(() => import("./chapters/type").then((m) => m.Multilingual), { loading: Loading }),
  "grid-layout": dynamic(() => import("./chapters/layout").then((m) => m.GridLayout), { loading: Loading }),
  "spacing-shapes": dynamic(() => import("./chapters/layout").then((m) => m.SpacingShapes), { loading: Loading }),
  "graphic-elements": dynamic(() => import("./chapters/layout").then((m) => m.GraphicElements), { loading: Loading }),
  "icons": dynamic(() => import("./chapters/icons").then((m) => m.Icons), { loading: Loading }),
  "machine-icons": dynamic(() => import("./chapters/icons").then((m) => m.MachineIcons), { loading: Loading }),
  "illustration": dynamic(() => import("./chapters/icons").then((m) => m.Illustration), { loading: Loading }),
  "infographics": dynamic(() => import("./chapters/icons").then((m) => m.Infographics), { loading: Loading }),
  "tables-numbers": dynamic(() => import("./chapters/icons").then((m) => m.TablesNumbers), { loading: Loading }),
  "photo-principles": dynamic(() => import("./chapters/photo").then((m) => m.PhotoPrinciples), { loading: Loading }),
  "studio-photo": dynamic(() => import("./chapters/photo").then((m) => m.StudioPhoto), { loading: Loading }),
  "mobile-photo": dynamic(() => import("./chapters/photo").then((m) => m.MobilePhoto), { loading: Loading }),
  "people-photo": dynamic(() => import("./chapters/photo").then((m) => m.PeoplePhoto), { loading: Loading }),
  "factory-photo": dynamic(() => import("./chapters/photo").then((m) => m.FactoryPhoto), { loading: Loading }),
  "event-photo": dynamic(() => import("./chapters/photo").then((m) => m.EventPhoto), { loading: Loading }),
  "image-editing": dynamic(() => import("./chapters/photo").then((m) => m.ImageEditing), { loading: Loading }),
  "video": dynamic(() => import("./chapters/motion").then((m) => m.Video), { loading: Loading }),
  "video-kit": dynamic(() => import("./chapters/motion").then((m) => m.VideoKit), { loading: Loading }),
  "motion": dynamic(() => import("./chapters/motion").then((m) => m.Motion), { loading: Loading }),
  "logo-animation": dynamic(() => import("./chapters/motion").then((m) => m.LogoAnimation), { loading: Loading }),
  "sound": dynamic(() => import("./chapters/motion").then((m) => m.Sound), { loading: Loading }),
  "website": dynamic(() => import("./chapters/digital").then((m) => m.Website), { loading: Loading }),
  "hub-core": dynamic(() => import("./chapters/digital").then((m) => m.HubCore), { loading: Loading }),
  "hub-aurora": dynamic(() => import("./chapters/digital").then((m) => m.HubAurora), { loading: Loading }),
  "email": dynamic(() => import("./chapters/digital").then((m) => m.Email), { loading: Loading }),
  "social-profiles": dynamic(() => import("./chapters/social").then((m) => m.SocialProfiles), { loading: Loading }),
  "post-templates": dynamic(() => import("./chapters/social").then((m) => m.PostTemplates), { loading: Loading }),
  "facebook": dynamic(() => import("./chapters/social").then((m) => m.Facebook), { loading: Loading }),
  "instagram": dynamic(() => import("./chapters/social").then((m) => m.Instagram), { loading: Loading }),
  "linkedin": dynamic(() => import("./chapters/social").then((m) => m.LinkedIn), { loading: Loading }),
  "tiktok-douyin": dynamic(() => import("./chapters/social").then((m) => m.TikTokDouyin), { loading: Loading }),
  "youtube": dynamic(() => import("./chapters/social").then((m) => m.YouTube), { loading: Loading }),
  "x": dynamic(() => import("./chapters/social").then((m) => m.XPlatform), { loading: Loading }),
  "wechat": dynamic(() => import("./chapters/social").then((m) => m.WeChat), { loading: Loading }),
  "whatsapp": dynamic(() => import("./chapters/social").then((m) => m.WhatsApp), { loading: Loading }),
  "digital-ads": dynamic(() => import("./chapters/present").then((m) => m.DigitalAds), { loading: Loading }),
  "presentations": dynamic(() => import("./chapters/present").then((m) => m.Presentations), { loading: Loading }),
  "business-cards": dynamic(() => import("./chapters/present").then((m) => m.BusinessCards), { loading: Loading }),
  "letterhead": dynamic(() => import("./chapters/present").then((m) => m.Letterhead), { loading: Loading }),
  "email-signature": dynamic(() => import("./chapters/present").then((m) => m.EmailSignature), { loading: Loading }),
  "sales-documents": dynamic(() => import("./chapters/documents").then((m) => m.SalesDocuments), { loading: Loading }),
  "contracts": dynamic(() => import("./chapters/documents").then((m) => m.Contracts), { loading: Loading }),
  "shipping-documents": dynamic(() => import("./chapters/documents").then((m) => m.ShippingDocuments), { loading: Loading }),
  "purchase-orders": dynamic(() => import("./chapters/documents").then((m) => m.PurchaseOrders), { loading: Loading }),
  "finance-documents": dynamic(() => import("./chapters/documents").then((m) => m.FinanceDocuments), { loading: Loading }),
  "certificates": dynamic(() => import("./chapters/documents").then((m) => m.Certificates), { loading: Loading }),
  "letters": dynamic(() => import("./chapters/documents").then((m) => m.Letters), { loading: Loading }),
  "hr-documents": dynamic(() => import("./chapters/documents").then((m) => m.HrDocuments), { loading: Loading }),
  "company-profile": dynamic(() => import("./chapters/print").then((m) => m.CompanyProfile), { loading: Loading }),
  "catalogs": dynamic(() => import("./chapters/print").then((m) => m.Catalogs), { loading: Loading }),
  "brochures": dynamic(() => import("./chapters/print").then((m) => m.Brochures), { loading: Loading }),
  "spec-sheets": dynamic(() => import("./chapters/print").then((m) => m.SpecSheets), { loading: Loading }),
  "posters": dynamic(() => import("./chapters/print").then((m) => m.Posters), { loading: Loading }),
  "downloads": dynamic(() => import("./chapters/downloads").then((m) => m.DownloadsChapter), { loading: Loading }),
};
