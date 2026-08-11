// Daily verse + family-devotion prompt for the Faith view. Verse text is the
// World English Bible (WEB) — public domain — so it can ship in the bundle.
// The pick is deterministic by day-of-year, so the whole family sees the same
// verse/prompt each day and it rotates gently through the year.

export type Verse = { ref: string; text: string };

export const VERSES: Verse[] = [
  { ref: "Psalm 23:1", text: "Yahweh is my shepherd; I shall lack nothing." },
  { ref: "Proverbs 3:5–6", text: "Trust in Yahweh with all your heart, and don't lean on your own understanding. In all your ways acknowledge him, and he will make your paths straight." },
  { ref: "Philippians 4:6–7", text: "In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus." },
  { ref: "Joshua 1:9", text: "Haven't I commanded you? Be strong and courageous. Don't be afraid. Don't be dismayed, for Yahweh your God is with you wherever you go." },
  { ref: "Romans 8:28", text: "We know that all things work together for good for those who love God, for those who are called according to his purpose." },
  { ref: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." },
  { ref: "Isaiah 40:31", text: "But those who wait for Yahweh will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint." },
  { ref: "Matthew 6:33", text: "But seek first God's Kingdom and his righteousness; and all these things will be given to you as well." },
  { ref: "Psalm 119:105", text: "Your word is a lamp to my feet, and a light for my path." },
  { ref: "John 3:16", text: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life." },
  { ref: "Lamentations 3:22–23", text: "It is because of Yahweh's loving kindnesses that we are not consumed, because his compassion doesn't fail. They are new every morning. Great is your faithfulness." },
  { ref: "Philippians 4:13", text: "I can do all things through Christ, who strengthens me." },
  { ref: "1 Corinthians 13:4–5", text: "Love is patient and is kind. Love doesn't envy. Love doesn't brag, is not proud, doesn't behave itself inappropriately, doesn't seek its own way, is not provoked, takes no account of evil." },
  { ref: "Psalm 121:1–2", text: "I will lift up my eyes to the hills. Where does my help come from? My help comes from Yahweh, who made heaven and earth." },
  { ref: "Micah 6:8", text: "He has shown you, O man, what is good. What does Yahweh require of you, but to act justly, to love mercy, and to walk humbly with your God?" },
  { ref: "Matthew 11:28", text: "Come to me, all you who labour and are heavily burdened, and I will give you rest." },
  { ref: "Psalm 118:24", text: "This is the day that Yahweh has made. We will rejoice and be glad in it!" },
  { ref: "Ephesians 2:8–9", text: "For by grace you have been saved through faith, and that not of yourselves; it is the gift of God, not of works, that no one would boast." },
  { ref: "Colossians 3:23", text: "And whatever you do, work heartily, as for the Lord, and not for men." },
  { ref: "Psalm 34:8", text: "Oh taste and see that Yahweh is good. Blessed is the man who takes refuge in him." },
  { ref: "Proverbs 22:6", text: "Train up a child in the way he should go, and when he is old he will not depart from it." },
  { ref: "Galatians 5:22–23", text: "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faith, gentleness, and self-control." },
  { ref: "Hebrews 11:1", text: "Now faith is assurance of things hoped for, proof of things not seen." },
  { ref: "Psalm 37:4", text: "Also delight yourself in Yahweh, and he will give you the desires of your heart." },
  { ref: "2 Timothy 1:7", text: "For God didn't give us a spirit of fear, but of power, love, and self-control." },
  { ref: "James 1:2–3", text: "Count it all joy, my brothers, when you fall into various temptations, knowing that the testing of your faith produces endurance." },
  { ref: "1 Thessalonians 5:16–18", text: "Always rejoice. Pray without ceasing. In everything give thanks, for this is the will of God in Christ Jesus toward you." },
  { ref: "Psalm 139:14", text: "I will give thanks to you, for I am fearfully and wonderfully made. Your works are wonderful. My soul knows that very well." },
  { ref: "Deuteronomy 6:6–7", text: "These words, which I command you today, shall be on your heart; and you shall teach them diligently to your children, and shall talk of them when you sit in your house, and when you walk by the way." },
  { ref: "Romans 12:2", text: "Don't be conformed to this world, but be transformed by the renewing of your mind, so that you may prove what is the good, well-pleasing, and perfect will of God." },
  { ref: "Psalm 100:4–5", text: "Enter into his gates with thanksgiving, and into his courts with praise. Give thanks to him, and bless his name. For Yahweh is good. His loving kindness endures forever." },
  { ref: "Isaiah 41:10", text: "Don't be afraid, for I am with you. Don't be dismayed, for I am your God. I will strengthen you. Yes, I will help you." },
];

export const PROMPTS: string[] = [
  "What is one thing you're thankful to God for today?",
  "Where did you see God's kindness this week?",
  "Who is someone we can pray for tonight, and why?",
  "What does today's verse teach us about God?",
  "Was there a moment today you found hard? How can we trust God with it?",
  "How can our family show love to someone tomorrow?",
  "What is something you want to ask God for help with?",
  "Tell about a time you felt God was near.",
  "What is one way we can serve someone this week?",
  "What does it mean that God is our refuge?",
  "How can we be more patient and kind at home?",
  "What is a promise of God that gives you hope?",
  "Confess one thing to God together and thank Him for grace.",
  "What are you looking forward to that we can thank God for?",
  "How did you see one of the fruits of the Spirit today?",
];

// Days since the epoch in local time → a stable per-day index.
export function dayIndex(d: Date = new Date()): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}
export const verseOfDay = (d: Date = new Date()): Verse => VERSES[dayIndex(d) % VERSES.length];
export const promptOfDay = (d: Date = new Date()): string => PROMPTS[dayIndex(d) % PROMPTS.length];
