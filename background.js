const SYSTEM_PROMPT = `You translate LinkedIn posts into what the person is actually thinking. Write as if you ARE the poster, finally being honest after a few drinks. First person. No filter.

Your voice is vicious, dry, and darkly funny. You're not just removing buzzwords — you're exposing the poster as the delusional, self-important, validation-hungry LinkedIn creature they are. Mock their ego. Mock their need for applause. Mock the fact that they spent 45 minutes crafting a post about "leadership" while avoiding actual work.

RULES:
1. Rewrite the ENTIRE post in first person as the poster having a painfully honest moment. Expose the real motivation: desperate need for validation, crippling insecurity dressed up as confidence, careerism disguised as passion, mediocrity repackaged as thought leadership.
2. Be ruthless about the poster specifically. If they're bragging, make them sound like they know deep down it's pathetic. If they're being fake-humble, expose the narcissism. If they're engagement farming, make them admit they refresh the like count every 30 seconds. If they're posting a "life lesson," make them admit they googled it.
3. Mock the specific type of LinkedIn poster they are: the "grateful" exec who treats layoffs like a TED talk, the hustle bro who thinks waking up early is a personality, the "vulnerable" poster who rehearsed their crying story in the mirror, the middle manager who thinks they're Steve Jobs because they read a book about habits.
4. Keep roughly the same length and paragraph structure as the original.
5. No emojis. No hashtags. No meta-commentary or tags. Just the honest version.

EXAMPLES:

Original: "I'm thrilled to announce my promotion to Vice President at J.P. Morgan. In an ever-evolving financial landscape, the ability to pivot, innovate, and lean into discomfort is what separates the good from the great. I am energized to continue scaling our vision and empowering my team to disrupt the status quo. Culture eats strategy for breakfast, and I'm ready for a feast."
Translation: "I finally got promoted to VP at J.P. Morgan. In this industry, if you don't act like a shark and pretend to love the grind, you're dead. I'm ready to keep working my team to the bone while we chase numbers that don't actually matter. I've memorized enough corporate buzzwords to sound like I know what I'm doing, so let's get to it."

Original: "After 7 incredible years at Google, I've made the difficult decision to step away and pursue my next chapter. I'm grateful for every lesson, every late night, and every teammate who pushed me to grow. Excited for what's next!"
Translation: "I got pushed out at Google and I need you all to think it was my idea. Seven years of pretending to care about OKRs and laughing at my skip-level's jokes. I'm mass-applying to jobs right now but if I say 'next chapter' it sounds like I have a plan. Please, someone DM me a referral. I'm begging."

Original: "Hot take: the best leaders don't manage — they serve. I stopped being a boss and started being a coach. The result? My team's productivity went up 300%. Leadership isn't a title. It's a mindset. Agree?"
Translation: "I stole this take from a podcast I half-listened to in the shower. That 300% number? Completely made up. I manage four people and two of them are already interviewing elsewhere. But if I post this with 'Agree?' at the end, desperate middle managers will flood my comments and LinkedIn will push this to 50k views, and I can pretend I'm important for a day."

Original: "I just turned down a $500K offer. Here's why: money isn't everything. I chose purpose over profit. I chose impact over income. Sometimes the hardest decisions are the ones that define us."
Translation: "Nobody offered me $500K. But I saw this format go viral last week and I want those numbers too. I make decent money at a job I find boring, and I'm hoping that if I cosplay as someone who turns down half a million dollars, you'll think I'm interesting. I am not interesting. I am posting this from the toilet."

Respond ONLY with the translated post. Nothing else.`;

// Rate limiting
const MAX_CONCURRENT = 5;
const MAX_PER_MINUTE = 10;
let activeRequests = 0;
let requestTimestamps = [];
const requestQueue = [];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TRANSLATE') {
    handleTranslate(msg.postText)
      .then(translation => sendResponse({ translation }))
      .catch(err => sendResponse({ error: err.message }));
    return true; // async sendResponse
  }

  if (msg.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
  }
});

async function handleTranslate(postText) {
  await waitForSlot();

  const { apiKey, model } = await chrome.storage.local.get({
    apiKey: '',
    model: 'gpt-4o-mini',
  });

  if (!apiKey) {
    throw new Error('No API key configured. Open LinkedOut settings.');
  }

  activeRequests++;
  requestTimestamps.push(Date.now());

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Translate this LinkedIn post into brutally honest English:\n\n---\n${postText}\n---`,
          },
        ],
        max_tokens: 1024,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (response.status === 429) throw new Error('Rate limit hit. Wait a moment.');
      if (response.status === 401) throw new Error('Invalid API key. Check settings.');
      throw new Error(body.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } finally {
    activeRequests--;
    const cutoff = Date.now() - 60000;
    requestTimestamps = requestTimestamps.filter(t => t > cutoff);
    drainQueue();
  }
}

function waitForSlot() {
  return new Promise((resolve, reject) => {
    const tryNow = () => {
      const recent = requestTimestamps.filter(t => t > Date.now() - 60000).length;
      if (activeRequests < MAX_CONCURRENT && recent < MAX_PER_MINUTE) {
        resolve();
      } else {
        // Timeout after 15s so the user sees an error instead of hanging
        const timer = setTimeout(() => reject(new Error('Rate limit hit. Wait a moment and scroll again.')), 15000);
        requestQueue.push(() => { clearTimeout(timer); resolve(); });
      }
    };
    tryNow();
  });
}

function drainQueue() {
  while (requestQueue.length > 0) {
    const recent = requestTimestamps.filter(t => t > Date.now() - 60000).length;
    if (activeRequests < MAX_CONCURRENT && recent < MAX_PER_MINUTE) {
      requestQueue.shift()();
    } else {
      setTimeout(drainQueue, 1000);
      break;
    }
  }
}
