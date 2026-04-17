FROM node:18-slim

# Install modern Python + ffmpeg + curl
RUN apt-get update && \
    apt-get install -y python3.11 python3.11-venv python3-pip ffmpeg curl && \
    ln -s /usr/bin/python3.11 /usr/bin/python && \
    python -m pip install --upgrade pip && \
    pip install -U yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
