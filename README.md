# Gemini Discord Bot

Gemini Discord Bot runs in docker for convenience, and is currently tested to be compatible with gemini-2.0-flash-exp for text responses.

## Features

- **Text Prompts:** Talk with Gemini directly from Discord
- **Weather Requests:** Get the live weather for any location in the world

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- Discord Bot account & token ([create a bot on Discord Developer Portal](https://discord.com/developers/applications))
- Google Gemini API token
- (optional) Open Weather Map One-Call 3 API token ([create a token on OpenWeatherMap.org](https://openweathermap.org/api/one-call-3))

### Installation

1. Clone the repository:

    ```sh
    git clone https://github.com/BornSupercharged/Gemini-Discord-Bot
    cd Gemini-Discord-Bot
    ```

2. Set up environment variables:

    Create a `.env` file in the root directory and add your Discord bot token and Google API key:

    ```env
    DISCORD_BOT_TOKEN=your_discord_bot_token
    GOOGLE_API_KEY=your_google_api_key
    OPENWEATHERMAP_API_KEY=your_openweathermap_api_key # Optional
    ```

3. Run in docker:

    ```sh
    docker-compose up -d --build
    ```

## Commands

### Chat
- `/gemini [your prompt]`: Uses Gemini to reply to your prompt in discord.

### Weather
- `/weather [city] [optional state] [optional country]`: Converts your city/state/country into lat/lon coordinates, then passes it onto OpenWeatherMap for the current weather 

### Contributions

We welcome contributions! Feel free to fork the repository, create a new branch, make your changes, and submit a pull request.

## License

This project is licensed under the MIT License.

---

Happy Discording with *Gemini*!

If you find this bot useful, don't forget to ⭐star the repository!
