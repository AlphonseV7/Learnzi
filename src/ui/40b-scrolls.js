/* LearnZì UI, part 8b: the scrolls found on the Journey (41-journey). Short "did you know" notes for
 * beginners about the language and its culture, one per quest. Facts with dates or numbers were checked
 * against sources (Wikipedia's pages on pinyin, simplified characters, Mandarin, the imperial exams and
 * East Asian writing directions). In the text, [[词]] is a word you can tap to open it. */

const SCROLLS = [
  { id: 1, zh: "语言", cat: "Language", title: "Mandarin, Cantonese and the other Chinese languages", body: [
    "\"Chinese\" is really a family of languages. The one you're learning is Mandarin, [[普通话]] pǔtōnghuà, \"common speech\". It's based on the Beijing dialect and is the official language of mainland China, the main language of Taiwan, and one of Singapore's four official languages.",
    "About 990 million people speak Mandarin as their first language, more than any other language in the world.",
    "Other Chinese languages include Cantonese, [[广东话]] Guǎngdōnghuà (Hong Kong and Guangzhou), Shanghainese and Hokkien. Spoken, they can be as different from Mandarin as Spanish is from Italian, but their speakers read and write largely the same standard written Chinese.",
    "In Taiwan, Mandarin is often called [[国语]] guóyǔ, and in Singapore and Malaysia [[华语]] huáyǔ.",
  ] },
  { id: 2, zh: "拼音", cat: "Pinyin", title: "Pinyin: why it exists", body: [
    "Characters don't tell you how to say them: nothing in [[是]] says it's pronounced shì. [[拼音]] pīnyīn, \"spelled sounds\", writes Mandarin in the Latin alphabet, with marks for the tones: mā, má, mǎ, mà.",
    "It was worked out in the 1950s by a team that included the linguist Zhou Youguang, often called the father of pinyin, and it was officially adopted on 11 February 1958. In 1982 it became the international standard for writing Chinese in Latin letters.",
    "Children in mainland China learn pinyin in their first year at school, before most characters. And most people type Chinese by typing pinyin and picking the character they want.",
    "LearnZì's search works the same way: type nihao, ni3hao3 or nǐ hǎo and it finds [[你好]].",
  ] },
  { id: 3, zh: "汉字", cat: "Characters", title: "How many characters do you really need?", body: [
    "The great Kangxi Dictionary of 1716 lists over 47,000 characters, but most of them are rare, old or variants.",
    "China's official list of commonly used characters has 2,500, plus 1,000 more that are less common. Together those 3,500 cover over 99% of everyday written Chinese.",
    "The HSK exams, the official Chinese tests, start with 300 characters at level 1 and reach 3,000 at the top levels.",
    "The good news: characters come back again and again. Learn [[人]] rén and you'll spot it in [[大人]], [[中国人]] and [[人口]]. Each new character opens up many words.",
  ] },
  { id: 4, zh: "简繁", cat: "Characters", title: "Simplified or traditional?", body: [
    "Many characters can be written two ways. Simplified characters, with fewer strokes, are used in mainland China, Singapore and Malaysia. Traditional characters are used in Taiwan, Hong Kong and Macau.",
    "Mainland China brought in simplified characters from 1956, and its 1964 list simplified 2,236 characters. Many of the simpler forms were shortcuts people had already used in handwriting for centuries.",
    "Compare [[学]] and 學 (xué, study), [[马]] and 馬 (mǎ, horse), [[书]] and 書 (shū, book), [[龙]] and 龍 (lóng, dragon). Most characters, like 人, 山 and 中, are the same in both.",
    "LearnZì shows simplified characters unless you switch to traditional in Settings → Reading.",
  ] },
  { id: 5, zh: "声调", cat: "Tones", title: "Why Chinese has tones", body: [
    "In Mandarin the pitch of your voice changes the meaning of a word. There are four tones, plus a light neutral tone: high and level (mā), rising (má), dipping (mǎ) and falling (mà).",
    "Mandarin has only about 400 basic syllables, far fewer than English. Tones turn them into well over a thousand different sounds, which helps keep words apart.",
    "Some Chinese languages have even more: Cantonese is usually described as having six tones.",
    "Tip: tones are easier to hear in whole words than on their own, so once single tones feel easy, try Tone pairs.",
  ] },
  { id: 6, zh: "变调", cat: "Tones", title: "When tones change", body: [
    "Some tones change depending on the syllable that comes next.",
    "Two 3rd tones in a row: the first one becomes a 2nd tone. [[你好]] is written nǐ hǎo but said ní hǎo.",
    "[[不]] bù becomes bú before a 4th tone: [[不是]] búshì, [[不要]] búyào.",
    "[[一]] yī becomes yí before a 4th tone, as in [[一个]] yí ge, and yì before the other tones, as in [[一起]] yìqǐ. When you're counting or reading out a number, it stays yī.",
    "The Pronunciation tips box in LearnZì's word pop-up points these out for you.",
  ] },
  { id: 7, zh: "同音", cat: "Tones", title: "Same sound, different meaning", body: [
    "Change only the tone and you get a new word: [[妈]] mā (mother), [[麻]] má (hemp, or numb), [[马]] mǎ (horse), [[骂]] mà (to scold). A favourite practice sentence: [[妈妈]] [[骂]] [[马]], māma mà mǎ, \"Mum scolds the horse.\"",
    "Many words even share the same sound and tone, like [[是]] shì (to be) and [[事]] shì (a matter). Context and two-character words keep them apart, which is one reason most Chinese words are two characters long.",
    "It also makes Chinese rich in puns. Look out for them at New Year.",
  ] },
  { id: 8, zh: "龙门", cat: "Culture", title: "Carp leaping the Dragon Gate", body: [
    "An old legend says carp swim up the Yellow River against the current. The few that leap the great waterfall at the Dragon Gate, [[龙门]] lóngmén, turn into dragons.",
    "So the saying [[鲤鱼跳龙门]] lǐyú tiào lóngmén, \"the carp leaps the Dragon Gate\", came to mean passing the imperial exams, or any big success won through hard work.",
    "That's why carp and koi appear in Chinese paintings and New Year pictures as a sign of perseverance, and why koi swim in your water garden.",
  ] },
  { id: 9, zh: "部首", cat: "Characters", title: "How characters are built", body: [
    "Most characters are made of parts. One part often hints at the meaning: the radical, [[部首]] bùshǒu. Characters with 氵 (water) are often about water: [[河]] river, [[海]] sea, [[洗]] wash.",
    "Another part often hints at the sound. [[妈]] mā (mother) is 女 (woman) for the meaning plus 马 mǎ for the sound, and [[吗]] ma and [[骂]] mà borrow the same sound part. Most characters are built this way, from a meaning part and a sound part.",
    "Traditional dictionaries sort characters under 214 radicals, the set made standard by the Kangxi Dictionary of 1716.",
    "In any word's pop-up, the Character story box shows a character's parts. Tap one to explore it.",
  ] },
  { id: 10, zh: "笔顺", cat: "Characters", title: "The rules of stroke order", body: [
    "Characters are written in a set order, and a few rules cover most of it:",
    "Top before bottom, as in [[三]]. Left before right, as in [[川]]. Across before down, as in [[十]]. The stroke to the left before the stroke to the right, as in [[人]] and [[八]].",
    "Outside before inside, and close the box last: in [[国]] the frame goes first, then what's inside, and the bottom stroke shuts it. The middle comes before the sides in [[小]] and [[水]].",
    "Writing in order makes characters look balanced, helps you remember them, and is what handwriting input on phones expects. Watch any character's order in the word pop-up's Stroke order box.",
  ] },
  { id: 11, zh: "象形", cat: "Characters", title: "From pictures to characters", body: [
    "The oldest Chinese writing, carved on bones and shells more than 3,000 years ago, began partly as pictures.",
    "[[日]] (sun) began as a circle with a dot in it, [[月]] (moon) as a crescent, [[山]] (mountain) as three peaks, [[木]] (tree) as a trunk with branches and roots, and [[人]] (person) as someone walking.",
    "Put them together and you get new ideas: two trees make [[林]] (woods), three make [[森]] (forest), a person leaning on a tree is [[休]] (rest), and sun and moon together make [[明]] (bright).",
    "Only a small share of characters are pictures like these. Most mix a meaning part with a sound part.",
  ] },
  { id: 12, zh: "量词", cat: "Grammar", title: "Why everything has a measure word", body: [
    "In Chinese you can't put a number straight before a noun. A measure word, [[量词]] liàngcí, goes between them, a bit like \"a sheet of paper\" or \"a cup of tea\" in English.",
    "[[个]] gè is the all-rounder: [[一个人]] (one person). Others depend on the thing's shape or kind: [[本]] běn for books, [[张]] zhāng for flat things like paper, tickets and tables, [[只]] zhī for many animals, and [[杯]] bēi for cups and glasses of drink.",
    "Not sure which one? 个 is usually understood. LearnZì lists a noun's measure words in its Meaning box.",
  ] },
  { id: 13, zh: "读法", cat: "Reading", title: "Which way is Chinese read?", body: [
    "Today almost all Chinese is written left to right in horizontal lines, just like English: phones, websites, most books and road signs.",
    "For most of its history it was written in columns, top to bottom, starting on the right. You still see this in calligraphy, on the paired scrolls by doors at New Year, and in some books in Taiwan and Hong Kong.",
    "All newspapers in mainland China switched to horizontal lines on 1 January 1956.",
    "Old shop signs can read right to left: 店书 is really [[书店]] shūdiàn, a bookshop. Each character is like a one-character column.",
  ] },
  { id: 14, zh: "读写", cat: "Pinyin", title: "Pinyin as a stepping stone", body: [
    "Pinyin is how you learn the sound and tones of a word, and how most people type. But real Chinese, on signs, in books and menus and messages, is written in characters with no pinyin.",
    "If you always read the pinyin above a word, your eyes can skip the characters. Try reading the character first and only peek at the pinyin to check. When you're ready, turn off \"Show pinyin\" in Settings → Reading.",
    "Taiwan uses a different system for sounds, Zhuyin or Bopomofo, [[注音]] zhùyīn, with symbols like ㄅㄆㄇㄈ, and it's the most common way to type there.",
    "Either way, it's a stepping stone. The goal is reading the characters.",
  ] },
  { id: 15, zh: "时间", cat: "Grammar", title: "No tenses? How Chinese shows time", body: [
    "Chinese verbs never change their form: [[去]] qù is \"go\", \"goes\", \"went\" and \"will go\".",
    "Time comes from time words, like [[昨天]] (yesterday), [[今天]] (today) and [[明天]] (tomorrow), and from small words such as [[了]] le for something done, [[过]] guo for something you've done before, and [[在]] zài for something happening now.",
    "So 我昨天去了 is \"I went yesterday\" and 我明天去 is \"I'll go tomorrow\".",
    "Study → Grammar has each of these patterns, with examples you can hear.",
  ] },
  { id: 16, zh: "标志", cat: "Reading", title: "Characters you'll see on every sign", body: [
    "A handful of characters cover most signs: [[出口]] exit, [[入口]] entrance, [[厕所]] or [[洗手间]] toilets, with [[男]] for men and [[女]] for women.",
    "On doors: [[推]] push and [[拉]] pull. In shops: [[营业时间]] opening hours. Everywhere: [[禁止吸烟]] no smoking. Underground: [[地铁]] the metro.",
    "Point Photo to words at a sign or menu and LearnZì reads the characters for you, then makes them into flashcards.",
  ] },
  { id: 17, zh: "数字", cat: "Culture", title: "Lucky and unlucky numbers", body: [
    "4, [[四]] sì, sounds like [[死]] sǐ, \"to die\", so many buildings skip the 4th floor and people avoid it in phone numbers.",
    "8, [[八]] bā, sounds like [[发]] fā, as in [[发财]] fācái, \"to get rich\", so it's the luckiest number. The Beijing Olympics opened at 8:08 in the evening on 8 August 2008.",
    "6, [[六]] liù, sounds like [[流]] liú, \"to flow\", so things go smoothly. 9, [[九]] jiǔ, sounds like [[久]] jiǔ, \"long-lasting\", which makes it popular for weddings.",
  ] },
  { id: 18, zh: "姓名", cat: "Culture", title: "Names: surname first", body: [
    "Chinese names put the family name first: in Wáng Xiǎomíng, Wáng is the family name. Family names are usually one character, and given names one or two.",
    "A few surnames are hugely common: [[王]] Wáng, [[李]] Lǐ and [[张]] Zhāng are each shared by roughly a hundred million people.",
    "To ask someone's surname politely, say 您[[贵姓]]? nín guìxìng, \"your honourable surname?\" The answer: 我[[姓]]王, wǒ xìng Wáng.",
    "Women in mainland China usually keep their own surname when they marry.",
  ] },
  { id: 19, zh: "春节", cat: "Culture", title: "Chinese New Year", body: [
    "[[春节]] Chūnjié, the Spring Festival, begins on the first day of the lunar year, between 21 January and 20 February. It's the biggest holiday of the year, and many people travel home to their families.",
    "Red is everywhere for luck: red lanterns, red couplets by the door (written in vertical columns), and [[红包]] hóngbāo, red envelopes of money for children.",
    "You'll often see [[福]] fú, good fortune, hung upside down. \"Upside down\", [[倒]] dào, sounds like \"arrived\", [[到]] dào: good fortune has arrived.",
    "Each year belongs to one of 12 zodiac animals, and the celebrations end on the 15th day with the Lantern Festival, [[元宵节]] Yuánxiāojié. Greet people with [[新年快乐]]!",
  ] },
  { id: 20, zh: "科举", cat: "Culture", title: "The imperial exams", body: [
    "For about 1,300 years, from the Sui dynasty (around 605) until 1905, China chose its officials through the imperial exams, [[科举]] kējǔ.",
    "Candidates studied the classics for years and sat exams in their county, their province and the capital, and the best then sat a final exam in the palace, set by the emperor himself.",
    "Passing brought titles: [[秀才]] xiùcai, [[举人]] jǔrén, [[进士]] jìnshì. The top three in the palace exam were the [[状元]] zhuàngyuan, the [[榜眼]] bǎngyǎn and the [[探花]] tànhuā.",
    "These are the ranks you climb in LearnZì. And today 状元 still means the top scorer in China's university entrance exam, the [[高考]] gāokǎo.",
  ] },
];
const scrollById = id => SCROLLS.find(s => s.id === id);
