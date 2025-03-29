FROM node:18-alpine
RUN mkdir -p /app
WORKDIR /app
COPY package.json /app
RUN npm install

# Gemini requirements
RUN npm install @google/generative-ai axios cheerio discord.js dotenv eventsource fs sharp office-text-extractor youtube-transcript node-os-utils ws mathjs

COPY . /app
ENV NODE_ENV=production
CMD ["npm", "start"]