FROM node:20-bookworm

# Install system deps: Python 3.11, ffmpeg, curl, Node for JS runtime
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp properly (NOT the Debian one)
RUN python3.11 -m pip install --upgrade pip && \
    pip install -U yt-dlp

# Verify yt-dlp + JS runtime works
RUN yt-dlp --version

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
