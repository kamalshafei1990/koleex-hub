/* ---------------------------------------------------------------------------
   Country → state/province → city.

   Address fields were three free-text boxes, so "Zhejiang" / "Zhejiang Sheng"
   / "浙江" all landed in the same column and nothing could be filtered by
   region. The picker now offers the real administrative divisions for the
   countries KOLEEX actually operates in.

   Deliberately NOT a complete world gazetteer: that is ~150k cities and would
   cost more to ship than it earns. Countries listed here get a closed list;
   everything else falls back to typing, which the combobox still allows. Add
   a country by adding its entry — no other file changes.

   Storage stays the plain name string (people.state / people.city), so this
   is a UI-side vocabulary with no migration behind it.
   --------------------------------------------------------------------------- */

export type Region = {
  /** Stored value + English label. */
  name: string;
  /** Native label, shown muted beside the English one. */
  name_alt?: string;
  cities: readonly string[];
};

/* Keyed by ISO-3166 alpha-2, matching COUNTRIES[].code in commercial-policy. */
export const REGIONS: Record<string, readonly Region[]> = {
  /* ── China — the operating base, so it carries the full division list ── */
  CN: [
    { name: "Beijing", name_alt: "北京市", cities: ["Dongcheng", "Xicheng", "Chaoyang", "Haidian", "Fengtai", "Shijingshan", "Tongzhou", "Shunyi", "Changping", "Daxing"] },
    { name: "Shanghai", name_alt: "上海市", cities: ["Huangpu", "Xuhui", "Changning", "Jing'an", "Putuo", "Hongkou", "Yangpu", "Minhang", "Baoshan", "Jiading", "Pudong", "Songjiang", "Qingpu", "Fengxian"] },
    { name: "Tianjin", name_alt: "天津市", cities: ["Heping", "Hedong", "Hexi", "Nankai", "Hebei", "Hongqiao", "Binhai"] },
    { name: "Chongqing", name_alt: "重庆市", cities: ["Yuzhong", "Jiangbei", "Shapingba", "Jiulongpo", "Nan'an", "Beibei", "Yubei", "Banan", "Wanzhou", "Fuling"] },
    { name: "Zhejiang", name_alt: "浙江省", cities: ["Hangzhou", "Ningbo", "Wenzhou", "Taizhou", "Jiaxing", "Huzhou", "Shaoxing", "Jinhua", "Quzhou", "Zhoushan", "Lishui", "Yiwu", "Ruian", "Cixi"] },
    { name: "Jiangsu", name_alt: "江苏省", cities: ["Nanjing", "Suzhou", "Wuxi", "Changzhou", "Nantong", "Xuzhou", "Yangzhou", "Yancheng", "Zhenjiang", "Taizhou", "Huai'an", "Lianyungang", "Suqian", "Kunshan", "Changshu"] },
    { name: "Guangdong", name_alt: "广东省", cities: ["Guangzhou", "Shenzhen", "Dongguan", "Foshan", "Zhuhai", "Zhongshan", "Huizhou", "Shantou", "Jiangmen", "Zhanjiang", "Zhaoqing", "Maoming", "Shaoguan", "Chaozhou", "Jieyang", "Qingyuan"] },
    { name: "Shandong", name_alt: "山东省", cities: ["Jinan", "Qingdao", "Yantai", "Weifang", "Zibo", "Jining", "Linyi", "Taian", "Weihai", "Dezhou", "Liaocheng", "Binzhou", "Dongying", "Zaozhuang", "Rizhao", "Heze"] },
    { name: "Fujian", name_alt: "福建省", cities: ["Fuzhou", "Xiamen", "Quanzhou", "Putian", "Zhangzhou", "Nanping", "Sanming", "Longyan", "Ningde", "Jinjiang", "Shishi"] },
    { name: "Hebei", name_alt: "河北省", cities: ["Shijiazhuang", "Tangshan", "Baoding", "Handan", "Langfang", "Cangzhou", "Xingtai", "Zhangjiakou", "Chengde", "Qinhuangdao", "Hengshui"] },
    { name: "Henan", name_alt: "河南省", cities: ["Zhengzhou", "Luoyang", "Nanyang", "Xinxiang", "Anyang", "Kaifeng", "Shangqiu", "Zhoukou", "Xinyang", "Pingdingshan", "Xuchang", "Jiaozuo"] },
    { name: "Sichuan", name_alt: "四川省", cities: ["Chengdu", "Mianyang", "Deyang", "Nanchong", "Yibin", "Luzhou", "Zigong", "Leshan", "Neijiang", "Panzhihua", "Suining", "Dazhou"] },
    { name: "Hubei", name_alt: "湖北省", cities: ["Wuhan", "Yichang", "Xiangyang", "Jingzhou", "Huangshi", "Shiyan", "Xiaogan", "Jingmen", "Huanggang", "Ezhou", "Xianning"] },
    { name: "Hunan", name_alt: "湖南省", cities: ["Changsha", "Zhuzhou", "Xiangtan", "Hengyang", "Yueyang", "Changde", "Chenzhou", "Yiyang", "Shaoyang", "Loudi", "Huaihua"] },
    { name: "Anhui", name_alt: "安徽省", cities: ["Hefei", "Wuhu", "Bengbu", "Anqing", "Fuyang", "Ma'anshan", "Huainan", "Chuzhou", "Lu'an", "Suzhou", "Tongling", "Huangshan"] },
    { name: "Liaoning", name_alt: "辽宁省", cities: ["Shenyang", "Dalian", "Anshan", "Fushun", "Jinzhou", "Yingkou", "Dandong", "Panjin", "Benxi", "Liaoyang"] },
    { name: "Shaanxi", name_alt: "陕西省", cities: ["Xi'an", "Baoji", "Xianyang", "Weinan", "Yan'an", "Hanzhong", "Yulin", "Ankang", "Tongchuan"] },
    { name: "Jiangxi", name_alt: "江西省", cities: ["Nanchang", "Ganzhou", "Jiujiang", "Shangrao", "Yichun", "Ji'an", "Fuzhou", "Pingxiang", "Jingdezhen", "Xinyu"] },
    { name: "Shanxi", name_alt: "山西省", cities: ["Taiyuan", "Datong", "Yuncheng", "Changzhi", "Linfen", "Jinzhong", "Jincheng", "Yangquan", "Xinzhou"] },
    { name: "Heilongjiang", name_alt: "黑龙江省", cities: ["Harbin", "Qiqihar", "Daqing", "Mudanjiang", "Jiamusi", "Suihua", "Jixi", "Shuangyashan"] },
    { name: "Jilin", name_alt: "吉林省", cities: ["Changchun", "Jilin", "Siping", "Tonghua", "Songyuan", "Baicheng", "Liaoyuan", "Yanji"] },
    { name: "Yunnan", name_alt: "云南省", cities: ["Kunming", "Qujing", "Yuxi", "Dali", "Lijiang", "Baoshan", "Zhaotong", "Pu'er", "Honghe", "Xishuangbanna"] },
    { name: "Guizhou", name_alt: "贵州省", cities: ["Guiyang", "Zunyi", "Anshun", "Bijie", "Liupanshui", "Tongren", "Kaili", "Duyun"] },
    { name: "Gansu", name_alt: "甘肃省", cities: ["Lanzhou", "Tianshui", "Baiyin", "Jiuquan", "Zhangye", "Wuwei", "Qingyang", "Pingliang"] },
    { name: "Hainan", name_alt: "海南省", cities: ["Haikou", "Sanya", "Danzhou", "Qionghai", "Wanning", "Wenchang"] },
    { name: "Qinghai", name_alt: "青海省", cities: ["Xining", "Haidong", "Golmud", "Delingha"] },
    { name: "Guangxi", name_alt: "广西壮族自治区", cities: ["Nanning", "Liuzhou", "Guilin", "Yulin", "Wuzhou", "Beihai", "Qinzhou", "Guigang", "Baise"] },
    { name: "Inner Mongolia", name_alt: "内蒙古自治区", cities: ["Hohhot", "Baotou", "Ordos", "Chifeng", "Tongliao", "Hulunbuir", "Bayannur", "Ulanqab"] },
    { name: "Ningxia", name_alt: "宁夏回族自治区", cities: ["Yinchuan", "Shizuishan", "Wuzhong", "Guyuan", "Zhongwei"] },
    { name: "Xinjiang", name_alt: "新疆维吾尔自治区", cities: ["Urumqi", "Karamay", "Turpan", "Hami", "Kashgar", "Aksu", "Yining", "Korla"] },
    { name: "Tibet", name_alt: "西藏自治区", cities: ["Lhasa", "Shigatse", "Chamdo", "Nyingchi", "Shannan", "Nagqu"] },
    { name: "Hong Kong", name_alt: "香港特别行政区", cities: ["Hong Kong Island", "Kowloon", "New Territories"] },
    { name: "Macau", name_alt: "澳门特别行政区", cities: ["Macau Peninsula", "Taipa", "Coloane", "Cotai"] },
    { name: "Taiwan", name_alt: "台湾省", cities: ["Taipei", "New Taipei", "Taichung", "Tainan", "Kaohsiung", "Taoyuan", "Hsinchu", "Keelung"] },
  ],

  /* ── Egypt ── */
  EG: [
    { name: "Cairo", name_alt: "القاهرة", cities: ["Nasr City", "Heliopolis", "Maadi", "New Cairo", "Shubra", "Zamalek", "Downtown", "Helwan", "Obour"] },
    { name: "Giza", name_alt: "الجيزة", cities: ["Giza", "Dokki", "Mohandessin", "6th of October", "Sheikh Zayed", "Haram", "Imbaba"] },
    { name: "Alexandria", name_alt: "الإسكندرية", cities: ["Montazah", "Sidi Gaber", "Smouha", "Miami", "Agami", "Borg El Arab"] },
    { name: "Qalyubia", name_alt: "القليوبية", cities: ["Banha", "Shubra El Kheima", "Qalyub", "Khanka"] },
    { name: "Port Said", name_alt: "بورسعيد", cities: ["Port Said", "Port Fouad"] },
    { name: "Suez", name_alt: "السويس", cities: ["Suez", "Ain Sokhna"] },
    { name: "Ismailia", name_alt: "الإسماعيلية", cities: ["Ismailia", "Fayed", "Qantara"] },
    { name: "Dakahlia", name_alt: "الدقهلية", cities: ["Mansoura", "Mit Ghamr", "Talkha", "Belqas"] },
    { name: "Sharqia", name_alt: "الشرقية", cities: ["Zagazig", "10th of Ramadan", "Bilbeis", "Abu Hammad"] },
    { name: "Gharbia", name_alt: "الغربية", cities: ["Tanta", "Mahalla El Kubra", "Kafr El Zayat", "Zefta"] },
    { name: "Monufia", name_alt: "المنوفية", cities: ["Shibin El Kom", "Sadat City", "Menouf", "Ashmoun"] },
    { name: "Beheira", name_alt: "البحيرة", cities: ["Damanhour", "Kafr El Dawwar", "Rashid", "Edku"] },
    { name: "Kafr El Sheikh", name_alt: "كفر الشيخ", cities: ["Kafr El Sheikh", "Desouk", "Baltim"] },
    { name: "Damietta", name_alt: "دمياط", cities: ["Damietta", "New Damietta", "Ras El Bar"] },
    { name: "Fayoum", name_alt: "الفيوم", cities: ["Fayoum", "Sinnuris", "Ibsheway"] },
    { name: "Beni Suef", name_alt: "بني سويف", cities: ["Beni Suef", "Nasser", "Wasta"] },
    { name: "Minya", name_alt: "المنيا", cities: ["Minya", "Mallawi", "Beni Mazar"] },
    { name: "Asyut", name_alt: "أسيوط", cities: ["Asyut", "Dairut", "Abnub"] },
    { name: "Sohag", name_alt: "سوهاج", cities: ["Sohag", "Akhmim", "Girga"] },
    { name: "Qena", name_alt: "قنا", cities: ["Qena", "Nag Hammadi", "Qus"] },
    { name: "Luxor", name_alt: "الأقصر", cities: ["Luxor", "Esna", "Armant"] },
    { name: "Aswan", name_alt: "أسوان", cities: ["Aswan", "Kom Ombo", "Edfu", "Abu Simbel"] },
    { name: "Red Sea", name_alt: "البحر الأحمر", cities: ["Hurghada", "Safaga", "Marsa Alam", "Qoseir"] },
    { name: "South Sinai", name_alt: "جنوب سيناء", cities: ["Sharm El Sheikh", "Dahab", "Nuweiba", "El Tor"] },
    { name: "North Sinai", name_alt: "شمال سيناء", cities: ["Arish", "Sheikh Zuweid", "Bir al-Abd"] },
    { name: "Matrouh", name_alt: "مطروح", cities: ["Marsa Matrouh", "El Alamein", "Siwa"] },
    { name: "New Valley", name_alt: "الوادي الجديد", cities: ["Kharga", "Dakhla", "Farafra"] },
  ],

  /* ── Saudi Arabia ── */
  SA: [
    { name: "Riyadh", name_alt: "الرياض", cities: ["Riyadh", "Diriyah", "Kharj", "Majmaah", "Dawadmi", "Zulfi"] },
    { name: "Makkah", name_alt: "مكة المكرمة", cities: ["Makkah", "Jeddah", "Taif", "Rabigh", "Qunfudhah"] },
    { name: "Madinah", name_alt: "المدينة المنورة", cities: ["Madinah", "Yanbu", "Badr", "Ula"] },
    { name: "Eastern Province", name_alt: "المنطقة الشرقية", cities: ["Dammam", "Khobar", "Dhahran", "Jubail", "Qatif", "Hofuf", "Ahsa"] },
    { name: "Asir", name_alt: "عسير", cities: ["Abha", "Khamis Mushait", "Bisha", "Najran Road"] },
    { name: "Qassim", name_alt: "القصيم", cities: ["Buraydah", "Unaizah", "Rass"] },
    { name: "Tabuk", name_alt: "تبوك", cities: ["Tabuk", "Duba", "Haql", "NEOM"] },
    { name: "Hail", name_alt: "حائل", cities: ["Hail", "Baqaa"] },
    { name: "Najran", name_alt: "نجران", cities: ["Najran", "Sharurah"] },
    { name: "Jazan", name_alt: "جازان", cities: ["Jazan", "Sabya", "Abu Arish"] },
    { name: "Al Bahah", name_alt: "الباحة", cities: ["Al Bahah", "Baljurashi"] },
    { name: "Northern Borders", name_alt: "الحدود الشمالية", cities: ["Arar", "Rafha", "Turaif"] },
    { name: "Al Jawf", name_alt: "الجوف", cities: ["Sakaka", "Qurayyat", "Dumat Al Jandal"] },
  ],

  /* ── UAE ── */
  AE: [
    { name: "Dubai", name_alt: "دبي", cities: ["Deira", "Bur Dubai", "Jebel Ali", "Dubai Marina", "Business Bay", "Al Quoz", "Jumeirah", "Dubai Investment Park"] },
    { name: "Abu Dhabi", name_alt: "أبوظبي", cities: ["Abu Dhabi", "Al Ain", "Mussafah", "Khalifa City", "Ruwais"] },
    { name: "Sharjah", name_alt: "الشارقة", cities: ["Sharjah", "Khor Fakkan", "Kalba", "Dhaid"] },
    { name: "Ajman", name_alt: "عجمان", cities: ["Ajman", "Masfout"] },
    { name: "Umm Al Quwain", name_alt: "أم القيوين", cities: ["Umm Al Quwain"] },
    { name: "Ras Al Khaimah", name_alt: "رأس الخيمة", cities: ["Ras Al Khaimah", "Al Jazirah Al Hamra"] },
    { name: "Fujairah", name_alt: "الفجيرة", cities: ["Fujairah", "Dibba"] },
  ],

  /* ── Turkey ── */
  TR: [
    { name: "Istanbul", cities: ["Şişli", "Kadıköy", "Beşiktaş", "Bağcılar", "Esenyurt", "Ümraniye", "Zeytinburnu", "Beyoğlu"] },
    { name: "Ankara", cities: ["Çankaya", "Keçiören", "Yenimahalle", "Mamak", "Sincan"] },
    { name: "İzmir", cities: ["Konak", "Bornova", "Karşıyaka", "Buca", "Torbalı"] },
    { name: "Bursa", cities: ["Osmangazi", "Nilüfer", "Yıldırım", "İnegöl"] },
    { name: "Antalya", cities: ["Muratpaşa", "Kepez", "Alanya", "Manavgat"] },
    { name: "Adana", cities: ["Seyhan", "Yüreğir", "Çukurova"] },
    { name: "Gaziantep", cities: ["Şahinbey", "Şehitkamil", "Nizip"] },
    { name: "Konya", cities: ["Selçuklu", "Meram", "Karatay"] },
    { name: "Kayseri", cities: ["Melikgazi", "Kocasinan", "Talas"] },
    { name: "Denizli", cities: ["Merkezefendi", "Pamukkale"] },
    { name: "Kocaeli", cities: ["İzmit", "Gebze", "Darıca"] },
    { name: "Mersin", cities: ["Mezitli", "Yenişehir", "Tarsus"] },
  ],

  /* ── India ── */
  IN: [
    { name: "Maharashtra", cities: ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad", "Solapur", "Thane"] },
    { name: "Delhi", cities: ["New Delhi", "North Delhi", "South Delhi", "Dwarka", "Rohini"] },
    { name: "Karnataka", cities: ["Bengaluru", "Mysuru", "Mangaluru", "Hubli", "Belagavi"] },
    { name: "Tamil Nadu", cities: ["Chennai", "Coimbatore", "Madurai", "Tiruppur", "Salem", "Erode"] },
    { name: "Gujarat", cities: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Jamnagar"] },
    { name: "Uttar Pradesh", cities: ["Lucknow", "Kanpur", "Noida", "Ghaziabad", "Agra", "Varanasi"] },
    { name: "West Bengal", cities: ["Kolkata", "Howrah", "Durgapur", "Siliguri"] },
    { name: "Telangana", cities: ["Hyderabad", "Warangal", "Nizamabad"] },
    { name: "Rajasthan", cities: ["Jaipur", "Jodhpur", "Udaipur", "Kota"] },
    { name: "Punjab", cities: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala"] },
    { name: "Haryana", cities: ["Gurugram", "Faridabad", "Panipat", "Ambala"] },
    { name: "Kerala", cities: ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur"] },
  ],

  /* ── Pakistan ── */
  PK: [
    { name: "Punjab", cities: ["Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala", "Sialkot", "Sargodha"] },
    { name: "Sindh", cities: ["Karachi", "Hyderabad", "Sukkur", "Larkana"] },
    { name: "Khyber Pakhtunkhwa", cities: ["Peshawar", "Mardan", "Abbottabad", "Swat"] },
    { name: "Balochistan", cities: ["Quetta", "Gwadar", "Turbat"] },
    { name: "Islamabad", cities: ["Islamabad"] },
    { name: "Azad Kashmir", cities: ["Muzaffarabad", "Mirpur"] },
    { name: "Gilgit-Baltistan", cities: ["Gilgit", "Skardu"] },
  ],

  /* ── Bangladesh ── */
  BD: [
    { name: "Dhaka", cities: ["Dhaka", "Gazipur", "Narayanganj", "Savar", "Tangail"] },
    { name: "Chattogram", cities: ["Chattogram", "Cox's Bazar", "Comilla"] },
    { name: "Khulna", cities: ["Khulna", "Jessore", "Bagerhat"] },
    { name: "Rajshahi", cities: ["Rajshahi", "Bogra", "Pabna"] },
    { name: "Sylhet", cities: ["Sylhet", "Moulvibazar"] },
    { name: "Barishal", cities: ["Barishal", "Patuakhali"] },
    { name: "Rangpur", cities: ["Rangpur", "Dinajpur"] },
    { name: "Mymensingh", cities: ["Mymensingh", "Jamalpur"] },
  ],

  /* ── Vietnam ── */
  VN: [
    { name: "Ho Chi Minh City", cities: ["District 1", "District 7", "Thu Duc", "Binh Thanh", "Tan Binh", "Go Vap"] },
    { name: "Hanoi", cities: ["Hoan Kiem", "Cau Giay", "Dong Da", "Long Bien", "Ha Dong"] },
    { name: "Da Nang", cities: ["Hai Chau", "Thanh Khe", "Son Tra"] },
    { name: "Binh Duong", cities: ["Thu Dau Mot", "Di An", "Thuan An"] },
    { name: "Dong Nai", cities: ["Bien Hoa", "Long Khanh"] },
    { name: "Hai Phong", cities: ["Hong Bang", "Le Chan", "Ngo Quyen"] },
  ],

  /* ── Indonesia ── */
  ID: [
    { name: "DKI Jakarta", cities: ["Central Jakarta", "West Jakarta", "South Jakarta", "East Jakarta", "North Jakarta"] },
    { name: "West Java", cities: ["Bandung", "Bekasi", "Bogor", "Depok", "Cirebon"] },
    { name: "East Java", cities: ["Surabaya", "Malang", "Sidoarjo", "Gresik"] },
    { name: "Central Java", cities: ["Semarang", "Solo", "Yogyakarta", "Pekalongan"] },
    { name: "Banten", cities: ["Tangerang", "Serang", "Cilegon"] },
    { name: "Bali", cities: ["Denpasar", "Badung", "Gianyar"] },
  ],

  /* ── United States (states; cities where the market is real) ── */
  US: [
    { name: "California", cities: ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento", "Oakland", "Fresno", "Long Beach"] },
    { name: "New York", cities: ["New York City", "Brooklyn", "Queens", "Buffalo", "Rochester", "Albany"] },
    { name: "Texas", cities: ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth", "El Paso"] },
    { name: "Florida", cities: ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale"] },
    { name: "Illinois", cities: ["Chicago", "Aurora", "Naperville", "Springfield"] },
    { name: "New Jersey", cities: ["Newark", "Jersey City", "Paterson", "Elizabeth"] },
    { name: "Georgia", cities: ["Atlanta", "Savannah", "Augusta"] },
    { name: "North Carolina", cities: ["Charlotte", "Raleigh", "Greensboro", "Durham"] },
    { name: "Pennsylvania", cities: ["Philadelphia", "Pittsburgh", "Allentown"] },
    { name: "Ohio", cities: ["Columbus", "Cleveland", "Cincinnati"] },
    { name: "Michigan", cities: ["Detroit", "Grand Rapids", "Ann Arbor"] },
    { name: "Washington", cities: ["Seattle", "Spokane", "Tacoma", "Bellevue"] },
    { name: "Massachusetts", cities: ["Boston", "Worcester", "Springfield", "Cambridge"] },
    { name: "Arizona", cities: ["Phoenix", "Tucson", "Mesa", "Scottsdale"] },
    { name: "Virginia", cities: ["Virginia Beach", "Richmond", "Norfolk", "Arlington"] },
    { name: "Alabama", cities: [] }, { name: "Alaska", cities: [] }, { name: "Arkansas", cities: [] },
    { name: "Colorado", cities: ["Denver", "Colorado Springs", "Aurora"] }, { name: "Connecticut", cities: [] },
    { name: "Delaware", cities: [] }, { name: "Hawaii", cities: [] }, { name: "Idaho", cities: [] },
    { name: "Indiana", cities: [] }, { name: "Iowa", cities: [] }, { name: "Kansas", cities: [] },
    { name: "Kentucky", cities: [] }, { name: "Louisiana", cities: [] }, { name: "Maine", cities: [] },
    { name: "Maryland", cities: ["Baltimore", "Annapolis"] }, { name: "Minnesota", cities: ["Minneapolis", "Saint Paul"] },
    { name: "Mississippi", cities: [] }, { name: "Missouri", cities: ["Kansas City", "St. Louis"] },
    { name: "Montana", cities: [] }, { name: "Nebraska", cities: [] }, { name: "Nevada", cities: ["Las Vegas", "Reno"] },
    { name: "New Hampshire", cities: [] }, { name: "New Mexico", cities: [] }, { name: "North Dakota", cities: [] },
    { name: "Oklahoma", cities: [] }, { name: "Oregon", cities: ["Portland", "Eugene"] },
    { name: "Rhode Island", cities: [] }, { name: "South Carolina", cities: [] }, { name: "South Dakota", cities: [] },
    { name: "Tennessee", cities: ["Nashville", "Memphis"] }, { name: "Utah", cities: ["Salt Lake City"] },
    { name: "Vermont", cities: [] }, { name: "West Virginia", cities: [] },
    { name: "Wisconsin", cities: ["Milwaukee", "Madison"] }, { name: "Wyoming", cities: [] },
    { name: "District of Columbia", cities: ["Washington"] },
  ],

  /* ── Other markets: divisions, cities where we actually ship ── */
  IT: [
    { name: "Lombardy", cities: ["Milan", "Brescia", "Bergamo", "Monza"] },
    { name: "Veneto", cities: ["Venice", "Verona", "Padua", "Vicenza", "Treviso"] },
    { name: "Emilia-Romagna", cities: ["Bologna", "Modena", "Parma", "Reggio Emilia", "Rimini"] },
    { name: "Tuscany", cities: ["Florence", "Prato", "Pisa", "Livorno", "Arezzo"] },
    { name: "Piedmont", cities: ["Turin", "Novara", "Alessandria"] },
    { name: "Lazio", cities: ["Rome", "Latina", "Frosinone"] },
    { name: "Campania", cities: ["Naples", "Salerno", "Caserta"] },
    { name: "Marche", cities: ["Ancona", "Pesaro", "Macerata", "Fermo"] },
    { name: "Apulia", cities: ["Bari", "Taranto", "Lecce", "Foggia"] },
    { name: "Sicily", cities: ["Palermo", "Catania", "Messina"] },
  ],
  DE: [
    { name: "Bavaria", cities: ["Munich", "Nuremberg", "Augsburg", "Würzburg"] },
    { name: "North Rhine-Westphalia", cities: ["Cologne", "Düsseldorf", "Dortmund", "Essen", "Duisburg"] },
    { name: "Baden-Württemberg", cities: ["Stuttgart", "Mannheim", "Karlsruhe", "Freiburg"] },
    { name: "Hesse", cities: ["Frankfurt", "Wiesbaden", "Kassel", "Darmstadt"] },
    { name: "Berlin", cities: ["Berlin"] },
    { name: "Hamburg", cities: ["Hamburg"] },
    { name: "Lower Saxony", cities: ["Hanover", "Braunschweig", "Osnabrück"] },
    { name: "Saxony", cities: ["Dresden", "Leipzig", "Chemnitz"] },
  ],
  GB: [
    { name: "England", cities: ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Bristol", "Leicester", "Nottingham"] },
    { name: "Scotland", cities: ["Glasgow", "Edinburgh", "Aberdeen", "Dundee"] },
    { name: "Wales", cities: ["Cardiff", "Swansea", "Newport"] },
    { name: "Northern Ireland", cities: ["Belfast", "Derry"] },
  ],
  FR: [
    { name: "Île-de-France", cities: ["Paris", "Boulogne-Billancourt", "Saint-Denis", "Versailles"] },
    { name: "Auvergne-Rhône-Alpes", cities: ["Lyon", "Grenoble", "Saint-Étienne"] },
    { name: "Provence-Alpes-Côte d'Azur", cities: ["Marseille", "Nice", "Toulon", "Cannes"] },
    { name: "Occitanie", cities: ["Toulouse", "Montpellier", "Nîmes"] },
    { name: "Hauts-de-France", cities: ["Lille", "Amiens", "Roubaix"] },
    { name: "Nouvelle-Aquitaine", cities: ["Bordeaux", "Limoges", "Pau"] },
  ],
  ES: [
    { name: "Madrid", cities: ["Madrid", "Móstoles", "Alcalá de Henares"] },
    { name: "Catalonia", cities: ["Barcelona", "Badalona", "Terrassa", "Sabadell", "Igualada"] },
    { name: "Valencia", cities: ["Valencia", "Alicante", "Elche"] },
    { name: "Andalusia", cities: ["Seville", "Málaga", "Córdoba", "Granada"] },
    { name: "Basque Country", cities: ["Bilbao", "San Sebastián", "Vitoria-Gasteiz"] },
    { name: "Galicia", cities: ["Vigo", "A Coruña", "Santiago de Compostela"] },
  ],
  JP: [
    { name: "Tokyo", cities: ["Shinjuku", "Shibuya", "Minato", "Chiyoda", "Ota"] },
    { name: "Osaka", cities: ["Osaka", "Sakai", "Higashiosaka"] },
    { name: "Aichi", cities: ["Nagoya", "Toyota", "Okazaki"] },
    { name: "Kanagawa", cities: ["Yokohama", "Kawasaki", "Sagamihara"] },
    { name: "Fukuoka", cities: ["Fukuoka", "Kitakyushu"] },
    { name: "Hokkaido", cities: ["Sapporo", "Hakodate"] },
  ],
  KR: [
    { name: "Seoul", cities: ["Gangnam", "Jongno", "Mapo", "Songpa"] },
    { name: "Gyeonggi", cities: ["Suwon", "Seongnam", "Goyang", "Ansan"] },
    { name: "Busan", cities: ["Busan"] },
    { name: "Incheon", cities: ["Incheon"] },
    { name: "Daegu", cities: ["Daegu"] },
  ],
  MA: [
    { name: "Casablanca-Settat", cities: ["Casablanca", "Mohammedia", "Settat", "El Jadida"] },
    { name: "Rabat-Salé-Kénitra", cities: ["Rabat", "Salé", "Kénitra", "Témara"] },
    { name: "Marrakesh-Safi", cities: ["Marrakesh", "Safi", "Essaouira"] },
    { name: "Fès-Meknès", cities: ["Fès", "Meknès", "Taza"] },
    { name: "Tanger-Tétouan-Al Hoceïma", cities: ["Tangier", "Tétouan", "Al Hoceïma"] },
  ],
  JO: [
    { name: "Amman", name_alt: "عمّان", cities: ["Amman", "Sahab", "Wadi Seer"] },
    { name: "Irbid", name_alt: "إربد", cities: ["Irbid", "Ramtha"] },
    { name: "Zarqa", name_alt: "الزرقاء", cities: ["Zarqa", "Russeifa"] },
    { name: "Aqaba", name_alt: "العقبة", cities: ["Aqaba"] },
    { name: "Balqa", name_alt: "البلقاء", cities: ["Salt"] },
  ],
  IQ: [
    { name: "Baghdad", name_alt: "بغداد", cities: ["Baghdad", "Sadr City", "Karkh"] },
    { name: "Erbil", name_alt: "أربيل", cities: ["Erbil", "Soran"] },
    { name: "Basra", name_alt: "البصرة", cities: ["Basra", "Zubair"] },
    { name: "Nineveh", name_alt: "نينوى", cities: ["Mosul"] },
    { name: "Sulaymaniyah", name_alt: "السليمانية", cities: ["Sulaymaniyah"] },
    { name: "Najaf", name_alt: "النجف", cities: ["Najaf", "Kufa"] },
    { name: "Karbala", name_alt: "كربلاء", cities: ["Karbala"] },
  ],
  KW: [
    { name: "Al Asimah", name_alt: "العاصمة", cities: ["Kuwait City", "Sharq", "Dasman"] },
    { name: "Hawalli", name_alt: "حولي", cities: ["Hawalli", "Salmiya"] },
    { name: "Farwaniya", name_alt: "الفروانية", cities: ["Farwaniya", "Jleeb Al-Shuyoukh"] },
    { name: "Ahmadi", name_alt: "الأحمدي", cities: ["Ahmadi", "Fahaheel", "Mangaf"] },
    { name: "Jahra", name_alt: "الجهراء", cities: ["Jahra"] },
    { name: "Mubarak Al-Kabeer", name_alt: "مبارك الكبير", cities: ["Mubarak Al-Kabeer"] },
  ],
  QA: [
    { name: "Doha", name_alt: "الدوحة", cities: ["Doha", "West Bay", "Msheireb"] },
    { name: "Al Rayyan", name_alt: "الريان", cities: ["Al Rayyan", "Education City"] },
    { name: "Al Wakrah", name_alt: "الوكرة", cities: ["Al Wakrah", "Mesaieed"] },
    { name: "Umm Salal", name_alt: "أم صلال", cities: ["Umm Salal"] },
    { name: "Al Khor", name_alt: "الخور", cities: ["Al Khor", "Ras Laffan"] },
  ],
  OM: [
    { name: "Muscat", name_alt: "مسقط", cities: ["Muscat", "Seeb", "Mutrah", "Bawshar"] },
    { name: "Dhofar", name_alt: "ظفار", cities: ["Salalah"] },
    { name: "Al Batinah North", name_alt: "شمال الباطنة", cities: ["Sohar", "Shinas"] },
    { name: "Al Batinah South", name_alt: "جنوب الباطنة", cities: ["Rustaq", "Barka"] },
    { name: "Ad Dakhiliyah", name_alt: "الداخلية", cities: ["Nizwa", "Bahla"] },
  ],
  BH: [
    { name: "Capital", name_alt: "العاصمة", cities: ["Manama", "Juffair", "Seef"] },
    { name: "Muharraq", name_alt: "المحرق", cities: ["Muharraq", "Hidd"] },
    { name: "Northern", name_alt: "الشمالية", cities: ["Budaiya", "Hamad Town"] },
    { name: "Southern", name_alt: "الجنوبية", cities: ["Riffa", "Isa Town"] },
  ],
  LB: [
    { name: "Beirut", name_alt: "بيروت", cities: ["Beirut", "Achrafieh", "Hamra"] },
    { name: "Mount Lebanon", name_alt: "جبل لبنان", cities: ["Jounieh", "Baabda", "Aley"] },
    { name: "North", name_alt: "الشمال", cities: ["Tripoli", "Zgharta"] },
    { name: "South", name_alt: "الجنوب", cities: ["Sidon", "Tyre"] },
    { name: "Bekaa", name_alt: "البقاع", cities: ["Zahle", "Baalbek"] },
  ],
  DZ: [
    { name: "Algiers", name_alt: "الجزائر", cities: ["Algiers", "Bab Ezzouar"] },
    { name: "Oran", name_alt: "وهران", cities: ["Oran", "Es Senia"] },
    { name: "Constantine", name_alt: "قسنطينة", cities: ["Constantine"] },
    { name: "Annaba", name_alt: "عنابة", cities: ["Annaba"] },
    { name: "Blida", name_alt: "البليدة", cities: ["Blida"] },
    { name: "Setif", name_alt: "سطيف", cities: ["Setif"] },
  ],
  TN: [
    { name: "Tunis", name_alt: "تونس", cities: ["Tunis", "La Marsa", "Ariana"] },
    { name: "Sfax", name_alt: "صفاقس", cities: ["Sfax"] },
    { name: "Sousse", name_alt: "سوسة", cities: ["Sousse", "Msaken"] },
    { name: "Monastir", name_alt: "المنستير", cities: ["Monastir", "Ksar Hellal"] },
    { name: "Nabeul", name_alt: "نابل", cities: ["Nabeul", "Hammamet"] },
  ],
  LY: [
    { name: "Tripoli", name_alt: "طرابلس", cities: ["Tripoli", "Tajura"] },
    { name: "Benghazi", name_alt: "بنغازي", cities: ["Benghazi"] },
    { name: "Misrata", name_alt: "مصراتة", cities: ["Misrata"] },
    { name: "Zawiya", name_alt: "الزاوية", cities: ["Zawiya"] },
  ],
  SD: [
    { name: "Khartoum", name_alt: "الخرطوم", cities: ["Khartoum", "Omdurman", "Bahri"] },
    { name: "Gezira", name_alt: "الجزيرة", cities: ["Wad Madani"] },
    { name: "Red Sea", name_alt: "البحر الأحمر", cities: ["Port Sudan"] },
    { name: "Kassala", name_alt: "كسلا", cities: ["Kassala"] },
  ],
  YE: [
    { name: "Sana'a", name_alt: "صنعاء", cities: ["Sana'a"] },
    { name: "Aden", name_alt: "عدن", cities: ["Aden"] },
    { name: "Taiz", name_alt: "تعز", cities: ["Taiz"] },
    { name: "Hadhramaut", name_alt: "حضرموت", cities: ["Mukalla", "Seiyun"] },
    { name: "Hodeidah", name_alt: "الحديدة", cities: ["Hodeidah"] },
  ],
  SY: [
    { name: "Damascus", name_alt: "دمشق", cities: ["Damascus"] },
    { name: "Aleppo", name_alt: "حلب", cities: ["Aleppo"] },
    { name: "Homs", name_alt: "حمص", cities: ["Homs"] },
    { name: "Latakia", name_alt: "اللاذقية", cities: ["Latakia"] },
    { name: "Hama", name_alt: "حماة", cities: ["Hama"] },
  ],
  RU: [
    { name: "Moscow", cities: ["Moscow"] },
    { name: "Saint Petersburg", cities: ["Saint Petersburg"] },
    { name: "Moscow Oblast", cities: ["Balashikha", "Khimki", "Podolsk"] },
    { name: "Sverdlovsk Oblast", cities: ["Yekaterinburg"] },
    { name: "Tatarstan", cities: ["Kazan", "Naberezhnye Chelny"] },
  ],
  BR: [
    { name: "São Paulo", cities: ["São Paulo", "Campinas", "Guarulhos", "Santos"] },
    { name: "Rio de Janeiro", cities: ["Rio de Janeiro", "Niterói", "Duque de Caxias"] },
    { name: "Minas Gerais", cities: ["Belo Horizonte", "Uberlândia"] },
    { name: "Santa Catarina", cities: ["Florianópolis", "Joinville", "Blumenau"] },
    { name: "Paraná", cities: ["Curitiba", "Londrina", "Maringá"] },
    { name: "Ceará", cities: ["Fortaleza"] },
  ],
  MX: [
    { name: "Mexico City", cities: ["Mexico City"] },
    { name: "Jalisco", cities: ["Guadalajara", "Zapopan"] },
    { name: "Nuevo León", cities: ["Monterrey", "San Pedro Garza García"] },
    { name: "State of Mexico", cities: ["Toluca", "Ecatepec", "Naucalpan"] },
    { name: "Puebla", cities: ["Puebla"] },
  ],
  CA: [
    { name: "Ontario", cities: ["Toronto", "Ottawa", "Mississauga", "Hamilton", "London"] },
    { name: "Quebec", cities: ["Montreal", "Quebec City", "Laval", "Gatineau"] },
    { name: "British Columbia", cities: ["Vancouver", "Surrey", "Victoria", "Burnaby"] },
    { name: "Alberta", cities: ["Calgary", "Edmonton"] },
    { name: "Manitoba", cities: ["Winnipeg"] },
  ],
  AU: [
    { name: "New South Wales", cities: ["Sydney", "Newcastle", "Wollongong"] },
    { name: "Victoria", cities: ["Melbourne", "Geelong"] },
    { name: "Queensland", cities: ["Brisbane", "Gold Coast", "Cairns"] },
    { name: "Western Australia", cities: ["Perth", "Fremantle"] },
    { name: "South Australia", cities: ["Adelaide"] },
  ],
  TH: [
    { name: "Bangkok", cities: ["Bangkok"] },
    { name: "Chiang Mai", cities: ["Chiang Mai"] },
    { name: "Chonburi", cities: ["Pattaya", "Si Racha"] },
    { name: "Samut Prakan", cities: ["Samut Prakan"] },
  ],
  PH: [
    { name: "Metro Manila", cities: ["Manila", "Quezon City", "Makati", "Pasig", "Taguig"] },
    { name: "Cebu", cities: ["Cebu City", "Mandaue", "Lapu-Lapu"] },
    { name: "Davao", cities: ["Davao City"] },
    { name: "Laguna", cities: ["Calamba", "Santa Rosa"] },
  ],
  MY: [
    { name: "Kuala Lumpur", cities: ["Kuala Lumpur"] },
    { name: "Selangor", cities: ["Shah Alam", "Petaling Jaya", "Klang", "Subang Jaya"] },
    { name: "Johor", cities: ["Johor Bahru", "Batu Pahat"] },
    { name: "Penang", cities: ["George Town", "Butterworth"] },
  ],
  SG: [
    { name: "Central Region", cities: ["Downtown Core", "Orchard", "Novena", "Bukit Merah"] },
    { name: "East Region", cities: ["Bedok", "Tampines", "Changi"] },
    { name: "West Region", cities: ["Jurong", "Clementi", "Tuas"] },
    { name: "North Region", cities: ["Woodlands", "Yishun", "Sembawang"] },
    { name: "North-East Region", cities: ["Hougang", "Sengkang", "Punggol"] },
  ],
  NG: [
    { name: "Lagos", cities: ["Lagos", "Ikeja", "Lekki"] },
    { name: "Abuja FCT", cities: ["Abuja"] },
    { name: "Kano", cities: ["Kano"] },
    { name: "Rivers", cities: ["Port Harcourt"] },
  ],
  ZA: [
    { name: "Gauteng", cities: ["Johannesburg", "Pretoria", "Soweto"] },
    { name: "Western Cape", cities: ["Cape Town", "Stellenbosch"] },
    { name: "KwaZulu-Natal", cities: ["Durban", "Pietermaritzburg"] },
    { name: "Eastern Cape", cities: ["Gqeberha", "East London"] },
  ],
  ET: [
    { name: "Addis Ababa", cities: ["Addis Ababa"] },
    { name: "Oromia", cities: ["Adama", "Jimma", "Bishoftu"] },
    { name: "Amhara", cities: ["Bahir Dar", "Gondar"] },
    { name: "Tigray", cities: ["Mekelle"] },
  ],
};

/** Divisions for a country code, or `[]` when we don't carry that country —
    the caller keeps free typing in that case rather than blocking entry. */
export function regionsFor(countryCode: string | null | undefined): readonly Region[] {
  if (!countryCode) return [];
  return REGIONS[countryCode.toUpperCase()] ?? [];
}

/** Cities for one division. Matches on the English name OR the native one, so
    a row saved before this list existed still resolves. */
export function citiesFor(
  countryCode: string | null | undefined,
  regionName: string | null | undefined,
): readonly string[] {
  if (!regionName) return [];
  const needle = regionName.trim().toLowerCase();
  const hit = regionsFor(countryCode).find(
    (r) => r.name.toLowerCase() === needle || r.name_alt?.toLowerCase() === needle,
  );
  return hit?.cities ?? [];
}

/** True when we carry divisions for this country — lets the UI say "type it"
    instead of showing an empty dropdown that looks broken. */
export function hasRegions(countryCode: string | null | undefined): boolean {
  return regionsFor(countryCode).length > 0;
}
