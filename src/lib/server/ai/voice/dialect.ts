import "server-only";

/* ---------------------------------------------------------------------------
   ai/voice/dialect — making a SPOKEN reply actually Egyptian.

   THE OWNER'S REPORT: the Arabic in a call "looks a little mixed with Arabic
   and Khaleji" — Egyptian underneath, drifting into MSA and Gulf. He was
   describing something real, and the cause was not subtle: the voice session
   carried NO dialect instruction of any kind. Every Arabic sentence a call
   produced was whatever the model does by default, which leans MSA and
   borrows freely from whichever dialect the phrasing suggests.

   WHY THE WRITTEN RULE COULD NOT SIMPLY BE IMPORTED. EGYPTIAN_DIALECT_RULE
   exists in brand-knowledge.ts and the written lanes use it, but it is two
   wrong things for this channel. It is CONDITIONAL — injected only when a
   language detector flags the incoming message — and a voice session is
   configured before anyone has spoken, so there is nothing to detect. And it
   is written for a PAGE: "keep the same clean structure (headings, numbered
   stages, bullets, tables)" is advice for a document, and everything here is
   heard rather than read. Importing it would have carried instructions about
   tables into a phone call.

   WHY A WORD LIST IS NOT ENOUGH, which is the part worth understanding. The
   written rule offers vocabulary — "إزيك، تمام، دلوقتي، عايز". Give a model
   only that and it writes MSA sentences with Egyptian words dropped in, which
   is precisely the "mixed" the owner heard. Egyptian is not MSA plus
   vocabulary; it differs in the STRUCTURE of the sentence: how it negates
   (مش / ما...ش), how it marks the future (هـ), how it marks the present (بـ),
   where it puts a demonstrative (الراجل ده, not هذا الرجل), which relative
   pronoun it uses (اللي). Fix the structure and the register follows. Fix the
   vocabulary alone and it does not.

   AND THE PART THAT IS TRUE ONLY OF VOICE — the one that matters most here.
   A text-to-speech voice pronounces WHAT IT IS GIVEN. Write "ثلاثة" and it
   says *thalatha*; write "تلاتة" and it says *talata*. Write "هذا" and it
   says *haadha*; write "ده" and it says *da*. So the model's SPELLING is the
   accent — the single largest lever available to us, and one that has no
   equivalent in the chat box, where "ثلاثة" and "تلاتة" look equally fine on
   the screen. Case endings are the same story: MSA's إعراب read aloud is what
   makes a voice sound like a news broadcast rather than a colleague.

   NEVER BLENDING IS THE ACTUAL RULE. Mirroring a caller's own dialect is the
   product's established behaviour and is not changed here. What is forbidden
   is the mixture — Egyptian grammar with Gulf question words is not a dialect
   anyone speaks, and it is what makes an assistant sound synthetic.
   --------------------------------------------------------------------------- */

/**
 * The spoken-Egyptian rule.
 *
 * COSTED DELIBERATELY. This travels in the one payload with a hard size
 * limit, so every line has to earn its bytes: what is here is the structural
 * contrasts (which change whole sentences), the Gulf markers that were
 * actually bleeding in, and the spelling-is-pronunciation rule that only
 * exists on this channel. General politeness advice is not here — the
 * instructions already carry it.
 */
export const EGYPTIAN_VOICE_RULE =
  "SPEAKING ARABIC. Koleex is an Egyptian-run company and Egyptian Arabic (عامية مصرية) is your" +
  " default Arabic — natural, the way a sharp Egyptian colleague talks, never MSA/فصحى. If a caller" +
  " clearly speaks another Arabic dialect or formal MSA, mirror THEM instead — but then stay wholly in" +
  " that one. NEVER blend two: Egyptian grammar with Gulf words is not a dialect anyone speaks, and it is" +
  " the single thing that makes you sound artificial." +
  /* Structure first: these change the shape of the sentence, not a word in it. */
  " EGYPTIAN IS GRAMMAR, NOT VOCABULARY SPRINKLED ON MSA. Negate with مش and ما...ش (مش عارف، مبيشتغلش،" +
  " مفيش) — never لا/ليس/لا يوجد. Future is هـ (هبعتلك، هشوف) — never سوف/سـ. Ongoing action takes بـ" +
  " (بيشتغل، بتقول، بنعمل). The demonstrative comes AFTER the noun: الماكينة دي، الراجل ده — never هذه" +
  " الماكينة. The relative pronoun is اللي — never الذي/التي/الذين." +
  " Question words: إيه، فين، إمتى، إزاي، ليه، مين — never ماذا/أين/متى/كيف/لماذا/مَن." +
  " Everyday words: عايز not أريد، دلوقتي not الآن، كده not هكذا، كمان not أيضًا، بس not لكن/فقط،" +
  " أوي not جدًا، حاجة not شيء، كويس not جيد، كتير not كثير، شوية not قليل، عشان/علشان not من أجل/لكي،" +
  " تمام/ماشي not حسنًا، أكيد/طبعًا not بالطبع، ممكن not ربما، بتاع/بتاعت for possession." +
  /* The contamination the owner actually named. */
  " NEVER use Gulf/Levantine words — this is what he is hearing and it must stop: شنو، وش، وين، الحين،" +
  " هالحين، أبغى، أبي، شلون، ليش، زين، مو، كذا، ماكو، هسه، چان. The Egyptian is إيه، فين، دلوقتي، عايز،" +
  " إزاي، ليه، كويس، مش، كده." +
  /* The lever that exists only because this is spoken. */
  " YOUR SPELLING IS YOUR ACCENT — this is a CALL, and you are read aloud exactly as written. تلاتة is" +
  " pronounced Egyptian, ثلاثة is not; write تلاتة، تلاتين، اتنين، تمانية، دي، ده، كده، بعدين. Use NO" +
  " tashkeel and NO case endings (إعراب) — read aloud they turn you into a news broadcast." +
  " Say numbers the Egyptian way: 23 is تلاتة وعشرين, 150 is مية وخمسين." +
  /* Guarding the rules this one sits next to. */
  " Model codes, units and brand names stay exactly as they are (Koleex, XF-A10, mm, rpm) — only the" +
  " Arabic around them is Egyptian. And Egyptian is a register, not a licence to narrate: the rule" +
  " against saying you searched or looked something up holds in every dialect.";

/**
 * One sentence, for the session that had to be shortened.
 *
 * The compact payload exists because the full one did not fit, so almost
 * nothing may be added to it. This is here anyway because a call that falls
 * back and then speaks MSA is the exact complaint this work answers, and one
 * sentence is the smallest thing that changes the outcome: default, plus the
 * spelling rule, which is what the voice actually pronounces.
 */
export const EGYPTIAN_VOICE_BRIEF =
  " If the caller speaks Arabic, reply in natural Egyptian (عامية مصرية), never MSA: مش/ما...ش, هـ for" +
  " future, بـ for ongoing, اللي, إيه/فين/إمتى/إزاي/ليه/مين, عايز, دلوقتي, كده. No Gulf words. You are read" +
  " aloud as written, so spell it Egyptian (تلاتة، ده، دي) and use no case endings.";
