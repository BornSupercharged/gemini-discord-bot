// index.js
import { Client, IntentsBitField, SlashCommandBuilder, Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import { config } from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from 'axios'; // Import axios

config(); // Load environment variables from .env file

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; // Make sure this is set in your .env
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN; // Make sure this is set in your .env
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY; // New API key

if (!GOOGLE_API_KEY || !DISCORD_BOT_TOKEN || !OPENWEATHERMAP_API_KEY) {
    console.error("Error: GOOGLE_API_KEY, DISCORD_BOT_TOKEN and/or OPENWEATHERMAP_API_KEY environment variables are not set.  Please check your .env file.");
    process.exit(1); // Exit if required variables are missing
}

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent, // Required for reading messages
    ],
});

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Command registration - MOVE THIS INSIDE THE 'ready' EVENT
    const commands = [
        new SlashCommandBuilder()
            .setName('gemini')
            .setDescription('Ask Gemini a question.')
            .addStringOption(option =>
                option.setName('prompt')
                    .setDescription('The question to ask Gemini')
                    .setRequired(true)),
        new SlashCommandBuilder() // New weather command
            .setName('weather')
            .setDescription('Get the current weather for a city (optional state and country).')
            .addStringOption(option =>
                option.setName('city')
                    .setDescription('The city to get weather for.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('state')
                    .setDescription('The state (optional).')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('country')
                    .setDescription('The country (optional).')
                    .setRequired(false)),
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(client.user.id), // client.user is now available
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'gemini') {
        // ... (Existing Gemini command logic - unchanged) ...
        const prompt = interaction.options.getString('prompt');

        if (!prompt) {
            await interaction.reply({ content: 'Please provide a prompt.', ephemeral: true });
            return;
        }

        await interaction.deferReply(); // Tell Discord we're processing (important for longer tasks)

        try {
            const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            if (responseText) {
                const username = interaction.user.username; // Get the user's username
                const introMessage = `${username} asked: "${prompt}"`; // Initial message
                const continuationNotice = "[... continued below]";
                const maxLength = 1990; // Maximum length for each message chunk

                // Split the responseText into chunks at word boundaries
                const chunks = splitMessage(responseText, maxLength);

                // Send the initial message
                await interaction.editReply(introMessage);

                // Send the chunks as follow-up messages
                for (let i = 0; i < chunks.length; i++) {
                    let chunk = chunks[i];

                    // Add the continuation notice to all chunks except the last one
                    if (i < chunks.length - 1) {
                        if (chunk.length + continuationNotice.length + 1 <= 2000) {
                            chunk += " " + continuationNotice;
                        } else {
                            console.warn("Continuation notice could not be added due to length constraints. May result in the cutoff word being cut off still");
                        }
                    }

                    // Ensure each chunk is within the 2000 character limit before sending
                    if (chunk.length > 2000) {
                        console.error("Chunk exceeds 2000 character limit after adding the continuation notice. This should not happen.");
                        chunk = chunk.substring(0, 1997) + "..."; // Last resort truncation
                    }

                    await interaction.followUp(chunk); // Use followUp to send additional messages
                }
            } else {
                await interaction.editReply("Gemini returned an empty response.");
            }
        } catch (error) {
            console.error("Gemini API Error:", error);
            await interaction.editReply(`An error occurred while communicating with Gemini: ${error.message}`);
        }
    } else if (interaction.commandName === 'weather') { // New weather command handler
        const city = interaction.options.getString('city');
        const state = interaction.options.getString('state');
        const country = interaction.options.getString('country');

        if (!city) {
            await interaction.reply({ content: 'Please provide a city name.', ephemeral: true });
            return;
        }

        await interaction.deferReply(); // Defer the reply

        try {
            const weatherData = await getWeatherWithGemini(city, state, country, GOOGLE_API_KEY, OPENWEATHERMAP_API_KEY);
            await interaction.editReply(weatherData);
        } catch (error) {
            console.error("Weather API Error:", error);
            await interaction.editReply(`An error occurred while fetching the weather for ${city}: ${error.message}`);
        }
    }
});

client.login(DISCORD_BOT_TOKEN);

// Helper function to split a message into chunks at word boundaries
function splitMessage(message, maxLength) {
    const chunks = [];
    let currentChunk = "";

    const words = message.split(" "); // Split into words
    for (const word of words) {
        if (currentChunk.length + word.length + 1 <= maxLength) { // +1 for the space
            currentChunk += (currentChunk.length > 0 ? " " : "") + word;  // Add space if not first word
        } else {
            chunks.push(currentChunk);
            currentChunk = word; // Start a new chunk
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);  // Add the last chunk
    }

    return chunks;
}

// Helper function to convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius) {
    return Math.round((celsius * 9 / 5) + 32);
}

async function getWeatherWithGemini(city, state, country, googleApiKey, openWeatherMapApiKey) {
    try {
        const genAI = new GoogleGenerativeAI(googleApiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        // Step 1: Get Latitude and Longitude using Gemini
        const locationPrompt = `What is the latitude and longitude for ${city} ${state} ${country}? Provide the answer in JSON format as {"latitude": number, "longitude": number}`;

        const locationResult = await model.generateContent(locationPrompt);
        let locationResponseText = locationResult.response.text();

        // Strip out ```json and ``` if present
        locationResponseText = locationResponseText.replace(/```json\n/g, '');
        locationResponseText = locationResponseText.replace(/```/g, '');

        let locationData;
        try {
			console.error("Location response from Gemini: ", locationResponseText)
            locationData = JSON.parse(locationResponseText);
            if (!locationData.latitude || !locationData.longitude) {
                throw new Error("Invalid latitude and longitude data received from Gemini.");
            }
        } catch (error) {
            console.error("Error parsing location data:", error);
            throw new Error("Failed to get location data from Gemini. Please make sure it has the correct schema");
        }

        const { latitude, longitude } = locationData;

        // Step 2: Get Weather Data from OpenWeatherMap using the One Call API
        const weatherApiUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&appid=${openWeatherMapApiKey}&units=metric`;

        const weatherResponse = await axios.get(weatherApiUrl);
        const weatherData = weatherResponse.data;

        // Step 3: Parse Weather Data and Construct Response
        if (!weatherData || !weatherData.current) {
            throw new Error("Could not retrieve weather data from OpenWeatherMap.");
        }

        const temperatureCelsius = weatherData.current.temp;  // Get temperature in Celsius
        const temperatureFahrenheit = celsiusToFahrenheit(temperatureCelsius); // Convert to Fahrenheit
        const description = weatherData.current.weather[0].description;
        const humidity = weatherData.current.humidity;
        const windSpeed = weatherData.current.wind_speed;

        return `Current weather in ${city}${state ? `, ${state}` : ''}${country ? `, ${country}` : ''}:
Temperature: ${temperatureFahrenheit}°F
Description: ${description}
Humidity: ${humidity}%
Wind Speed: ${windSpeed} m/s`;

    } catch (error) {
        console.error("Error in getWeatherWithGemini:", error);
        throw new Error(`Failed to get weather information: ${error.message}`);
    }
}
