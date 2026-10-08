/* ---------------------------------------------------------------------------
   legal/documents — Koleex's three public legal pages (privacy policy, terms
   of service, data deletion instructions), in English, Arabic and Chinese.

   Written 27/09/2026 for the platforms' app requirements (Meta, Google /
   YouTube, LinkedIn, TikTok, X), with the company's facts from the Hub
   (official name, the Taizhou address, info@koleexgroup.com). The names
   come from lib/legal-name.ts — never typed here (validate:legal-name). Served
   publicly by /legal/<doc>/<lang> (owner, 28/09/2026: on the Hub, since the
   Wix site's classic Editor cannot take new pages by API). Drafts, not legal
   advice: the governing-law clause names the PRC and the courts where
   Koleex is registered.

   Inline parts: a string, { b } bold, { a, text } a link, { ltr } a Latin
   run inside Arabic, { br } a line break.
   --------------------------------------------------------------------------- */

import { EVERYDAY_NAME_EN, legalNameEn } from "@/lib/legal-name";

/** The formal name, from the one source (lib/legal-name.ts): the pages are
 *  built at deploy, so they carry the name in force on the day they are
 *  built — from 01/10/2026 the new spelling. */
const LEGAL_EN = legalNameEn();

export type LegalPart = string | { b: string } | { a: string; text: string } | { ltr: string } | { br: true };
export type LegalBlock =
  | { t: "h2"; parts: LegalPart[] }
  | { t: "p"; parts: LegalPart[] }
  | { t: "ul"; items: LegalPart[][] }
  | { t: "ol"; items: LegalPart[][] };
export interface LegalDoc { title: string; updated: string; blocks: LegalBlock[] }

export type LegalLang = "en" | "ar" | "zh";
export const LEGAL_LANGS: readonly LegalLang[] = ["en", "ar", "zh"];

/** The three documents by their public address. */
export const LEGAL_SLUGS = {
  "privacy-policy": "privacy",
  "terms-of-service": "terms",
  "data-deletion": "deletion",
} as const;
export type LegalSlug = keyof typeof LEGAL_SLUGS;

export const LEGAL_DOCS: Record<(typeof LEGAL_SLUGS)[LegalSlug], Record<LegalLang, LegalDoc>> = {
 "privacy": {
  "en": {
   "title": "Privacy Policy",
   "updated": "Effective date: 27 September 2026",
   "blocks": [
    {
     "t": "h2",
     "parts": [
      "1. Who we are"
     ]
    },
    {
     "t": "p",
     "parts": [
      `This Privacy Policy explains how ${LEGAL_EN} (trading as ${EVERYDAY_NAME_EN}, “Koleex”, “we”, “us”) collects, uses and protects personal information. Our registered address is Room 206, Building 88, West Feiyue Technological Innovative Park, Jingshui An Community, Xiachen Street, Jiaojiang District, Taizhou City, Zhejiang Province, China. You can contact us about privacy at info@koleexgroup.com.`
     ]
    },
    {
     "t": "h2",
     "parts": [
      "2. What this policy covers"
     ]
    },
    {
     "t": "p",
     "parts": [
      "It covers our website www.koleexgroup.com, our emails and messages, and the tools we use to run Koleex’s own official accounts on social media and messaging platforms, including Facebook, Instagram, WhatsApp, LinkedIn, YouTube, TikTok, X and WeChat (“our marketing tools”)."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "3. Information we collect"
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       {
        "b": "Information you give us."
       },
       " When you send an inquiry, request a quotation or catalogue, subscribe to updates or write to us, we collect your name, company, country, email address, phone number and the content of your message."
      ],
      [
       {
        "b": "Business information."
       },
       " When you are a customer, distributor or supplier, we keep the contact and transaction details we need to work with you."
      ],
      [
       {
        "b": "Information from social media and messaging platforms."
       },
       " When you comment on, message, mention or follow one of Koleex’s official accounts, the platform shares with us, through its official interface, the information it makes available for that interaction: usually your public name or username, profile picture, and the content and time of your comment or message. We also receive statistics about our own posts and accounts, such as reach and engagement. We only connect accounts that Koleex owns or manages, with the permission of their administrators, and we never access your private account."
      ],
      [
       {
        "b": "Website usage information."
       },
       " Our website may use cookies and similar technologies to run the site and measure visits, for example your device type, the pages you view and your approximate location. You can control cookies in your browser settings."
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "4. How we use information"
     ]
    },
    {
     "t": "p",
     "parts": [
      "We use information to:"
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       "answer your inquiries and prepare quotations;"
      ],
      [
       "publish and schedule posts on Koleex’s own accounts, and reply to comments and messages sent to them;"
      ],
      [
       "measure how our posts, campaigns and website perform;"
      ],
      [
       "send newsletters, WhatsApp or SMS messages only when you have agreed to receive them. Every message tells you how to stop them, and you can opt out at any time;"
      ],
      [
       "manage our relationships with customers, distributors and suppliers;"
      ],
      [
       "keep our services secure and meet our legal obligations."
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "5. Data from platform interfaces (APIs)"
     ]
    },
    {
     "t": "p",
     "parts": [
      "Information we receive from Meta (Facebook, Instagram, WhatsApp), Google (YouTube), LinkedIn, TikTok, X and other platforms is used only to operate Koleex’s own accounts as described above. We do not sell it, we do not use it to build advertising profiles, and we do not share it with data brokers. Access keys issued by the platforms are stored encrypted and are available only to our systems and authorised staff. Each platform’s own privacy policy also applies to your use of that platform."
     ]
    },
    {
     "t": "p",
     "parts": [
      {
       "b": "Our use of YouTube."
      },
      " Our marketing tools use YouTube API Services. When you interact with Koleex’s YouTube channel, you are also subject to the YouTube Terms of Service (",
      {
       "a": "https://www.youtube.com/t/terms",
       "text": "https://www.youtube.com/t/terms"
      },
      ") and the Google Privacy Policy (",
      {
       "a": "https://policies.google.com/privacy",
       "text": "https://policies.google.com/privacy"
      },
      "). Koleex’s use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements. An administrator who connected a Google account can revoke our access at any time at ",
      {
       "a": "https://myaccount.google.com/permissions",
       "text": "https://myaccount.google.com/permissions"
      },
      "."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "6. Sharing"
     ]
    },
    {
     "t": "p",
     "parts": [
      "We share personal information only:"
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       "with service providers who help us run our website, hosting, email, SMS and messaging, under contracts that require them to protect it;"
      ],
      [
       "within the Koleex group of companies, for the purposes in this policy;"
      ],
      [
       "when the law requires it, or to protect our rights and the safety of others."
      ]
     ]
    },
    {
     "t": "p",
     "parts": [
      "We never sell personal information."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "7. International transfers"
     ]
    },
    {
     "t": "p",
     "parts": [
      "We work with customers and partners in many countries, and our service providers may store information outside your country. When we transfer information, we take reasonable steps to protect it as described in this policy."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "8. How long we keep information"
     ]
    },
    {
     "t": "p",
     "parts": [
      "We keep information only as long as we need it for the purpose we collected it for, or as long as the law requires (for example, invoices). Information received from a platform is deleted when the account’s connection is removed or when you ask us to delete it, unless the law requires us to keep it."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "9. Security"
     ]
    },
    {
     "t": "p",
     "parts": [
      "We protect information with access controls, encryption of access keys and encrypted connections. No system is completely secure, but we work to keep your information safe."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "10. Your rights"
     ]
    },
    {
     "t": "p",
     "parts": [
      "Depending on where you live, you may have the right to access, correct or delete your personal information, to object to or restrict its use, and to withdraw your consent. To make a request, email info@koleexgroup.com. We will reply within 30 days. To ask us to delete information we received through a social media platform, follow our Data Deletion Instructions."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "11. Children"
     ]
    },
    {
     "t": "p",
     "parts": [
      "Our website and services are for businesses and are not directed at children under 16. We do not knowingly collect their information."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "12. Changes to this policy"
     ]
    },
    {
     "t": "p",
     "parts": [
      "We may update this policy. The effective date at the top shows when it last changed."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "13. Contact"
     ]
    },
    {
     "t": "p",
     "parts": [
      LEGAL_EN,
      {
       "br": true
      },
      "Room 206, Building 88, West Feiyue Technological Innovative Park, Jingshui An Community, Xiachen Street, Jiaojiang District, Taizhou City, Zhejiang Province, China",
      {
       "br": true
      },
      "Email: info@koleexgroup.com · Tel: +86 576 8892 7796"
     ]
    }
   ]
  },
  "ar": {
   "title": "سياسة الخصوصية",
   "updated": "تاريخ السريان: 27 سبتمبر 2026",
   "blocks": [
    {
     "t": "h2",
     "parts": [
      "1. من نحن"
     ]
    },
    {
     "t": "p",
     "parts": [
      "توضح سياسة الخصوصية هذه كيف تجمع شركة ",
      {
       "ltr": LEGAL_EN
      },
      " (وتعمل تحت اسم كولكس إنترناشونال جروب، ويُشار إليها فيما يلي بـ«كولكس» أو «نحن») المعلومات الشخصية وتستخدمها وتحميها. عنواننا المسجل: ",
      {
       "ltr": "Room 206, Building 88, West Feiyue Technological Innovative Park, Jingshui An Community, Xiachen Street, Jiaojiang District, Taizhou City, Zhejiang Province, China"
      },
      ". وللتواصل بشأن الخصوصية: ",
      {
       "ltr": "info@koleexgroup.com"
      },
      "."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "2. نطاق هذه السياسة"
     ]
    },
    {
     "t": "p",
     "parts": [
      "تسري هذه السياسة على موقعنا ",
      {
       "ltr": "www.koleexgroup.com"
      },
      "، وعلى رسائلنا البريدية والنصية، وعلى الأدوات التي نستخدمها لإدارة حسابات كولكس الرسمية على منصات التواصل الاجتماعي والمراسلة، ومنها Facebook وInstagram وWhatsApp وLinkedIn وYouTube وTikTok وX وWeChat («أدواتنا التسويقية»)."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "3. المعلومات التي نجمعها"
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       {
        "b": "المعلومات التي تقدمها لنا."
       },
       " عند إرسال استفسار، أو طلب عرض سعر أو كتالوج، أو الاشتراك في النشرات، أو مراسلتنا، نجمع اسمك واسم شركتك وبلدك وبريدك الإلكتروني ورقم هاتفك ومحتوى رسالتك."
      ],
      [
       {
        "b": "معلومات العمل."
       },
       " إذا كنت عميلًا أو موزعًا أو موردًا، نحتفظ ببيانات الاتصال والمعاملات اللازمة للتعامل معك."
      ],
      [
       {
        "b": "المعلومات الواردة من منصات التواصل والمراسلة."
       },
       " عندما تعلّق على أحد حسابات كولكس الرسمية أو تراسله أو تشير إليه أو تتابعه، تشاركنا المنصة، عبر واجهتها الرسمية، المعلومات التي تتيحها لهذا التفاعل، وعادةً اسمك العام أو اسم المستخدم، وصورة ملفك الشخصي، ونص تعليقك أو رسالتك ووقتها. كما نتلقى إحصاءات عن منشوراتنا وحساباتنا، مثل الوصول والتفاعل. ولا نربط إلا الحسابات التي تملكها كولكس أو تديرها، بإذن من مسؤوليها، ولا نصل أبدًا إلى حسابك الخاص."
      ],
      [
       {
        "b": "معلومات استخدام الموقع."
       },
       " قد يستخدم موقعنا ملفات تعريف الارتباط (الكوكيز) وتقنيات مشابهة لتشغيل الموقع وقياس الزيارات، مثل نوع جهازك والصفحات التي تزورها وموقعك التقريبي. ويمكنك التحكم في ملفات تعريف الارتباط من إعدادات متصفحك."
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "4. كيف نستخدم المعلومات"
     ]
    },
    {
     "t": "p",
     "parts": [
      "نستخدم المعلومات من أجل:"
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       "الرد على استفساراتك وإعداد عروض الأسعار؛"
      ],
      [
       "نشر المنشورات وجدولتها على حسابات كولكس، والرد على التعليقات والرسائل الواردة إليها؛"
      ],
      [
       "قياس أداء منشوراتنا وحملاتنا وموقعنا؛"
      ],
      [
       "إرسال النشرات البريدية أو رسائل WhatsApp أو الرسائل النصية فقط إذا وافقت على استلامها. وتوضح كل رسالة طريقة إيقافها، ويمكنك إلغاء الاشتراك في أي وقت؛"
      ],
      [
       "إدارة علاقاتنا مع العملاء والموزعين والموردين؛"
      ],
      [
       "الحفاظ على أمان خدماتنا والوفاء بالتزاماتنا القانونية."
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "5. البيانات الواردة من واجهات المنصات (API)"
     ]
    },
    {
     "t": "p",
     "parts": [
      "نستخدم المعلومات التي نتلقاها من Meta (Facebook وInstagram وWhatsApp) وGoogle (YouTube) وLinkedIn وTikTok وX وغيرها من المنصات فقط لإدارة حسابات كولكس على النحو الموضح أعلاه. ولا نبيعها، ولا نستخدمها لبناء ملفات إعلانية، ولا نشاركها مع وسطاء البيانات. وتُخزَّن مفاتيح الوصول التي تصدرها المنصات مشفّرة، ولا تصل إليها إلا أنظمتنا والموظفون المخوَّلون. وتسري أيضًا سياسة الخصوصية الخاصة بكل منصة على استخدامك لها."
     ]
    },
    {
     "t": "p",
     "parts": [
      {
       "b": "استخدامنا لـ YouTube."
      },
      " تستخدم أدواتنا التسويقية خدمات YouTube API. وعند تفاعلك مع قناة كولكس على YouTube، فإنك تخضع أيضًا لشروط خدمة YouTube (",
      {
       "a": "https://www.youtube.com/t/terms",
       "text": "https://www.youtube.com/t/terms"
      },
      ") وسياسة خصوصية Google (",
      {
       "a": "https://policies.google.com/privacy",
       "text": "https://policies.google.com/privacy"
      },
      "). ويلتزم استخدام كولكس للمعلومات الواردة من واجهات Google ونقلها بسياسة بيانات المستخدم لخدمات Google API، بما في ذلك متطلبات الاستخدام المحدود (Limited Use). ويمكن للمسؤول الذي ربط حساب Google إلغاء وصولنا في أي وقت من ",
      {
       "a": "https://myaccount.google.com/permissions",
       "text": "https://myaccount.google.com/permissions"
      },
      "."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "6. مشاركة المعلومات"
     ]
    },
    {
     "t": "p",
     "parts": [
      "لا نشارك المعلومات الشخصية إلا:"
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       "مع مزودي الخدمات الذين يساعدوننا في تشغيل الموقع والاستضافة والبريد الإلكتروني والرسائل النصية والمراسلة، بموجب عقود تلزمهم بحمايتها؛"
      ],
      [
       "داخل مجموعة شركات كولكس، للأغراض الواردة في هذه السياسة؛"
      ],
      [
       "عندما يفرض القانون ذلك، أو لحماية حقوقنا وسلامة الآخرين."
      ]
     ]
    },
    {
     "t": "p",
     "parts": [
      "ولا نبيع المعلومات الشخصية أبدًا."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "7. النقل الدولي للبيانات"
     ]
    },
    {
     "t": "p",
     "parts": [
      "نعمل مع عملاء وشركاء في دول كثيرة، وقد يخزّن مزودو خدماتنا المعلومات خارج بلدك. وعند نقل المعلومات نتخذ خطوات معقولة لحمايتها كما تصف هذه السياسة."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "8. مدة الاحتفاظ بالمعلومات"
     ]
    },
    {
     "t": "p",
     "parts": [
      "نحتفظ بالمعلومات فقط للمدة اللازمة للغرض الذي جُمعت من أجله، أو للمدة التي يفرضها القانون (مثل الفواتير). وتُحذف المعلومات الواردة من أي منصة عند إلغاء ربط الحساب أو عند طلبك حذفها، ما لم يلزمنا القانون بالاحتفاظ بها."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "9. أمن المعلومات"
     ]
    },
    {
     "t": "p",
     "parts": [
      "نحمي المعلومات بضوابط الوصول، وتشفير مفاتيح الوصول، والاتصالات المشفرة. ولا يوجد نظام آمن تمامًا، لكننا نعمل على حماية معلوماتك."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "10. حقوقك"
     ]
    },
    {
     "t": "p",
     "parts": [
      "بحسب مكان إقامتك، قد يحق لك الوصول إلى معلوماتك الشخصية أو تصحيحها أو حذفها، والاعتراض على استخدامها أو تقييده، وسحب موافقتك. ولتقديم طلب، راسلنا على ",
      {
       "ltr": "info@koleexgroup.com"
      },
      "، وسنرد خلال 30 يومًا. ولطلب حذف معلومات وصلتنا عبر إحدى منصات التواصل، اتبع تعليمات حذف البيانات لدينا."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "11. الأطفال"
     ]
    },
    {
     "t": "p",
     "parts": [
      "موقعنا وخدماتنا موجهة للشركات، وليست موجهة للأطفال دون سن 16 عامًا، ولا نجمع معلوماتهم عن قصد."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "12. التعديلات على هذه السياسة"
     ]
    },
    {
     "t": "p",
     "parts": [
      "قد نحدّث هذه السياسة، ويوضح تاريخ السريان في أعلاها موعد آخر تعديل."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "13. التواصل"
     ]
    },
    {
     "t": "p",
     "parts": [
      {
       "ltr": LEGAL_EN
      },
      {
       "br": true
      },
      {
       "ltr": "Room 206, Building 88, West Feiyue Technological Innovative Park, Jingshui An Community, Xiachen Street, Jiaojiang District, Taizhou City, Zhejiang Province, China"
      },
      {
       "br": true
      },
      "البريد الإلكتروني: ",
      {
       "ltr": "info@koleexgroup.com"
      },
      " · الهاتف: ",
      {
       "ltr": "+86 576 8892 7796"
      }
     ]
    }
   ]
  },
  "zh": {
   "title": "隐私政策",
   "updated": "生效日期：2026年9月27日",
   "blocks": [
    {
     "t": "h2",
     "parts": [
      "1. 我们是谁"
     ]
    },
    {
     "t": "p",
     "parts": [
      `本隐私政策说明科莱恪斯国际商业管理（台州）有限公司（${LEGAL_EN}，以 ${EVERYDAY_NAME_EN} 名义开展业务，以下简称“Koleex”或“我们”）如何收集、使用和保护个人信息。我们的注册地址为：浙江省台州市椒江区下陈街道泾水岸社区飞跃科创园西区88幢206室。如对隐私有任何疑问，请联系 info@koleexgroup.com。`
     ]
    },
    {
     "t": "h2",
     "parts": [
      "2. 适用范围"
     ]
    },
    {
     "t": "p",
     "parts": [
      "本政策适用于我们的网站 www.koleexgroup.com、我们发送的电子邮件和消息，以及我们用于运营 Koleex 在社交媒体和即时通讯平台（包括 Facebook、Instagram、WhatsApp、LinkedIn、YouTube、TikTok、X 和微信）上官方账号的工具（“我们的营销工具”）。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "3. 我们收集的信息"
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       {
        "b": "您提供的信息。"
       },
       "当您发送咨询、索取报价或产品目录、订阅资讯或与我们联系时，我们会收集您的姓名、公司、国家/地区、电子邮箱、电话号码及留言内容。"
      ],
      [
       {
        "b": "业务信息。"
       },
       "如果您是我们的客户、经销商或供应商，我们会保存与您开展合作所需的联系方式和交易信息。"
      ],
      [
       {
        "b": "来自社交媒体和通讯平台的信息。"
       },
       "当您对 Koleex 的官方账号发表评论、发送消息、提及或关注时，平台会通过其官方接口向我们提供该互动中可获取的信息，通常包括您的公开名称或用户名、头像，以及评论或消息的内容和时间。我们还会获取关于我们自己帖子和账号的统计数据，例如覆盖人数和互动情况。我们只连接 Koleex 拥有或管理的账号，并已获得其管理员授权；我们绝不会访问您的私人账号。"
      ],
      [
       {
        "b": "网站使用信息。"
       },
       "我们的网站可能使用 Cookie 及类似技术来运行网站和统计访问情况，例如您的设备类型、浏览的页面和大致位置。您可以在浏览器设置中管理 Cookie。"
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "4. 我们如何使用信息"
     ]
    },
    {
     "t": "p",
     "parts": [
      "我们将信息用于："
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       "回复您的咨询并准备报价；"
      ],
      [
       "在 Koleex 自有账号上发布和定时发布内容，并回复发送至这些账号的评论和消息；"
      ],
      [
       "衡量我们的帖子、营销活动和网站的效果；"
      ],
      [
       "仅在您同意接收的情况下发送电子通讯、WhatsApp 消息或短信。每条消息都会告知停止接收的方式，您可随时退订；"
      ],
      [
       "管理我们与客户、经销商和供应商的关系；"
      ],
      [
       "保障服务安全并履行法律义务。"
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "5. 来自平台接口（API）的数据"
     ]
    },
    {
     "t": "p",
     "parts": [
      "我们从 Meta（Facebook、Instagram、WhatsApp）、Google（YouTube）、LinkedIn、TikTok、X 及其他平台获取的信息，仅用于按上述方式运营 Koleex 自有账号。我们不会出售这些信息，不会将其用于建立广告画像，也不会与数据经纪商共享。平台签发的访问密钥均经加密存储，仅供我们的系统和经授权的员工使用。您对各平台的使用同时受该平台自身隐私政策的约束。"
     ]
    },
    {
     "t": "p",
     "parts": [
      {
       "b": "关于 YouTube。"
      },
      "我们的营销工具使用 YouTube API 服务。当您与 Koleex 的 YouTube 频道互动时，您同时受 YouTube 服务条款（",
      {
       "a": "https://www.youtube.com/t/terms",
       "text": "https://www.youtube.com/t/terms"
      },
      "）和 Google 隐私权政策（",
      {
       "a": "https://policies.google.com/privacy",
       "text": "https://policies.google.com/privacy"
      },
      "）的约束。Koleex 对从 Google API 获取的信息的使用和传输，将遵守《Google API 服务用户数据政策》，包括其中的“有限使用”要求。关联 Google 账号的管理员可随时在 ",
      {
       "a": "https://myaccount.google.com/permissions",
       "text": "https://myaccount.google.com/permissions"
      },
      " 撤销我们的访问权限。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "6. 信息共享"
     ]
    },
    {
     "t": "p",
     "parts": [
      "我们仅在以下情况下共享个人信息："
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       "与帮助我们运营网站、托管、电子邮件、短信和消息服务的服务提供商共享，并通过合同要求其保护信息；"
      ],
      [
       "在 Koleex 集团公司内部，为本政策所述目的共享；"
      ],
      [
       "法律要求时，或为保护我们的权利及他人安全。"
      ]
     ]
    },
    {
     "t": "p",
     "parts": [
      "我们绝不出售个人信息。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "7. 跨境传输"
     ]
    },
    {
     "t": "p",
     "parts": [
      "我们与众多国家和地区的客户及合作伙伴开展业务，我们的服务提供商可能在您所在国家/地区以外存储信息。在传输信息时，我们会采取合理措施，按照本政策的说明保护信息。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "8. 信息保存期限"
     ]
    },
    {
     "t": "p",
     "parts": [
      "我们仅在实现收集目的所需的期限内或法律要求的期限内（例如发票）保存信息。来自平台的信息将在相关账号解除连接或您要求删除时予以删除，法律要求保留的除外。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "9. 信息安全"
     ]
    },
    {
     "t": "p",
     "parts": [
      "我们通过访问控制、访问密钥加密和加密连接来保护信息。任何系统都无法做到绝对安全，但我们会尽力保护您的信息。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "10. 您的权利"
     ]
    },
    {
     "t": "p",
     "parts": [
      "根据您所在地的法律，您可能有权访问、更正或删除您的个人信息，反对或限制对其的使用，以及撤回同意。如需提出请求，请发送邮件至 info@koleexgroup.com，我们将在30天内答复。如需删除我们通过社交媒体平台获取的信息，请按照我们的《数据删除说明》操作。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "11. 儿童"
     ]
    },
    {
     "t": "p",
     "parts": [
      "我们的网站和服务面向企业，不针对16岁以下儿童，我们不会故意收集其信息。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "12. 政策更新"
     ]
    },
    {
     "t": "p",
     "parts": [
      "我们可能会更新本政策，页首的生效日期表示最近一次更新的时间。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "13. 联系我们"
     ]
    },
    {
     "t": "p",
     "parts": [
      "科莱恪斯国际商业管理（台州）有限公司",
      {
       "br": true
      },
      "浙江省台州市椒江区下陈街道泾水岸社区飞跃科创园西区88幢206室",
      {
       "br": true
      },
      "电子邮箱：info@koleexgroup.com · 电话：+86 576 8892 7796"
     ]
    }
   ]
  }
 },
 "terms": {
  "en": {
   "title": "Terms of Service",
   "updated": "Effective date: 27 September 2026",
   "blocks": [
    {
     "t": "h2",
     "parts": [
      "1. About these terms"
     ]
    },
    {
     "t": "p",
     "parts": [
      `These Terms of Service govern your use of www.koleexgroup.com and the online services of ${LEGAL_EN} (trading as ${EVERYDAY_NAME_EN}, “Koleex”, “we”, “us”). By using the website you accept these terms. If you do not accept them, please do not use the website.`
     ]
    },
    {
     "t": "h2",
     "parts": [
      "2. Using the website"
     ]
    },
    {
     "t": "p",
     "parts": [
      "You may use the website to learn about Koleex and our products and to contact us. You agree not to:"
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       "use the website for any unlawful purpose;"
      ],
      [
       "try to gain unauthorised access to our systems or interfere with the website;"
      ],
      [
       "copy, collect or scrape content or data from the website by automated means without our written permission;"
      ],
      [
       "send false information or impersonate anyone."
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "3. Product information and orders"
     ]
    },
    {
     "t": "p",
     "parts": [
      "Product descriptions, images and specifications on the website are for general information and may change without notice. Nothing on the website is a binding offer. Prices, specifications and delivery terms are agreed only in a written quotation, invoice or contract, and those documents govern any sale."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "4. Intellectual property"
     ]
    },
    {
     "t": "p",
     "parts": [
      "The KOLEEX name and logo, and all content on the website (text, images, designs and product information), belong to Koleex or its licensors. You may not use them without our prior written permission."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "5. Information you send us"
     ]
    },
    {
     "t": "p",
     "parts": [
      "You agree that the information you send us is accurate and that we may use it to respond to you, as described in our Privacy Policy."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "6. Our social media and messaging accounts"
     ]
    },
    {
     "t": "p",
     "parts": [
      "Your interactions with Koleex’s official accounts on social media and messaging platforms are also governed by each platform’s own terms and policies. We may remove comments that are unlawful, abusive, misleading or spam."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "7. Links to other websites"
     ]
    },
    {
     "t": "p",
     "parts": [
      "The website may link to other websites. We are not responsible for their content or privacy practices."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "8. Disclaimer"
     ]
    },
    {
     "t": "p",
     "parts": [
      "The website is provided “as is”. To the fullest extent allowed by law, we make no warranty that it will be uninterrupted or error-free."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "9. Limitation of liability"
     ]
    },
    {
     "t": "p",
     "parts": [
      "To the fullest extent allowed by law, Koleex is not liable for any indirect or consequential loss arising from your use of the website. Nothing in these terms limits liability that cannot be limited by law."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "10. Changes"
     ]
    },
    {
     "t": "p",
     "parts": [
      "We may update these terms. The effective date at the top shows when they last changed. If you keep using the website, you accept the updated terms."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "11. Governing law"
     ]
    },
    {
     "t": "p",
     "parts": [
      "These terms are governed by the laws of the People’s Republic of China, and disputes are subject to the courts with jurisdiction where Koleex is registered, unless the law of your country requires otherwise."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "12. Contact"
     ]
    },
    {
     "t": "p",
     "parts": [
      "info@koleexgroup.com · www.koleexgroup.com"
     ]
    }
   ]
  },
  "ar": {
   "title": "شروط الخدمة",
   "updated": "تاريخ السريان: 27 سبتمبر 2026",
   "blocks": [
    {
     "t": "h2",
     "parts": [
      "1. حول هذه الشروط"
     ]
    },
    {
     "t": "p",
     "parts": [
      "تنظّم شروط الخدمة هذه استخدامك لموقع ",
      {
       "ltr": "www.koleexgroup.com"
      },
      " والخدمات الإلكترونية لشركة ",
      {
       "ltr": LEGAL_EN
      },
      " (وتعمل تحت اسم كولكس إنترناشونال جروب، ويُشار إليها فيما يلي بـ«كولكس» أو «نحن»). وباستخدامك للموقع فإنك توافق على هذه الشروط، وإذا لم توافق عليها فيُرجى عدم استخدام الموقع."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "2. استخدام الموقع"
     ]
    },
    {
     "t": "p",
     "parts": [
      "يمكنك استخدام الموقع للتعرف على كولكس ومنتجاتنا والتواصل معنا. وتوافق على ألا:"
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       "تستخدم الموقع لأي غرض غير مشروع؛"
      ],
      [
       "تحاول الوصول غير المصرح به إلى أنظمتنا أو تعطيل عمل الموقع؛"
      ],
      [
       "تنسخ محتوى الموقع أو بياناته أو تجمعها أو تستخرجها بوسائل آلية دون إذن كتابي منا؛"
      ],
      [
       "ترسل معلومات غير صحيحة أو تنتحل صفة أي شخص."
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "3. معلومات المنتجات والطلبات"
     ]
    },
    {
     "t": "p",
     "parts": [
      "أوصاف المنتجات وصورها ومواصفاتها على الموقع للمعلومية العامة، وقد تتغير دون إشعار. ولا يُعد أي محتوى على الموقع عرضًا ملزمًا. وتُحدَّد الأسعار والمواصفات وشروط التسليم فقط في عرض سعر أو فاتورة أو عقد مكتوب، وتسري تلك المستندات على أي عملية بيع."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "4. الملكية الفكرية"
     ]
    },
    {
     "t": "p",
     "parts": [
      "اسم KOLEEX وشعارها وجميع محتويات الموقع (النصوص والصور والتصاميم ومعلومات المنتجات) مملوكة لكولكس أو للجهات المرخِّصة لها، ولا يجوز استخدامها دون إذن كتابي مسبق منا."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "5. المعلومات التي ترسلها إلينا"
     ]
    },
    {
     "t": "p",
     "parts": [
      "تقر بأن المعلومات التي ترسلها إلينا صحيحة، وتوافق على أن نستخدمها للرد عليك وفقًا لسياسة الخصوصية."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "6. حساباتنا على منصات التواصل والمراسلة"
     ]
    },
    {
     "t": "p",
     "parts": [
      "يخضع تفاعلك مع حسابات كولكس الرسمية على منصات التواصل الاجتماعي والمراسلة أيضًا لشروط وسياسات كل منصة. ويحق لنا حذف التعليقات غير القانونية أو المسيئة أو المضللة أو المزعجة."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "7. روابط المواقع الأخرى"
     ]
    },
    {
     "t": "p",
     "parts": [
      "قد يحتوي الموقع على روابط لمواقع أخرى، ولسنا مسؤولين عن محتواها أو ممارساتها في الخصوصية."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "8. إخلاء المسؤولية"
     ]
    },
    {
     "t": "p",
     "parts": [
      "يُقدَّم الموقع «كما هو». وإلى الحد الأقصى الذي يسمح به القانون، لا نضمن أن يعمل الموقع دون انقطاع أو أخطاء."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "9. حدود المسؤولية"
     ]
    },
    {
     "t": "p",
     "parts": [
      "إلى الحد الأقصى الذي يسمح به القانون، لا تتحمل كولكس المسؤولية عن أي خسارة غير مباشرة أو تبعية تنشأ عن استخدامك للموقع. ولا يحد أي بند في هذه الشروط من المسؤولية التي لا يجوز تحديدها قانونًا."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "10. التعديلات"
     ]
    },
    {
     "t": "p",
     "parts": [
      "قد نحدّث هذه الشروط، ويوضح تاريخ السريان في أعلاها موعد آخر تعديل. واستمرارك في استخدام الموقع يعني قبولك للشروط المحدّثة."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "11. القانون الواجب التطبيق"
     ]
    },
    {
     "t": "p",
     "parts": [
      "تخضع هذه الشروط لقوانين جمهورية الصين الشعبية، وتختص بالنزاعات المحاكمُ المختصة في مكان تسجيل كولكس، ما لم يفرض قانون بلدك خلاف ذلك."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "12. التواصل"
     ]
    },
    {
     "t": "p",
     "parts": [
      {
       "ltr": "info@koleexgroup.com · www.koleexgroup.com"
      }
     ]
    }
   ]
  },
  "zh": {
   "title": "服务条款",
   "updated": "生效日期：2026年9月27日",
   "blocks": [
    {
     "t": "h2",
     "parts": [
      "1. 关于本条款"
     ]
    },
    {
     "t": "p",
     "parts": [
      `本服务条款适用于您对 www.koleexgroup.com 及科莱恪斯国际商业管理（台州）有限公司（以 ${EVERYDAY_NAME_EN} 名义开展业务，以下简称“Koleex”或“我们”）在线服务的使用。使用本网站即表示您接受本条款；如您不接受，请勿使用本网站。`
     ]
    },
    {
     "t": "h2",
     "parts": [
      "2. 网站的使用"
     ]
    },
    {
     "t": "p",
     "parts": [
      "您可以使用本网站了解 Koleex 及我们的产品并与我们联系。您同意不会："
     ]
    },
    {
     "t": "ul",
     "items": [
      [
       "将本网站用于任何违法目的；"
      ],
      [
       "试图未经授权访问我们的系统或干扰网站运行；"
      ],
      [
       "未经我们书面许可，以自动化方式复制、收集或抓取网站内容或数据；"
      ],
      [
       "提交虚假信息或冒充他人。"
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "3. 产品信息与订单"
     ]
    },
    {
     "t": "p",
     "parts": [
      "网站上的产品描述、图片和规格仅供一般参考，可能随时变更，恕不另行通知。网站上的任何内容均不构成具有约束力的要约。价格、规格和交货条款仅以书面报价单、发票或合同约定为准，任何销售均受该等文件约束。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "4. 知识产权"
     ]
    },
    {
     "t": "p",
     "parts": [
      "KOLEEX 名称和标志以及网站上的所有内容（文字、图片、设计和产品信息）均归 Koleex 或其许可方所有。未经我们事先书面许可，您不得使用。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "5. 您提交的信息"
     ]
    },
    {
     "t": "p",
     "parts": [
      "您保证向我们提交的信息真实准确，并同意我们按照《隐私政策》的说明使用这些信息与您联系。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "6. 我们的社交媒体和通讯账号"
     ]
    },
    {
     "t": "p",
     "parts": [
      "您与 Koleex 在社交媒体和通讯平台上官方账号的互动，同时受各平台自身条款和政策的约束。我们可能删除违法、辱骂、误导或垃圾性质的评论。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "7. 第三方链接"
     ]
    },
    {
     "t": "p",
     "parts": [
      "本网站可能包含指向其他网站的链接。我们不对其内容或隐私做法负责。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "8. 免责声明"
     ]
    },
    {
     "t": "p",
     "parts": [
      "本网站按“现状”提供。在法律允许的最大范围内，我们不保证网站不会中断或没有错误。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "9. 责任限制"
     ]
    },
    {
     "t": "p",
     "parts": [
      "在法律允许的最大范围内，Koleex 不对因您使用本网站而产生的任何间接或后果性损失承担责任。本条款不限制依法不得限制的责任。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "10. 条款变更"
     ]
    },
    {
     "t": "p",
     "parts": [
      "我们可能更新本条款，页首的生效日期表示最近一次更新的时间。您继续使用本网站即表示接受更新后的条款。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "11. 适用法律"
     ]
    },
    {
     "t": "p",
     "parts": [
      "本条款受中华人民共和国法律管辖，争议由 Koleex 注册地有管辖权的法院管辖，但您所在国家/地区的法律另有强制规定的除外。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "12. 联系我们"
     ]
    },
    {
     "t": "p",
     "parts": [
      "info@koleexgroup.com · www.koleexgroup.com"
     ]
    }
   ]
  }
 },
 "deletion": {
  "en": {
   "title": "Data Deletion Instructions",
   "updated": "Effective date: 27 September 2026",
   "blocks": [
    {
     "t": "p",
     "parts": [
      `Koleex (${LEGAL_EN}) uses the platforms’ official interfaces to manage Koleex’s own accounts on Facebook, Instagram, WhatsApp, LinkedIn, YouTube, TikTok, X and WeChat. When you interact with these accounts, we may receive and keep your public name or username, your profile picture, and the comments or messages you send to us.`
     ]
    },
    {
     "t": "h2",
     "parts": [
      "How to ask us to delete your data"
     ]
    },
    {
     "t": "ol",
     "items": [
      [
       "Email info@koleexgroup.com with the subject “Data deletion request”. You can also send us a message on the platform where you interacted with us."
      ],
      [
       "Tell us the platform and your name or username there. A link to your profile, or to the comment or message, helps us find it."
      ],
      [
       "We may ask you to confirm that the account is yours."
      ],
      [
       "We delete the data within 30 days and confirm by email or message. If the law requires us to keep something (for example, records of a purchase), we tell you what we keep and why."
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "Deleting a comment or message yourself"
     ]
    },
    {
     "t": "p",
     "parts": [
      "Deleting a comment or message on the platform removes it there. If you also want our copy deleted, ask us as described above."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "For administrators who connected an account"
     ]
    },
    {
     "t": "p",
     "parts": [
      "To disconnect Koleex’s tools from a Facebook Page or Instagram account, remove the app in Meta Business Settings (Business Integrations). For Google or YouTube, remove access at ",
      {
       "a": "https://myaccount.google.com/permissions",
       "text": "https://myaccount.google.com/permissions"
      },
      ". For LinkedIn, TikTok and X, remove the app in the account’s settings under connected or authorised apps. When an account is disconnected, we delete the access keys we stored for it."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "Questions"
     ]
    },
    {
     "t": "p",
     "parts": [
      "info@koleexgroup.com"
     ]
    }
   ]
  },
  "ar": {
   "title": "تعليمات حذف البيانات",
   "updated": "تاريخ السريان: 27 سبتمبر 2026",
   "blocks": [
    {
     "t": "p",
     "parts": [
      "تستخدم كولكس (",
      {
       "ltr": LEGAL_EN
      },
      ") الواجهات الرسمية للمنصات لإدارة حساباتها على Facebook وInstagram وWhatsApp وLinkedIn وYouTube وTikTok وX وWeChat. وعندما تتفاعل مع هذه الحسابات، قد نتلقى ونحتفظ باسمك العام أو اسم المستخدم، وصورة ملفك الشخصي، والتعليقات أو الرسائل التي ترسلها إلينا."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "كيف تطلب حذف بياناتك"
     ]
    },
    {
     "t": "ol",
     "items": [
      [
       "راسلنا على ",
       {
        "ltr": "info@koleexgroup.com"
       },
       " بعنوان «طلب حذف بيانات». ويمكنك أيضًا مراسلتنا على المنصة التي تفاعلت معنا من خلالها."
      ],
      [
       "أخبرنا باسم المنصة واسمك أو اسم المستخدم عليها. ويساعدنا رابط ملفك الشخصي، أو رابط التعليق أو الرسالة، في العثور عليها."
      ],
      [
       "قد نطلب منك تأكيد ملكيتك للحساب."
      ],
      [
       "نحذف البيانات خلال 30 يومًا ونؤكد ذلك بالبريد الإلكتروني أو برسالة. وإذا ألزمنا القانون بالاحتفاظ بشيء (مثل سجلات الشراء)، نخبرك بما نحتفظ به وسبب ذلك."
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "حذف التعليق أو الرسالة بنفسك"
     ]
    },
    {
     "t": "p",
     "parts": [
      "حذف التعليق أو الرسالة على المنصة يزيله منها. وإذا أردت حذف نسختنا أيضًا، فاطلب ذلك كما هو موضح أعلاه."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "للمسؤولين الذين ربطوا حسابًا"
     ]
    },
    {
     "t": "p",
     "parts": [
      "لفصل أدوات كولكس عن صفحة Facebook أو حساب Instagram، احذف التطبيق من إعدادات Meta للأعمال (Business Integrations). ولحسابات Google أو YouTube، ألغِ الوصول من ",
      {
       "a": "https://myaccount.google.com/permissions",
       "text": "https://myaccount.google.com/permissions"
      },
      ". ولحسابات LinkedIn وTikTok وX، احذف التطبيق من إعدادات الحساب ضمن التطبيقات المتصلة أو المصرح بها. وعند فصل الحساب نحذف مفاتيح الوصول التي خزّناها له."
     ]
    },
    {
     "t": "h2",
     "parts": [
      "للاستفسارات"
     ]
    },
    {
     "t": "p",
     "parts": [
      {
       "ltr": "info@koleexgroup.com"
      }
     ]
    }
   ]
  },
  "zh": {
   "title": "数据删除说明",
   "updated": "生效日期：2026年9月27日",
   "blocks": [
    {
     "t": "p",
     "parts": [
      "科莱恪斯国际商业管理（台州）有限公司（Koleex）通过各平台的官方接口管理 Koleex 在 Facebook、Instagram、WhatsApp、LinkedIn、YouTube、TikTok、X 和微信上的自有账号。当您与这些账号互动时，我们可能会获取并保存您的公开名称或用户名、头像，以及您发送给我们的评论或消息。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "如何要求我们删除您的数据"
     ]
    },
    {
     "t": "ol",
     "items": [
      [
       "发送邮件至 info@koleexgroup.com，邮件主题注明“数据删除请求”。您也可以在与我们互动的平台上给我们发送消息。"
      ],
      [
       "告知我们相关平台以及您在该平台上的名称或用户名。附上您的主页链接，或相关评论、消息的链接，有助于我们查找。"
      ],
      [
       "我们可能会请您确认该账号属于您本人。"
      ],
      [
       "我们将在30天内删除数据，并通过邮件或消息确认。如依法必须保留某些信息（例如购买记录），我们会告知您保留的内容及原因。"
      ]
     ]
    },
    {
     "t": "h2",
     "parts": [
      "自行删除评论或消息"
     ]
    },
    {
     "t": "p",
     "parts": [
      "在平台上删除评论或消息后，该内容将从平台上移除。如您也希望删除我们保存的副本，请按上述方式联系我们。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "针对连接账号的管理员"
     ]
    },
    {
     "t": "p",
     "parts": [
      "如需断开 Koleex 工具与 Facebook 主页或 Instagram 账号的连接，请在 Meta 商务管理平台设置（业务集成）中移除该应用。对于 Google 或 YouTube，请在 ",
      {
       "a": "https://myaccount.google.com/permissions",
       "text": "https://myaccount.google.com/permissions"
      },
      " 移除访问权限。对于 LinkedIn、TikTok 和 X，请在账号设置的“已连接/已授权应用”中移除该应用。账号断开连接后，我们将删除为其保存的访问密钥。"
     ]
    },
    {
     "t": "h2",
     "parts": [
      "如有疑问"
     ]
    },
    {
     "t": "p",
     "parts": [
      "info@koleexgroup.com"
     ]
    }
   ]
  }
 }
};
