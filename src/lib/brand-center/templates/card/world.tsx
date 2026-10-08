/* ---------------------------------------------------------------------------
   The KOLEEX dotted world map (brand book ch. 57, "the dots"): one even
   grid, one dot per cell of land. The land is Natural Earth's 1:110 m map
   (public domain) on a 150 × 73 grid — Miller projection, 83.5° N to 56° S,
   starting at 169° W so Asia and the Pacific stay whole. Each row is its
   run lengths, water first, two base-36 digits a run.
   --------------------------------------------------------------------------- */

const COLS = 150;
const ROWS = 73;
const RUNS = "11060909,0x0b010301080101,0v010109010m1901,0u0b010l0e050r03,0r0103030104030k0d040w03,0n0205010403020m0e020102,0k0208020105030k11010d05,0m0402020205090g0w030b0a0a03,0i020r0f0v020b0a,0i0301010202010401010104080e0w010a0h0102,0i02010602010306080e0v02050p01010304,03050f0502020109060c0k030f13,020b01070203010101040118080a02011601,00250a0201010a011903,0024090101010c011c01,010z0205060408030b040204021m0202,030u070306040l04011u0401,010u07020a030k05011n0104,0207010l070302010t050201011h0301,0501070j060401010o0104010102031d0801,04010a0i06060n0105010101021d0703,02010d0k02080l030402031c0803,0h0j02090j04031l0502,0h0u0l03011l,0j0o03010n1n0101,0j0m010103020l1o,0j0p0q0d01010105020z,0j0n0s04010101050503020z0202,0j0m0q050302010402010303010x,0j0l0r0309010209020r01030501,0j0k0s03060102010209020r03010401,0k0j0v050a0z03010302,0l0h0t080a100501,0m0f0t0b02030310,0o07010103010t0o010u,0n0706010s0j0106020s,0p050y0l01060101040m,0q0405020r0m010804090109,05010k04030104010p0m010806050306,0s0604010p0m020607040505,0w030s0o0104090307050401,0y020r0q0d020705,0z0103030m0p01020a02070101020602,100101070k0q0k010a01,120a0i05010j0l010901,120b0p0g0l020501,110d0o0f0n0103040201,110e0n0e0o02020301020301,110h0l0c0q02030101010504,110j0k0b13010105,110j0k0b0v0407010101,120h0l0b,130f0m0b12020201,130f0l0c03010v050202,150d0l0b03020u0a0d01,150d0m0904020t0c,150c0n0903020s0f,150a0q0804010s0g,15090r070y0g,15090r070y0g,15080t05100f,14080u0311040506,14072905,14062b030b02,14042r01,14032g010a01,14032q01,13032q01,1304,1303,13030301,1402,1501";

/** The land as [row, first column, cells] runs, parsed once. */
let land: Array<[number, number, number]> | null = null;
function landRuns() {
  if (land) return land;
  land = [];
  RUNS.split(",").forEach((row, r) => {
    let col = 0;
    for (let i = 0, water = true; i < row.length; i += 2, water = !water) {
      const n = parseInt(row.slice(i, i + 2), 36);
      if (!water) land!.push([r, col, n]);
      col += n;
    }
  });
  return land;
}

/** The map in a box (mm): dots of radius `r`, their grid the box divided
 *  into 150 × 73 cells (so the map stretches to the box's shape). */
export function WorldDots({ x, y, w, h, r, fill, uid }: { x: number; y: number; w: number; h: number; r: number; fill: string; uid: string }) {
  const px = w / COLS;
  const py = h / ROWS;
  const d = landRuns().map(([row, col, n]) => `M${(x + col * px).toFixed(3)} ${(y + row * py).toFixed(3)}h${(n * px).toFixed(3)}v${py.toFixed(3)}h-${(n * px).toFixed(3)}z`).join("");
  return (
    <g>
      <defs>
        <pattern id={`${uid}-wd`} patternUnits="userSpaceOnUse" x={x} y={y} width={px} height={py}>
          <circle cx={px / 2} cy={py / 2} r={Math.min(r, px / 2, py / 2)} fill={fill} />
        </pattern>
        <clipPath id={`${uid}-wland`}><path d={d} /></clipPath>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-wd)`} clipPath={`url(#${uid}-wland)`} />
    </g>
  );
}
