# Application Dictionary Master

Reference dataset for Product Data V2. **Documentation only.** Drives the Recommendation Engine + Factory Builder (Application → Operation Bill → Machine Types).
Machine category codes: IS=Industrial Sewing · AS=Automatic Sewing · CE=Cutting · FP=Fabric Prep · FE=Finishing · EM=Embroidery · PT=Printing/Transfer · PI=Packing.

## Domain → Group → Application
*Each row: Application · Parent group · Related applications · Related machine categories.*

### 1. Apparel
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| T-Shirt | Apparel·Knitwear | Polo, Underwear, Baby Wear | CE, IS(overlock/cover), EM/PT, FE, PI |
| Polo Shirt | Apparel·Knitwear | T-shirt, Dress Shirt | CE, IS(overlock/cover/lockstitch), AS(placket/collar), IS(buttonhole/button), EM, FE, PI |
| Dress Shirt | Apparel·Wovenwear | Polo, Uniform | CE, AS(collar/cuff/placket/pocket), IS(lockstitch), IS(buttonhole/button), FE(shirt finisher), PI |
| Jacket / Blazer | Apparel·Wovenwear | Uniform, Outerwear | CE, AS(welt pocket/sleeve/dart), IS(lockstitch/blind), FE(form finisher), PI |
| Jeans / Denim | Apparel·Denim | Workwear | CE(heavy), IS(chainstitch FOA/lockstitch/overlock), AS(belt-loop/waistband/pocket), IS(bartack/eyelet/button), FE, PI |
| Sportswear / Activewear | Apparel·Knitwear | Underwear, Swimwear | CE/laser, IS(flatlock/cover/overlock), PT(sublimation), FE, PI |
| Underwear / Lingerie | Apparel·Intimates | Swimwear, Baby Wear | IS(overlock/cover/zigzag/elastic/picot), FP, FE, PI |
| Knitwear (sweaters) | Apparel·Knitwear | Sportswear | IS(linking/overlock), FE, PI |

### 2. Uniforms
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Corporate Uniform | Uniforms | Dress Shirt, Hospitality | CE, IS, AS(pocket/bartack), EM(logo), FE, PI |
| School Uniform | Uniforms | Dress Shirt | CE, IS, EM, FE, PI |
| Industrial Workwear | Uniforms | Jeans, Safety Wear | CE(heavy), IS(heavy/bartack), AS(pocket), FE, PI |

### 3. Medical
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Scrubs / Gowns | Medical | PPE, Uniforms | CE, IS(overlock/lockstitch), FE, PI(needle/X-ray) |
| Surgical Drapes | Medical | PPE, Technical | CE/ultrasonic, IS, FE(seam seal), PI(X-ray) |
| Disposable PPE | Medical·PPE | Safety Wear | CE/ultrasonic, IS, PT, PI(detection) |

### 4. Military
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Combat Uniform | Military | Workwear, Safety | CE(heavy), IS(heavy/bartack), AS(pocket), EM(insignia), FE, PI |
| Tactical Gear / Webbing | Military | Bags, Technical | CE/die, IS(heavy/compound feed), AS(pattern sewing/bartack), PI |
| Body Armor Carriers | Military·Technical | PPE | CE/laser, IS(heavy), AS(pattern sewing), PI |

### 5. Hospitality
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Chef / Service Uniform | Hospitality | Corporate Uniform | CE, IS, AS(buttonhole/button), EM, FE, PI |
| Table / Bed Linen (hotel) | Hospitality·Home Textile | Bedding | CE(wide), IS(lockstitch/hemming/blind), AS(hemming), FE, PI |
| Towels (hotel) | Hospitality·Home Textile | Towels | CE, IS(overlock/hemming), EM(border/chenille), PI |

### 6. Home Textile
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Bedding / Quilts | Home Textile | Curtains, Mattress | CE(wide), IS(lockstitch/long-arm/chainstitch), AS(hemming), FE, PI |
| Curtains | Home Textile | Bedding | CE, IS(blind/lockstitch), FE, PI |
| Towels | Home Textile | Hospitality | CE, IS(overlock/hemming), EM(chenille), PI |
| Sofa / Upholstery Covers | Home Textile | Automotive | CE, IS(heavy/walking-foot/post-bed), PI |
| Mattress | Home Textile | Bedding | CE, IS(mattress/tape-edge), FE, PI |

### 7. Automotive
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Car Seat Covers | Automotive | Upholstery, Leather | CE(single-ply/laser), IS(heavy/compound feed), AS(pattern sewing), PI |
| Interior Trim / Airbags | Automotive·Technical | Technical Textile | CE/laser, IS(heavy), AS(pattern sewing), PI |

### 8. Leather
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Bags / Handbags | Leather | Shoes, Automotive | CE/die, IS(heavy lockstitch/post-bed), AS(pattern sewing), EM, PI |
| Shoes / Footwear | Leather | Bags | CE/die/laser, IS(post-bed/leather), AS(pattern sewing), PI |
| Leather Goods (belts/wallets) | Leather | Bags | CE/die, IS(post-bed), PI |

### 9. Technical Textile
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Filtration / Geotextile | Technical | Automotive, Industrial | CE/ultrasonic, IS(heavy), PI |
| Tents / Awnings / Sails | Technical | Outdoor | CE, IS(heavy/long-arm), PI |
| Industrial Bags / FIBC | Technical | Bags | CE, IS(heavy/bag closing), PI |

### 10. Safety Wear
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Hi-Vis Clothing | Safety Wear | Workwear, Uniforms | CE, IS, PT(reflective/heat-transfer), EM, FE, PI |
| Fire-Retardant / Protective | Safety Wear | PPE, Military | CE, IS(heavy), AS(bartack), FE, PI |
| Harnesses / Webbing PPE | Safety Wear·Technical | Tactical Gear | CE/die, IS(heavy/bartack), AS(pattern sewing), PI |

### 11. Religious Garments
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Abaya / Thobe / Kaftan | Religious Garments | Apparel·Wovenwear | CE, IS(lockstitch/overlock/blind), EM(decorative), FE, PI |
| Ihram / Prayer Garments | Religious Garments | Apparel | CE, IS(overlock/hemming), FE, PI |
| Ecclesiastical Vestments | Religious Garments | Uniforms | CE, IS(lockstitch), EM(heavy decorative), FE, PI |

### 12. Baby Wear
| Application | Parent | Related | Machine categories |
|---|---|---|---|
| Infant Bodysuits | Baby Wear | Underwear, T-shirt | CE, IS(overlock/cover/flatlock), IS(buttonhole/snap-button), PI(needle/metal — mandatory) |
| Baby Bedding / Swaddles | Baby Wear·Home Textile | Bedding | CE, IS(overlock/hemming), PI(needle detection mandatory) |

## Notes
- **Related machine categories** here map down to specific **Product Types + facets** through `operation-library-master.md` (Application → Operation Bill → Operation → Machine Type).
- **Needle/metal/X-ray detection** is mandatory-flagged for Baby Wear, Medical, and PPE applications.
- Applications are `multi_select` facets on products and the primary input to the Recommendation Engine + Factory Builder.
