FROM node:18-bullseye

# Install system deps
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl && \
    pip3 install -U yt-dlp && \
    apt-get clean

# This is the CRITICAL part for SABR
ENV YTDLP_JSRUNTIME=node

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
