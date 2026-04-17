FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    pipx \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Make pipx binaries available system-wide
ENV PATH="/root/.local/bin:${PATH}"

# Install yt-dlp
RUN pipx install yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
