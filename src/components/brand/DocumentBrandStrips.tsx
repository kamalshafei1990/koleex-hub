/* The black company line and the grey tagline that open every Koleex
   document. One definition, so the quotation, the invoice and the sales
   contract present the same company the same way. */
export const KOLEEX_COMPANY = {
  en: "KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD.",
  zh: "科莱恪斯国际商业管理（台州）有限公司",
  tagline: "SHAPING THE FUTURE.",
  address:
    "Room 206, Building 88, West Feiyue Technological Innovative Park, Jingshui An Community, Xiachen Street, Jiaojiang District, Taizhou City, Zhejiang Province, China",
  tel: "+86 0576 8892 7796",
  web: "www.koleexgroup.com",
} as const;

export default function DocumentBrandStrips({
  black = "#0A0A0A",
  surface = "#F5F5F5",
}: {
  black?: string;
  surface?: string;
}) {
  return (
    /* Both strips share one rounded container so the radius shows only on
       the outer corners and the pair reads as a single header block. */
    <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div
        className="pq-strip-black"
        style={{
          background: black,
          color: "#fff",
          padding: "7px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ color: "#fff" }}>{KOLEEX_COMPANY.en}</span>
        <span style={{ color: "#fff" }}>{KOLEEX_COMPANY.zh}</span>
      </div>
      <div
        className="pq-strip-gray"
        style={{
          background: surface,
          color: "#333",
          padding: "5px 16px",
          textAlign: "center",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.18em",
        }}
      >
        {KOLEEX_COMPANY.tagline}
      </div>
    </div>
  );
}
