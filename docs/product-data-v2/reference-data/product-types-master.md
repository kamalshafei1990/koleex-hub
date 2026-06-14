# Product Type Master Registry — Garment Machinery (Division X)

> **Visual requirement (SoT):** see [Visual Product Experience](../architecture/visual-product-experience.md). Every Product Type must define its visual identity — `icon_key` (+ `icon_style`), default `presentation_group` ordering, and a diagram/placeholder plan — before approval. Visuals are part of "done".

Reference dataset for Product Data V2. **Documentation only.**
Legend for **Code Prefix**: ✅ = live KOLEEX code in production today · ▲ = *proposed*, needs governance sign-off (see gap analysis).
Facets reference `facet-dictionary-master.md`; devices reference `device-dictionary-master.md`.

## A. Industrial Sewing Machines  (Category XS · Subcategory = Industrial Sewing Machines)
| Prefix | Product Type | Required Facets | Comparison Facets | Device Compatibility |
|---|---|---|---|---|
| ✅ XSL | Lockstitch Machine | stitch_type, bed_type, drive_type, max_speed | needle_count, bed_type, drive_type, max_speed, hook_size | auto_trimmer, auto_foot_lifter, auto_backtack, thread_wiper, edge_cutter, puller |
| ✅ XSO | Overlock Machine | thread_count, differential_feed, max_speed, bed_type | thread_count, differential_feed, max_speed, automation_level | auto_trimmer, differential_feed, puller |
| ✅ XSI | Interlock (Coverstitch) Machine | needle_count, thread_count, top_cover, bed_type | needle_count, thread_count, top_cover, gauge | top_cover, puller, elastic_feeder, edge_cutter |
| ▲ XSF | Flatlock (Flat Seamer) Machine | needle_count, thread_count, bed_type, differential_feed | needle_count, thread_count, gauge, bed_type | top_cover, puller, elastic_feeder |
| ✅ XSC | Chainstitch Machine | needle_count, bed_type, feed_off_arm | needle_count, feed_off_arm, gauge | puller, edge_cutter, folder, tape_feeder |
| ▲ XSBH | Buttonhole Machine (Lockstitch) | buttonhole_type, automation_level, max_speed | electronic_vs_mechanical, buttonhole_length | programmable_patterns, auto_knife |
| ▲ XSEB | Eyelet Buttonhole Machine | buttonhole_type, gimp, max_speed | with_gimp, electronic_vs_mechanical | gimp_device, taping |
| ▲ XSBA | Button Attaching Machine | button_type, hole_count, stitch_type | lockstitch_vs_chainstitch, auto_feed | auto_button_feeder, neck_wrapping |
| ▲ XSBT | Bartack Machine | sewing_area, automation_level | electronic_vs_mechanical, sewing_area | programmable_patterns, work_clamps |
| ▲ XSBL | Blind Stitch Machine | stitch_type, bed_type, skip_stitch | bed_type, skip_stitch, fabric_suitability | skip_stitch_device, edge_cutter |
| ▲ XSZ | Zigzag Machine | zigzag_width, zigzag_pattern, max_speed | zigzag_width, single_vs_multistep, electronic | programmable_patterns, auto_trimmer |
| ▲ XSEA | Elastic Attaching Machine | needle_count, bed_type, elastic_metering | needle_count, bed_type, metering_type | elastic_feeder, puller, cutter |
| ▲ XSWB | Waistband Attaching Machine | needle_count, gauge, bed_type | needle_count, gauge, bed_type | puller, folder, tape_feeder |
| ▲ XSBLP| Belt Loop Machine | function(make/attach), automation_level | making_vs_attaching, electronic | auto_feed_cut, loop_program |
| ▲ XSSM | Smocking / Shirring Machine | needle_count, gauge | needle_count(rows), gauge | elastic_metering, puller |
| ▲ XSPC | Picoting Machine | stitch_type, needle_count | needle_count, gauge | differential_feed, edge_trimmer |
| ▲ XSBG | Bag Closing Machine | stitch_type, format(portable/stationary), tape | portable_vs_stationary, with_tape | tape_feed, printer, thread_cutter |
| ▲ XSMT | Mattress Sewing Machine | function(tape-edge/border/flanging), max_thickness | function, automation_level | carriage_automation, pneumatic |
| ▲ XSUS | Ultrasonic Sewing Machine | power, working_width, roller_pattern | working_width, continuous_vs_spot | embossing_wheels, slitting |

## B. Automatic Sewing Systems  (Category XA)
| Prefix | Product Type | Required Facets | Comparison Facets | Device Compatibility |
|---|---|---|---|---|
| ▲ XAPS | Programmable Pattern Sewing Machine | working_field, head_type, max_speed, programmable_memory | working_field, head_type, max_speed | stacker, laser_marker, intermittent_presser |
| ▲ XATM | Template Sewing Machine | working_field, head_count, head_type | working_field, head_count, template_change | rotary_template_loader, vision_registration |
| ▲ XAPW | Automatic Pocket Welting Machine | welt_type, welt_length, stacker | single_vs_double_welt, flap, zipper | flap_loader, zipper_feeder, dart_device |
| ▲ XAPP | Automatic Patch Pocket Setter | pocket_size, shape_programmable, head_type | pocket_size, with_creaser, stacker | pocket_creaser, label_insert, corner_bartack |
| ▲ XAPL | Automatic Placket Machine | placket_type, placket_length, cutter | placket_type, interlining_feed, stacker | interlining_feed, label_insert |
| ▲ XACC | Automatic Collar & Cuff Machine | operation_stage, size_range | operation_stage, profile_programmable | corner_trimmer, turning_device, stacker |
| ▲ XASL | Automatic Sleeve Setting Machine | ease_method, head_type | garment_type, ease_program, head_type | ease_profiles, photocell, stacker |
| ▲ XAHM | Automatic Hemming Machine | hem_type, head_type, folding_device | hem_type, contour_following, cylinder_bed | contour_follow, label_insert, stacker |
| ▲ XALB | Automatic Label Attaching Machine | label_type, label_feed, head_type | label_type, auto_feed_source, multi_label | label_cutter, vision_placement, stacker |
| ▲ XABL | Automatic Belt Loop Attaching System | loop_width, programmable_positions | loop_width, programmable_positions, inline_forming | loop_forming, indexing_feed, stacker |
| ▲ XAWB | Automatic Waistband Machine | garment_type, head_config | garment_type, needle_count, curtain_feed | curtain_feed, label_insert |
| ▲ XADT | Automatic Dart Sewing Machine | dart_length, taper_control | dart_length, single_vs_double, programmable | thread_nesting, photocell, stacker |
| ▲ XAIX | Automatic Buttonhole/Button Indexer | function, positions, base_head | function, position_count, auto_button_feed | auto_button_feeder, transport_clamp, stacker |

## C. Cutting Equipment  (Category XC)
| Prefix | Product Type | Required Facets | Comparison Facets | Device Compatibility |
|---|---|---|---|---|
| ✅ XCS | Straight Knife Cutting Machine | cutting_height, blade_size, drive | cutting_height, blade_size, auto_sharpening | auto_sharpener, edge_guard |
| ✅ XCR | Round Knife Cutting Machine | blade_diameter, cutting_height | blade_diameter, cutting_height, auto_sharpening | auto_sharpener, extended_base |
| ✅ XCB | Band Knife Cutting Machine | throat_size, cutting_height, air_float | throat_size, cutting_height, air_float | auto_sharpener, conveyor, dust_blower |
| ▲ XCDP| Die Cutting Press (Clicker/Beam) | cutting_force, press_type, beam_size | cutting_force, press_type, auto_feed | auto_feed_conveyor, vision_die_align |
| ▲ XCCM| Automatic Multi-Ply Cutting Machine | cutting_height, working_width, vacuum_power, conveyor | cutting_height, working_width, integrated_heads | drill_head, notch_head, labeler, auto_sharpener |
| ▲ XCCS| Automatic Single-Ply Cutting Machine | working_field, tool_type, vacuum | working_field, tool_type, vision_registration | vision_registration, multi_tool_head, roll_feeder |
| ✅ XCL | Laser Cutting Machine | laser_power, configuration, working_width | laser_power, galvo_vs_flatbed, vision | vision_registration, conveyor_feed, fume_extraction |
| ▲ XCE | End Cutter | cutting_width, blade_type | cutting_width, blade_type, auto_return | auto_return |
| ▲ XCST| Strip Cutting Machine | strip_width, blade_type | strip_width, bias_capability, programmable | programmable_length, stacker |
| ▲ XCTC| Tape & Elastic Cutting Machine | tape_width, cold_vs_hot, programmable | tape_width, cold_vs_hot, programmable | hot_knife, printer, stacker |
| ✅ XCD | Fabric Drill (Drill Marker) | needle_diameter, heated_vs_cold, drilling_depth | needle_diameter, heated_vs_cold | thermal_needle, vacuum_chip |
| ▲ XCN | Cloth Notching Machine | notch_type, heated_vs_cold, notch_depth | notch_type, heated_vs_cold | heated_blade |

## D. Fabric Preparation  (Category XPR)
| Prefix | Product Type | Required Facets | Comparison Facets | Device Compatibility |
|---|---|---|---|---|
| ✅ XPRR | Fabric Relaxing Machine | fabric_suitability, max_width, relaxation_method | fabric_suitability, output_form, automation_level | tubular_opening, plaiter, edge_uncurler |
| ▲ XPRK | Tubular Knit Opening/Slitting Machine | tubular_width, slitting_method | tubular_width, output_form | plaiter, rolling_output |
| ✅ XPRI | Fabric Inspection Machine | max_width, inspection_method, measuring | inspection_method, with_rolling, fabric_suitability | ai_defect, auto_measuring, batching |
| ✅ XPRL | Fabric Winding / Rolling Machine | max_width, roll_capacity, winding_type | roll_capacity, winding_type, with_measuring | length_counter, auto_doffing, slitting |
| ✅ XPRS | Fabric Spreading Machine | fabric_suitability, max_width, automation_level | max_width, automation_level, spreading_mode | edge_alignment, end_cutter, motorized_cradle |
| ✅ XPRT | Fabric Spreading/Cutting Table | surface_type, length, width | surface_type, length, sectioned_vacuum | conveyor_top, spreader_rails |
| ▲ XPRSR| Fabric Roll Storage/Racking System | system_type, roll_capacity, max_roll_weight | system_type, roll_capacity | automated_retrieval, inventory_tracking |
| ▲ XPRCF| Fabric Cradle/Feeding System | feed_type, max_roll_weight, motorized | feed_type, motorized | motorized_letoff, turntable, splice_table |

## E. Finishing Equipment  (Category XF)
| Prefix | Product Type | Required Facets | Comparison Facets | Device Compatibility |
|---|---|---|---|---|
| ✅ XFSI | Steam Iron | steam_source, soleplate, weight | steam_source, soleplate | — |
| ✅ XFSB | Steam Boiler / Generator | boiler_capacity, irons_supported, heating_method | capacity, irons_supported, heating_method | auto_fill, descaling |
| ✅ XFIT | Ironing Table (Vacuum/Heated/Blowing) | surface_features, size | vacuum, up_blow, heated_buck, with_boiler | vacuum, up_blow, heated_buck |
| ▲ XFPB | Pressing Machine (Buck/Cabinet) | press_type, actuation, application | press_type, actuation, dual_buck | dual_buck, programmable_cycle |
| ✅ XFCP | Collar & Cuff Press | actuation, station_count | actuation, double_station | double_station, programmable |
| ✅ XFFP | Fusing Machine | fusing_type, belt_width, temperature_range | fusing_type, belt_width, temperature_range | double_belt, cooling_section |
| ▲ XFFF | Form Finisher (Steam-Air Dolly) | garment_type, tensioning_method, steam_source | garment_type, tensioning_method, twin_station | side_clamps, sleeve_tensioners |
| ▲ XFSH | Shirt Finisher | type(cabinet/tunnel), throughput, tensioning | type, throughput, tensioning | collar_cuff_clamps, conveyor |
| ▲ XFTT | Trouser Topper / Legger | type(topper/legger), throughput | topper_vs_legger, twin, throughput | leg_clamps, waistband_tension |
| ▲ XFST | Steam Tunnel | throughput, zones, conveyor_type | throughput, zones, conveyor | variable_speed, multi_zone |
| ✅ XFTS | Thread Sucking / Trimming Machine | format, suction_power | format, suction_power, with_blow_gun | spot_blow_gun, ionizer |
| ▲ XFSP | Spotting / Stain Removal Machine | gun_types, with_vacuum_table | gun_types, with_vacuum_table, heated | heated_table, drying_blower |

## F. Embroidery Equipment  (Category XE)
| Prefix | Product Type | Required Facets | Comparison Facets | Device Compatibility |
|---|---|---|---|---|
| ✅ XES | Single-Head Embroidery Machine | needle_count, field_size, max_speed, tubular_vs_flat | needle_count, field_size, max_speed | cap_device, sequin_device, cording_device, boring_device |
| ✅ XEM | Multi-Head Embroidery Machine | head_count, head_pitch, needle_count, field_size | head_count, head_pitch, needle_count, max_speed | cap_device, sequin_device, cording_device |
| ✅ XEB | Chenille / Chain-Stitch Embroidery Machine | stitch_capability, pile_height, head_count | stitch_capability, pile_height, head_count | combination_lockstitch, cording |
| ▲ XEC | Combination Embroidery Machine | technique_set, head_count, field_size | technique_set, head_count | sequin, cording, coiling, taping |

## G. Printing & Heat Transfer  (Category XP)
| Prefix | Product Type | Group | Required Facets | Comparison Facets | Device Compatibility |
|---|---|---|---|---|---|
| ✅ XPSP | Screen Printing Machine | Printing | type(manual/auto), config, color_count | manual_vs_auto, carousel_vs_oval, color_count | flash_cure, vacuum_holddown |
| ✅ XPDT | DTG Printer | Printing | print_area, ink_set, platen_size | print_area, white_ink, throughput | bulk_ink, pretreat |
| ▲ XPDF | DTF Printer | Printing | film_width, ink_set, roll_fed | film_width, roll_vs_sheet, white_ink | inline_shaker_cure, take_up |
| ✅ XPSU | Sublimation Printer | Printing | print_width, mode(transfer/direct), ink | print_width, transfer_vs_direct, throughput | bulk_ink, integrated_dryer |
| ▲ XPCD | Conveyor Dryer / Curing Oven | Printing | belt_width, heat_source, max_temp | belt_width, heat_source, chamber_length | IR_boosters, multi_zone |
| ▲ XPPS | DTF Powder Shaker / Curing Unit | Printing | film_width, format(inline/standalone) | width, inline_vs_standalone, powder_recycling | powder_recycling, fume_extraction |
| ✅ XPH | Heat Press Machine (Flat) | Transfer | platen_size, opening_type, actuation, stations | platen_size, actuation, stations, platen_shape | cap_platen, mug_platen, twin_station |
| ▲ XPRH | Calender / Rotary Heat Press | Transfer | working_width, max_temp, speed, feed_type | working_width, feed_type, speed, drum_diameter | protective_paper_feed, cooling_section |

## H. Packing & Inspection  (Category XPC)
| Prefix | Product Type | Group | Required Facets | Comparison Facets | Device Compatibility |
|---|---|---|---|---|---|
| ✅ XPCN | Needle Detector | Inspection | form, belt_width, sensitivity | form, belt_width, sensitivity | auto_reject, marking, counter |
| ✅ XPCM | Metal Detector | Inspection | detection_coverage, aperture, sensitivity | coverage, aperture, sensitivity | auto_reject, multi_frequency |
| ✅ XPCX | X-Ray Inspection Machine | Inspection | aperture, detection_set, resolution | aperture, resolution, count_missing | auto_reject, count_check |
| ▲ XPCW | Checkweigher | Inspection | weight_range, accuracy, throughput | weight_range, accuracy, combo_detection | auto_reject, SPC |
| ✅ XPCF | Folding Machine | Packing | garment_type, automation_level | garment_type, automation_level, throughput | inline_bagging, conveyor |
| ▲ XPCB | Bagging / Poly Bag Packing Machine | Packing | bag_source, bag_size, throughput | bag_size, throughput, auto_label | label_apply, batch_count |
| ▲ XPCS | Bag Sealing Machine | Packing | sealer_type, seal_length | sealer_type, seal_length, with_printer | date_printer, trimmer, conveyor |
| ▲ XPCW2| Shrink Wrapping Machine | Packing | type, max_product_size, film | type, max_product_size, automation | auto_feed, multi_zone_tunnel |
| ▲ XPCV | Vacuum / Compression Packing Machine | Packing | type, bag_size, vacuum_power | type, bag_size, throughput | compression_rollers, gas_flush |
| ✅ XPCC | Carton Sealing Machine | Packing | sealing_mode, carton_range, tape_width | top_vs_topbottom, uniform_vs_random | random_autosize, flap_folder |
| ▲ XPCT | Strapping Machine | Packing | type, strap_material, arch_size | automation, arch_size, strap_material | auto_carton_feed, side_seal |

> **Spare Parts & Accessories** are not machine Product Types — they are catalogued in `device-dictionary-master.md` (devices) and the parts registry, with fitment in `compatibility-rulebook.md`.
