# LinkedOut

A Chrome extension to translate coroporate linkedin slop into what the person is _really_ saying.

## Install

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `linkedout` folder
5. The LO icon appears in your extensions bar

## Setup

1. Get an OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click the **LinkedOut** extension icon > **Settings**
3. Paste your API key and hit **Save Settings**
4. Navigate to LinkedIn — posts will auto-translate

## Usage

- Posts are translated automatically as you scroll your feed
- A small **LO** button appears on each post — click it to toggle between original and translated
- Works on the main feed and on user profile pages
- Set to **Manual** mode in settings if you only want to translate specific posts by clicking the LO button

## Cost

LinkedOut uses **gpt-4o-mini** by default, which is extremely cheap:

| Usage | Approximate cost |
|---|---|
| 1 post | ~$0.0002 |
| 100 posts | ~$0.02 |
| Typical daily session (20-50 posts) | < $0.01 |
| Heavy daily use for a month | ~$0.30 - $1.00 |

You can switch to a different model in settings. gpt-4o produces slightly better translations at ~10x the cost. gpt-4.1-nano is the cheapest option.

## License

MIT
