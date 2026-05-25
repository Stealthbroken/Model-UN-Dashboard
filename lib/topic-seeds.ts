/**
 * Curated MUN topic bank — the offline half of the hybrid suggester.
 *
 * Used in two ways:
 *   1. As a baseline pool so the "Suggest topics" button works even when
 *      OpenAI isn't configured.
 *   2. Mixed with AI suggestions so every batch has a couple of vetted picks
 *      alongside the fresh ones.
 *
 * Keep titles concise (max ~110 chars) so they fit on a card. Descriptions
 * should be a single sentence framing the debate.
 */

export interface SeedTopic {
  title: string;
  description: string;
  category: string;
  difficulty: "intro" | "standard" | "advanced";
}

export const TOPIC_CATEGORIES = [
  "Geopolitics",
  "Human Rights",
  "Climate",
  "Economics",
  "Security",
  "Health",
  "Technology",
  "Migration",
  "Disarmament",
  "Development",
  "Gender",
  "Culture",
] as const;

export const TOPIC_DIFFICULTIES = ["intro", "standard", "advanced"] as const;

export const TOPIC_SEEDS: SeedTopic[] = [
  // Geopolitics ─────────────────────────────────────────────────────────────
  { title: "The role of the UN Security Council in 21st-century conflicts",     description: "Should P5 veto power be reformed given gridlock on Ukraine, Gaza, and Sudan?",                category: "Geopolitics", difficulty: "advanced" },
  { title: "Recognition of unrecognized states",                                description: "How should the international community handle Kosovo, Taiwan, Palestine, and Somaliland?",      category: "Geopolitics", difficulty: "advanced" },
  { title: "Arctic sovereignty and resource competition",                       description: "As ice melts, who governs the Northwest Passage and the seabed beneath it?",                   category: "Geopolitics", difficulty: "standard" },
  { title: "The future of NATO expansion",                                      description: "Where should the line be drawn — and what are the consequences either way?",                   category: "Geopolitics", difficulty: "standard" },
  { title: "Great power competition in the Indo-Pacific",                      description: "Balancing freedom of navigation, the Quad, and Belt & Road influence.",                        category: "Geopolitics", difficulty: "advanced" },
  { title: "The principle of self-determination vs. territorial integrity",     description: "When does a people get to redraw borders, and who decides?",                                    category: "Geopolitics", difficulty: "advanced" },

  // Human Rights ────────────────────────────────────────────────────────────
  { title: "Freedom of the press in authoritarian states",                     description: "How can the UN protect journalists when host governments are the threat?",                     category: "Human Rights", difficulty: "standard" },
  { title: "Mass detention of ethnic minorities",                              description: "Crafting a binding response to Uyghur, Rohingya, and similar crises.",                          category: "Human Rights", difficulty: "advanced" },
  { title: "The right to protest in the digital age",                          description: "Internet shutdowns, surveillance, and the criminalization of dissent.",                         category: "Human Rights", difficulty: "standard" },
  { title: "Children in armed conflict",                                       description: "Strengthening enforcement against recruitment of child soldiers.",                              category: "Human Rights", difficulty: "intro" },
  { title: "LGBTQ+ rights as universal human rights",                          description: "Navigating cultural relativism arguments at the UN Human Rights Council.",                      category: "Human Rights", difficulty: "standard" },
  { title: "Access to justice for victims of war crimes",                      description: "The ICC's reach, state cooperation, and the universal jurisdiction debate.",                    category: "Human Rights", difficulty: "advanced" },
  { title: "Indigenous land rights and resource extraction",                   description: "Free, prior, and informed consent under UNDRIP — in theory and practice.",                       category: "Human Rights", difficulty: "standard" },

  // Climate ─────────────────────────────────────────────────────────────────
  { title: "Climate financing for the Global South",                           description: "Operationalizing the Loss and Damage Fund — who pays, who decides?",                            category: "Climate",     difficulty: "standard" },
  { title: "Climate refugees and a new legal status",                          description: "Should the 1951 Refugee Convention be expanded to include climate displacement?",                category: "Climate",     difficulty: "advanced" },
  { title: "Geoengineering governance",                                        description: "Setting international rules for solar radiation management and ocean fertilization.",            category: "Climate",     difficulty: "advanced" },
  { title: "Protecting the high seas",                                         description: "Implementation of the BBNJ Treaty and marine protected areas.",                                  category: "Climate",     difficulty: "standard" },
  { title: "Phasing out fossil fuel subsidies",                                description: "Reconciling COP commitments with $7 trillion in annual subsidies.",                              category: "Climate",     difficulty: "standard" },
  { title: "Indigenous knowledge in climate adaptation",                       description: "How to elevate traditional ecological knowledge in formal policy.",                              category: "Climate",     difficulty: "intro" },

  // Economics ───────────────────────────────────────────────────────────────
  { title: "Sovereign debt restructuring",                                     description: "A common framework for distressed economies — Zambia, Sri Lanka, Ghana.",                        category: "Economics",   difficulty: "advanced" },
  { title: "Global minimum corporate tax — round two",                         description: "Beyond Pillar Two: closing loopholes and bringing in developing economies.",                     category: "Economics",   difficulty: "advanced" },
  { title: "Critical mineral supply chains",                                   description: "Securing lithium, cobalt, and rare earths without entrenching new dependencies.",                category: "Economics",   difficulty: "standard" },
  { title: "Reforming the international financial architecture",               description: "IMF/World Bank quota reform and the Bridgetown Initiative.",                                    category: "Economics",   difficulty: "advanced" },
  { title: "Universal basic income at the international level",                description: "From pilots to policy — what role for multilateral funding?",                                    category: "Economics",   difficulty: "standard" },
  { title: "The future of cash transfers in humanitarian aid",                 description: "Moving from in-kind to digital cash — and the privacy stakes.",                                  category: "Economics",   difficulty: "intro" },

  // Security ────────────────────────────────────────────────────────────────
  { title: "Lethal autonomous weapons systems",                                description: "Should there be a binding treaty banning fully autonomous killer robots?",                       category: "Security",    difficulty: "standard" },
  { title: "Private military companies and accountability",                    description: "Regulating Wagner-style groups operating across multiple jurisdictions.",                        category: "Security",    difficulty: "advanced" },
  { title: "Maritime piracy in the Gulf of Guinea",                            description: "Building regional capacity to protect critical shipping lanes.",                                 category: "Security",    difficulty: "intro" },
  { title: "Counter-terrorism without eroding civil liberties",                description: "The drift from emergency measures to permanent surveillance regimes.",                           category: "Security",    difficulty: "standard" },
  { title: "Outer space as a contested domain",                                description: "Anti-satellite weapons, debris, and the limits of the Outer Space Treaty.",                      category: "Security",    difficulty: "advanced" },
  { title: "Peacekeeping in the age of drone warfare",                         description: "Mandate adaptation when belligerents have cheap aerial strike capability.",                      category: "Security",    difficulty: "standard" },

  // Health ──────────────────────────────────────────────────────────────────
  { title: "The Pandemic Treaty after the WHA stalemate",                      description: "What's salvageable, and what does equitable access actually look like?",                         category: "Health",      difficulty: "advanced" },
  { title: "Antimicrobial resistance as a global threat",                      description: "Coordinated stewardship when 40+ countries lack basic surveillance.",                            category: "Health",      difficulty: "standard" },
  { title: "Mental health in humanitarian emergencies",                        description: "Embedding MHPSS into refugee response and disaster relief.",                                     category: "Health",      difficulty: "intro" },
  { title: "Access to essential medicines",                                    description: "TRIPS flexibilities, compulsory licensing, and the next insulin debate.",                        category: "Health",      difficulty: "standard" },
  { title: "Maternal mortality in conflict zones",                             description: "Protecting health workers and infrastructure under IHL.",                                        category: "Health",      difficulty: "standard" },

  // Technology ──────────────────────────────────────────────────────────────
  { title: "Global governance of AI",                                          description: "From advisory bodies to enforceable rules — modeled on IAEA or IPCC?",                            category: "Technology",  difficulty: "advanced" },
  { title: "The right to encryption",                                          description: "Backdoor mandates vs. journalistic and activist safety.",                                        category: "Technology",  difficulty: "standard" },
  { title: "Closing the digital divide",                                       description: "Connectivity targets for the next decade — who funds the last mile?",                            category: "Technology",  difficulty: "intro" },
  { title: "Deepfakes and election integrity",                                 description: "International norms for synthetic media during electoral periods.",                               category: "Technology",  difficulty: "standard" },
  { title: "Submarine cable security",                                         description: "Protecting the physical backbone of the internet from sabotage.",                                category: "Technology",  difficulty: "standard" },
  { title: "Cross-border data flows",                                          description: "Reconciling GDPR, US frameworks, and data localization mandates.",                               category: "Technology",  difficulty: "advanced" },

  // Migration ───────────────────────────────────────────────────────────────
  { title: "Safe and regular migration pathways",                              description: "Operationalizing the Global Compact when politics keeps tightening borders.",                    category: "Migration",   difficulty: "standard" },
  { title: "Statelessness and the right to a nationality",                     description: "Practical steps for the 4.4 million people without any nationality.",                           category: "Migration",   difficulty: "intro" },
  { title: "Returns and readmission agreements",                               description: "Balancing sovereignty, dignity, and non-refoulement obligations.",                                category: "Migration",   difficulty: "standard" },
  { title: "Internal displacement at record highs",                            description: "Strengthening the Kampala Convention model beyond Africa.",                                     category: "Migration",   difficulty: "standard" },

  // Disarmament ─────────────────────────────────────────────────────────────
  { title: "Nuclear modernization vs. NPT obligations",                        description: "Article VI's good-faith pledge when every nuclear state is upgrading arsenals.",                 category: "Disarmament", difficulty: "advanced" },
  { title: "The Treaty on the Prohibition of Nuclear Weapons",                 description: "Bridging the gap between TPNW signatories and nuclear-weapon states.",                           category: "Disarmament", difficulty: "advanced" },
  { title: "Small arms and the illicit trade",                                 description: "The Programme of Action two decades in — what's working?",                                       category: "Disarmament", difficulty: "intro" },
  { title: "Chemical weapons attribution",                                     description: "Strengthening OPCW's investigative mandate after Syria and Russia.",                              category: "Disarmament", difficulty: "standard" },

  // Development ─────────────────────────────────────────────────────────────
  { title: "Halfway to the SDGs — and behind on most",                         description: "Re-prioritizing the agenda when only ~15% of targets are on track.",                             category: "Development", difficulty: "standard" },
  { title: "Education access for girls in fragile states",                     description: "Beyond declarations: actual schools, safe routes, sustained funding.",                            category: "Development", difficulty: "intro" },
  { title: "Food security and the weaponization of grain",                     description: "Black Sea dynamics, fertilizer markets, and famine early warning.",                              category: "Development", difficulty: "standard" },
  { title: "Water as a transboundary resource",                                description: "Cooperation frameworks for the Nile, Mekong, and Indus basins.",                                 category: "Development", difficulty: "standard" },

  // Gender ──────────────────────────────────────────────────────────────────
  { title: "Women, peace, and security — UNSCR 1325 at 25",                    description: "From rhetoric to actual representation in peace processes.",                                     category: "Gender",      difficulty: "standard" },
  { title: "Conflict-related sexual violence",                                 description: "Holding perpetrators accountable when state institutions collapse.",                              category: "Gender",      difficulty: "advanced" },
  { title: "The global pushback on reproductive rights",                       description: "International responses to the contraction of access in multiple regions.",                      category: "Gender",      difficulty: "standard" },
  { title: "Closing the gender pay gap",                                       description: "Mandatory pay transparency — what scale of intervention actually moves numbers?",                 category: "Gender",      difficulty: "intro" },

  // Culture ─────────────────────────────────────────────────────────────────
  { title: "Repatriation of cultural artifacts",                               description: "The Benin Bronzes, the Parthenon Marbles, and a workable framework.",                            category: "Culture",     difficulty: "standard" },
  { title: "Protecting heritage in armed conflict",                            description: "Strengthening the 1954 Hague Convention's enforcement mechanisms.",                              category: "Culture",     difficulty: "standard" },
  { title: "Endangered languages and digital preservation",                    description: "UNESCO's role when half the world's languages may vanish this century.",                          category: "Culture",     difficulty: "intro" },
  { title: "Sports governance and human rights",                               description: "Awarding mega-events to states with rights concerns — FIFA, IOC obligations.",                    category: "Culture",     difficulty: "intro" },
];
