import "server-only";

/* ---------------------------------------------------------------------------
   The company as the public website shows it (owner, 30/09/2026: "from the
   Hub's official record"). Nothing is written here — it is put together
   from the two places the Hub already keeps it:
     · components/brand/DocumentBrandStrips KOLEEX_COMPANY — the address,
       phones, email and website every quotation, invoice and contract
       prints (change it there, and the papers and the site change together);
     · lib/server/ai/identity KOLEEX_COMPANY — the owner-approved facts
       Koleex AI states: the base, the cities with a presence, the brand's
       year and the family tradition it comes from;
   plus the everyday name (lib/legal-name) and the slogan.
   --------------------------------------------------------------------------- */

import { KOLEEX_COMPANY as ON_PAPER } from "@/components/brand/DocumentBrandStrips";
import { KOLEEX_COMPANY as FACTS } from "@/lib/server/ai/identity";
import { EVERYDAY_NAME_EN, LEGAL_NAME_EN } from "@/lib/legal-name";

export interface WebsiteCompany {
  name: string;
  legalName: string;
  legalNameZh: string;
  slogan: string;
  address: string;
  tel: string;
  mobile: string;
  email: string;
  web: string;
  base: string;
  offices: string[];
  brandEstablished: string;
  originsFrom: string;
}

export function websiteCompany(): WebsiteCompany {
  return {
    name: EVERYDAY_NAME_EN,
    legalName: LEGAL_NAME_EN,
    legalNameZh: ON_PAPER.zh,
    slogan: "Shaping the Future",
    address: ON_PAPER.address,
    tel: ON_PAPER.tel,
    mobile: ON_PAPER.mobile,
    email: ON_PAPER.email,
    web: ON_PAPER.web,
    base: FACTS.base,
    offices: [...FACTS.offices],
    brandEstablished: FACTS.brandEstablished,
    originsFrom: FACTS.originsFrom,
  };
}
